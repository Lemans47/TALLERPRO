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

    // 1. Buscar en DB primero (caché)
    const vehiculoEnDB = await getVehiculoByPatente(patente)
    if (vehiculoEnDB?.vin) {
      return NextResponse.json({
        patente: vehiculoEnDB.patente,
        marca: vehiculoEnDB.marca,
        modelo: vehiculoEnDB.modelo,
        año: vehiculoEnDB.año,
        color: vehiculoEnDB.color,
        vin: vehiculoEnDB.vin,
        fromCache: true,
      })
    }

    // 2. Llamar a la API externa de Patentes Chile
    const apiKey = process.env.PATENTES_CHILE_API_KEY
    const apiUrl = process.env.PATENTES_CHILE_API_URL ?? "https://api.patentechile.com"

    if (!apiKey) {
      return NextResponse.json({ error: "API Key no configurada" }, { status: 500 })
    }

    const externalRes = await fetch(`${apiUrl}/patente/${patente}`, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      // Timeout de 10 segundos
      signal: AbortSignal.timeout(10000),
    })

    if (externalRes.status === 404 || externalRes.status === 422) {
      return NextResponse.json({ error: "Patente no encontrada" }, { status: 404 })
    }

    if (!externalRes.ok) {
      return NextResponse.json({ error: "Error consultando API externa" }, { status: 502 })
    }

    const apiData = await externalRes.json()

    // 3. Normalizar respuesta — distintos proveedores usan distintos nombres de campo
    const marca = apiData.marca ?? apiData.brand ?? null
    const modelo = apiData.modelo ?? apiData.model ?? null
    const color = apiData.color ?? null
    const año = apiData.año ?? apiData.anio ?? apiData.year ?? null
    const vin = apiData.vin ?? apiData.chasis ?? apiData.nro_vin ?? apiData.numero_vin ?? null

    // 4. Guardar en vehiculos con upsert para futuros lookups
    const db = getSQL()
    await db`
      INSERT INTO vehiculos (patente, marca, modelo, color, año, vin)
      VALUES (${patente}, ${marca}, ${modelo}, ${color}, ${año ? Number(año) : null}, ${vin})
      ON CONFLICT (patente) DO UPDATE SET
        marca = COALESCE(EXCLUDED.marca, vehiculos.marca),
        modelo = COALESCE(EXCLUDED.modelo, vehiculos.modelo),
        color = COALESCE(EXCLUDED.color, vehiculos.color),
        año = COALESCE(EXCLUDED.año, vehiculos.año),
        vin = COALESCE(EXCLUDED.vin, vehiculos.vin),
        updated_at = NOW()
    `
    await db.end()

    return NextResponse.json({
      patente,
      marca,
      modelo,
      año: año ? Number(año) : null,
      color,
      vin,
      fromCache: false,
    })
  } catch (error: any) {
    console.error("[lookup-patente] error:", error)
    if (error?.name === "TimeoutError") {
      return NextResponse.json({ error: "Timeout consultando API de patentes" }, { status: 504 })
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
