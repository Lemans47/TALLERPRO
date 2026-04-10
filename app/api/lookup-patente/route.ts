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

    // 1. Buscar en caché local (DB)
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

    // 2. Llamar a GetAPI.cl
    const apiKey = process.env.GETAPI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API Key no configurada" }, { status: 500 })
    }

    const externalRes = await fetch(`https://chile.getapi.cl/v1/vehicles/plate/${patente}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10000),
    })

    if (externalRes.status === 404 || externalRes.status === 422) {
      return NextResponse.json({ error: "Patente no encontrada" }, { status: 404 })
    }
    if (externalRes.status === 429) {
      return NextResponse.json({ error: "Límite de consultas alcanzado" }, { status: 429 })
    }
    if (!externalRes.ok) {
      return NextResponse.json({ error: "Error consultando API de patentes" }, { status: 502 })
    }

    const body = await externalRes.json()
    if (!body.success || !body.data) {
      return NextResponse.json({ error: "Patente no encontrada" }, { status: 404 })
    }

    // 3. Normalizar respuesta de GetAPI.cl
    const d = body.data
    const marca = d.model?.brand?.name ?? null
    const modelo = d.model?.name ?? null
    const año = d.year ? Number(d.year) : null
    const color = d.color ?? null
    const vin = d.vinNumber ?? null

    // 4. Guardar en caché (DB)
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
