import { NextResponse } from "next/server"
import postgres from "postgres"

function getSQL() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!connectionString) throw new Error("Database connection string not found")
  return postgres(connectionString, { ssl: "require", max: 1, prepare: false })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim().toUpperCase()

    if (!q || q.length < 3) {
      return NextResponse.json([])
    }

    const db = getSQL()

    // Busca servicios anteriores con esa patente y devuelve datos únicos del vehículo y cliente
    const rows = await db`
      SELECT DISTINCT ON (patente)
        patente, marca, modelo, color, año, kilometraje, cliente, telefono,
        fecha_ingreso
      FROM servicios
      WHERE UPPER(patente) LIKE ${`%${q}%`}
      ORDER BY patente, fecha_ingreso DESC
      LIMIT 8
    `

    await db.end()
    return NextResponse.json(rows)
  } catch (error) {
    console.error("buscar-patente error:", error)
    return NextResponse.json([])
  }
}
