import { NextResponse } from "next/server"
import { getVehiculoByPatente } from "@/lib/database"
import postgres from "postgres"

function getSQL() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!connectionString) throw new Error("Database connection string not found")
  return postgres(connectionString, { ssl: "require", max: 2, prepare: false })
}

// GET — buscar vehículo en caché local (DB)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPatente = searchParams.get("patente") ?? ""
    const patente = rawPatente.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

    if (!patente || patente.length < 4) {
      return NextResponse.json({ error: "Patente inválida" }, { status: 400 })
    }

    const vehiculo = await getVehiculoByPatente(patente)
    if (vehiculo?.marca) {
      return NextResponse.json({
        patente: vehiculo.patente,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        año: vehiculo.año ? Number(vehiculo.año) : null,
        color: vehiculo.color,
        vin: vehiculo.vin,
        fromCache: true,
      })
    }

    return NextResponse.json(null)
  } catch (error) {
    console.error("[lookup-patente GET] error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// POST — guardar datos de vehículo obtenidos desde Boostr (llamado desde el cliente)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const patente = (body.patente ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

    if (!patente || !body.marca) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    }

    const marca = body.marca ?? null
    const modelo = body.modelo ?? null
    const año = body.año ? Number(body.año) : null
    const color = body.color ?? null
    const vin = body.vin ?? null

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

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[lookup-patente POST] error:", error)
    return NextResponse.json({ error: "Error guardando vehículo" }, { status: 500 })
  }
}
