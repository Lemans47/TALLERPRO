import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST() {
  const apiKey = process.env.GETAPI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "API Key no configurada" }, { status: 500 })
  }

  const db = getSQL()

  try {
    await db`ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS mes_revision_tecnica TEXT`
  } catch {}

  // Patentes únicas de servicios cuyo vehículo no tiene mes_revision_tecnica
  const rows: any[] = await db`
    SELECT DISTINCT UPPER(TRIM(s.patente)) AS patente
    FROM servicios s
    LEFT JOIN vehiculos v
      ON UPPER(TRIM(v.patente)) = UPPER(TRIM(s.patente))
    WHERE v.mes_revision_tecnica IS NULL
      AND s.patente IS NOT NULL
      AND LENGTH(TRIM(s.patente)) >= 4
  `

  const patentes = rows.map((r) => String(r.patente).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()).filter(Boolean)

  let updated = 0
  let skipped = 0
  let failed = 0
  const errors: { patente: string; error: string }[] = []

  for (const patente of patentes) {
    try {
      const res = await fetch(`https://chile.getapi.cl/v1/vehicles/plate/${patente}`, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(10000),
      })

      if (res.status === 429) {
        errors.push({ patente, error: "Límite de consultas alcanzado — abortando" })
        failed++
        break
      }

      if (!res.ok) {
        skipped++
        continue
      }

      const body = await res.json()
      if (!body?.success || !body?.data) {
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
        skipped++
        continue
      }

      await db`
        INSERT INTO vehiculos (patente, marca, modelo, color, año, vin, mes_revision_tecnica)
        VALUES (${patente}, ${marca}, ${modelo}, ${color}, ${año}, ${vin}, ${mes})
        ON CONFLICT (patente) DO UPDATE SET
          marca = COALESCE(EXCLUDED.marca, vehiculos.marca),
          modelo = COALESCE(EXCLUDED.modelo, vehiculos.modelo),
          color = COALESCE(EXCLUDED.color, vehiculos.color),
          año = COALESCE(EXCLUDED.año, vehiculos.año),
          vin = COALESCE(EXCLUDED.vin, vehiculos.vin),
          mes_revision_tecnica = COALESCE(EXCLUDED.mes_revision_tecnica, vehiculos.mes_revision_tecnica),
          updated_at = NOW()
      `
      updated++
    } catch (e: any) {
      failed++
      errors.push({ patente, error: e?.message ?? "error desconocido" })
    }

    await sleep(400)
  }

  return NextResponse.json({
    total: patentes.length,
    updated,
    skipped,
    failed,
    errors: errors.slice(0, 10),
  })
}
