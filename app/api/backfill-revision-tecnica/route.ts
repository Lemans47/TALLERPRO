import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const cleanPatente = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

export async function POST() {
  const apiKey = process.env.GETAPI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "API Key no configurada" }, { status: 500 })
  }

  const db = getSQL()

  try {
    await db`ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS mes_revision_tecnica TEXT`
  } catch {}

  // ── PASO 1: Deduplicar vehiculos por patente normalizada ──────────────────
  // Agrupa rows cuya patente normaliza igual, mergea datos con COALESCE,
  // deja una fila canónica con la patente limpia, borra las demás.
  const allVehiculos: any[] = await db`
    SELECT id, patente, marca, modelo, color, año, vin, mes_revision_tecnica, cliente_id, updated_at
    FROM vehiculos
  `

  const groups = new Map<string, any[]>()
  for (const v of allVehiculos) {
    const key = cleanPatente(v.patente)
    if (!key) continue
    const arr = groups.get(key) ?? []
    arr.push(v)
    groups.set(key, arr)
  }

  let dedupeMerged = 0
  let dedupeDeleted = 0

  for (const [key, rows] of groups.entries()) {
    if (rows.length === 1 && rows[0].patente === key) continue // ya está limpio y único

    const pickFirst = (field: string) => rows.find((r) => r[field] != null && r[field] !== "")?.[field] ?? null
    const merged = {
      patente: key,
      marca: pickFirst("marca"),
      modelo: pickFirst("modelo"),
      color: pickFirst("color"),
      año: pickFirst("año"),
      vin: pickFirst("vin"),
      mes_revision_tecnica: pickFirst("mes_revision_tecnica"),
      cliente_id: pickFirst("cliente_id"),
    }

    const canonical = rows.find((r) => r.patente === key) ?? rows[0]
    const toDelete = rows.filter((r) => r.id !== canonical.id).map((r) => r.id)

    await db`
      UPDATE vehiculos SET
        patente = ${merged.patente},
        marca = ${merged.marca},
        modelo = ${merged.modelo},
        color = ${merged.color},
        año = ${merged.año},
        vin = ${merged.vin},
        mes_revision_tecnica = ${merged.mes_revision_tecnica},
        cliente_id = ${merged.cliente_id},
        updated_at = NOW()
      WHERE id = ${canonical.id}
    `

    if (toDelete.length > 0) {
      await db`DELETE FROM vehiculos WHERE id = ANY(${toDelete}::uuid[])`
      dedupeDeleted += toDelete.length
    }
    dedupeMerged++
  }

  // ── PASO 2: Backfill desde la API para patentes sin mes ───────────────────
  const rows: any[] = await db`
    SELECT DISTINCT UPPER(REGEXP_REPLACE(s.patente, '[^A-Za-z0-9]', '', 'g')) AS patente
    FROM servicios s
    LEFT JOIN LATERAL (
      SELECT mes_revision_tecnica
      FROM vehiculos
      WHERE UPPER(REGEXP_REPLACE(patente, '[^A-Za-z0-9]', '', 'g'))
          = UPPER(REGEXP_REPLACE(s.patente, '[^A-Za-z0-9]', '', 'g'))
      LIMIT 1
    ) v ON true
    WHERE (v.mes_revision_tecnica IS NULL)
      AND s.patente IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(s.patente, '[^A-Za-z0-9]', '', 'g')) >= 4
  `

  const patentes = rows.map((r) => String(r.patente)).filter(Boolean)

  let updated = 0
  let skipped = 0
  let failed = 0
  const errors: { patente: string; error: string }[] = []
  const detail: { patente: string; result: string; note?: string }[] = []

  for (const patente of patentes) {
    try {
      const res = await fetch(`https://chile.getapi.cl/v1/vehicles/plate/${patente}`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(10000),
      })

      if (res.status === 429) {
        errors.push({ patente, error: "Límite de consultas alcanzado — abortando" })
        detail.push({ patente, result: "rate_limit_abort" })
        failed++
        break
      }

      if (!res.ok) {
        detail.push({ patente, result: "http_error", note: `status ${res.status}` })
        skipped++
        continue
      }

      const body = await res.json()
      if (!body?.success || !body?.data) {
        detail.push({ patente, result: "no_data", note: body?.message ?? "sin body.data" })
        skipped++
        continue
      }

      const d = body.data
      const marca = d.model?.brand?.name ?? null
      const modelo = d.model?.name ?? null
      const año = d.year ? Number(d.year) : null
      const color = d.color ?? null
      const vin = d.vinNumber ?? null
      const mes = d.monthRT ?? null

      if (!mes) {
        detail.push({ patente, result: "api_sin_monthRT" })
        skipped++
        continue
      }

      // UPDATE primero — matchea cualquier fila existente con patente normalizada igual
      const upd: any[] = await db`
        UPDATE vehiculos SET
          mes_revision_tecnica = ${mes},
          marca = COALESCE(marca, ${marca}),
          modelo = COALESCE(modelo, ${modelo}),
          color = COALESCE(color, ${color}),
          año = COALESCE(año, ${año}),
          vin = COALESCE(vin, ${vin}),
          patente = ${patente},
          updated_at = NOW()
        WHERE UPPER(REGEXP_REPLACE(patente, '[^A-Za-z0-9]', '', 'g')) = ${patente}
        RETURNING id
      `

      if (upd.length === 0) {
        // No existía → INSERT con patente limpia
        await db`
          INSERT INTO vehiculos (patente, marca, modelo, color, año, vin, mes_revision_tecnica)
          VALUES (${patente}, ${marca}, ${modelo}, ${color}, ${año}, ${vin}, ${mes})
        `
      }

      updated++
      detail.push({ patente, result: "updated", note: mes })
    } catch (e: any) {
      failed++
      errors.push({ patente, error: e?.message ?? "error desconocido" })
      detail.push({ patente, result: "exception", note: e?.message ?? "error" })
    }

    await sleep(1500)
  }

  return NextResponse.json({
    total: patentes.length,
    updated,
    skipped,
    failed,
    dedupe: { merged: dedupeMerged, deleted: dedupeDeleted },
    errors: errors.slice(0, 10),
    detail,
  })
}
