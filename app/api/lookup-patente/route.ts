import { NextResponse } from "next/server"
import { getVehiculoByPatente } from "@/lib/database"
import postgres from "postgres"

function getSQL() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!connectionString) throw new Error("Database connection string not found")
  return postgres(connectionString, { ssl: "require", max: 2, prepare: false })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPatente = searchParams.get("patente") ?? ""
    const patente = rawPatente.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

    if (!patente || patente.length < 4) {
      return NextResponse.json({ error: "Patente inválida" }, { status: 400 })
    }

    // 1. Buscar en DB primero (caché) — retorna si ya tiene marca al menos
    const vehiculoEnDB = await getVehiculoByPatente(patente)
    if (vehiculoEnDB?.marca) {
      return NextResponse.json({
        patente: vehiculoEnDB.patente,
        marca: vehiculoEnDB.marca,
        modelo: vehiculoEnDB.modelo,
        año: vehiculoEnDB.año ? Number(vehiculoEnDB.año) : null,
        color: vehiculoEnDB.color,
        vin: vehiculoEnDB.vin,
        fromCache: true,
      })
    }

    // 2. Llamar a la API de Boostr.cl
    // Endpoint: GET https://api.boostr.cl/vehicle/{patente}.json
    const apiKey = process.env.BOOSTR_API_KEY
    const headers: Record<string, string> = { Accept: "application/json" }
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }

    const externalRes = await fetch(`https://api.boostr.cl/vehicle/${patente}.json`, {
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (externalRes.status === 429) {
      return NextResponse.json({ error: "Límite de consultas alcanzado, intenta en unos segundos" }, { status: 429 })
    }

    if (!externalRes.ok) {
      return NextResponse.json({ error: "Error consultando API de patentes" }, { status: 502 })
    }

    // 3. Boostr devuelve { status: "success"|"error", data: {...} }
    const body = await externalRes.json()

    if (body.status === "error" || !body.data) {
      // Codes: V-01 falta patente, V-02 no encontrada, V-04 inválida
      return NextResponse.json({ error: "Patente no encontrada" }, { status: 404 })
    }

    const d = body.data
    // Boostr free: make, model, year, type, engine
    // Boostr paid: además chasis/vin, color, gas_type, kilometers, etc.
    const marca = d.make ?? null
    const modelo = d.model ?? null
    const año = d.year ? Number(d.year) : null
    const color = d.color ?? null
    const vin = d.vin ?? d.chasis ?? null

    // 4. Guardar en vehiculos con upsert para futuros lookups (caché local)
    if (marca) {
      const db = getSQL()
      await db`
        INSERT INTO vehiculos (patente, marca, modelo, color, año, vin)
        VALUES (${patente}, ${marca}, ${modelo}, ${color}, ${año}, ${vin})
        ON CONFLICT (patente) DO UPDATE SET
          marca = COALESCE(EXCLUDED.marca, vehiculos.marca),
          modelo = COALESCE(EXCLUDED.modelo, vehiculos.modelo),
          color = COALESCE(EXCLUDED.color, vehiculos.color),
          año = COALESCE(EXCLUDED.año, vehiculos.año),
          vin = COALESCE(EXCLUDED.vin, vehiculos.vin),
          updated_at = NOW()
      `
      await db.end()
    }

    return NextResponse.json({ patente, marca, modelo, año, color, vin, fromCache: false })
  } catch (error: any) {
    console.error("[lookup-patente] error:", error)
    if (error?.name === "TimeoutError") {
      return NextResponse.json({ error: "Timeout consultando API de patentes" }, { status: 504 })
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
