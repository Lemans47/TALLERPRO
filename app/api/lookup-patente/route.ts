import { NextResponse } from "next/server"
import { getVehiculoByPatente, getSQL } from "@/lib/database"

let migrated = false
async function ensureColumn(db: any) {
  if (migrated) return
  try {
    await db`ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS mes_revision_tecnica TEXT`
    migrated = true
  } catch { migrated = true }
}

// Endpoint usado por la página pública /solicitar-presupuesto para autocompletar
// marca/modelo desde el registro vehicular, por eso NO exige sesión. No expone
// datos de clientes (eso es /api/buscar-patente, que sí requiere sesión).
export async function GET(request: Request) {
  let cache: Record<string, unknown> | null = null
  try {
    const { searchParams } = new URL(request.url)
    const rawPatente = searchParams.get("patente") ?? ""
    const patente = rawPatente.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

    if (!patente || patente.length < 4) {
      return NextResponse.json({ error: "Patente inválida" }, { status: 400 })
    }

    // 1. Buscar en caché local (DB)
    // El caché sirve solo si ya trae VIN: las filas que creó la sincronización de
    // servicios (upsertClienteYVehiculo) tienen marca/modelo pero nunca VIN, y
    // cortar acá dejaba la patente sin VIN para siempre. Si falta, se consulta la
    // API y el resultado se cachea; si la API falla, se devuelve igual el caché.
    try {
      const vehiculoEnDB = await getVehiculoByPatente(patente)
      if (vehiculoEnDB?.marca) {
        cache = {
          patente: vehiculoEnDB.patente,
          marca: vehiculoEnDB.marca,
          modelo: vehiculoEnDB.modelo,
          año: vehiculoEnDB.año ? Number(vehiculoEnDB.año) : null,
          color: vehiculoEnDB.color,
          vin: vehiculoEnDB.vin ?? null,
          mes_revision_tecnica: vehiculoEnDB.mes_revision_tecnica ?? null,
          fromCache: true,
        }
        if (vehiculoEnDB.vin) return NextResponse.json(cache)
      }
    } catch (dbError) {
      console.error("[lookup-patente] error leyendo DB:", dbError)
    }

    // Cuando solo faltaba el VIN, un fallo de la API no es un error para el
    // usuario: ya teníamos marca/modelo y los devolvemos tal cual.
    const fallback = (res: NextResponse) => (cache ? NextResponse.json(cache) : res)

    // 2. Llamar a GetAPI.cl
    const apiKey = process.env.GETAPI_API_KEY
    if (!apiKey) {
      return fallback(NextResponse.json({ error: "API Key no configurada" }, { status: 500 }))
    }

    const externalRes = await fetch(`https://chile.getapi.cl/v1/vehicles/plate/${patente}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10000),
    })

    if (externalRes.status === 404 || externalRes.status === 422) {
      return fallback(NextResponse.json({ error: "Patente no encontrada" }, { status: 404 }))
    }
    if (externalRes.status === 429) {
      return fallback(NextResponse.json({ error: "Límite de consultas alcanzado" }, { status: 429 }))
    }
    if (!externalRes.ok) {
      return fallback(NextResponse.json({ error: "Error consultando API de patentes" }, { status: 502 }))
    }

    const body = await externalRes.json()
    if (!body.success || !body.data) {
      return fallback(NextResponse.json({ error: "Patente no encontrada" }, { status: 404 }))
    }

    // 3. Normalizar respuesta de GetAPI.cl
    const d = body.data
    const marca = d.model?.brand?.name ?? null
    const modelo = d.model?.name ?? null
    const año = d.year ? Number(d.year) : null
    const color = d.color ?? null
    const vin = d.vinNumber ?? null
    const mes_revision_tecnica = d.monthRT ?? null

    // 4. Guardar en caché (DB) — no bloquea la respuesta si falla
    if (marca) {
      try {
        const db = getSQL()
        await ensureColumn(db)
        // UPDATE + INSERT sobre patente_norm en vez de ON CONFLICT (patente):
        // `vehiculos` no tiene índice único sobre `patente`, así que el
        // ON CONFLICT fallaba con 42P10 y el catch de abajo se lo tragaba —
        // por eso el VIN que devolvía la API nunca llegaba a quedar cacheado.
        // patente_norm es la columna generada e indexada (misma convención que
        // upsertClienteYVehiculo).
        const actualizados = await db`
          UPDATE vehiculos SET
            marca = COALESCE(${marca}, marca),
            modelo = COALESCE(${modelo}, modelo),
            color = COALESCE(${color}, color),
            año = COALESCE(${año}, año),
            vin = COALESCE(${vin}, vin),
            mes_revision_tecnica = COALESCE(${mes_revision_tecnica}, mes_revision_tecnica),
            updated_at = NOW()
          WHERE patente_norm = ${patente}
          RETURNING id
        `
        if (actualizados.length === 0) {
          await db`
            INSERT INTO vehiculos (patente, marca, modelo, color, año, vin, mes_revision_tecnica)
            VALUES (${patente}, ${marca}, ${modelo}, ${color}, ${año}, ${vin}, ${mes_revision_tecnica})
          `
        }
      } catch (dbError) {
        console.error("[lookup-patente] error guardando en DB:", dbError)
      }
    }

    return NextResponse.json({ patente, marca, modelo, año, color, vin, mes_revision_tecnica, fromCache: false })
  } catch (error: any) {
    console.error("[lookup-patente] error:", error)
    if (cache) return NextResponse.json(cache)
    if (error?.name === "TimeoutError") {
      return NextResponse.json({ error: "Timeout consultando API de patentes" }, { status: 504 })
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
