import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"
import { requireRole } from "@/lib/auth-server"

export async function GET(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim().toUpperCase()

    if (!q || q.length < 3) {
      return NextResponse.json([])
    }

    const db = getSQL()

    // Busca servicios anteriores con esa patente y devuelve datos únicos del vehículo y cliente.
    // El VIN no es columna de `servicios`: se trae de `vehiculos` por patente_norm.
    const rows = await db`
      SELECT DISTINCT ON (s.patente)
        s.patente, s.marca, s.modelo, s.color, s.año, s.kilometraje, s.cliente, s.telefono,
        s.rut, s.domicilio, s.comuna,
        s.fecha_ingreso,
        v.vin
      FROM servicios s
      LEFT JOIN LATERAL (
        SELECT (ARRAY_REMOVE(ARRAY_AGG(vin ORDER BY updated_at DESC NULLS LAST), NULL))[1] AS vin
        FROM vehiculos
        WHERE patente_norm = s.patente_norm
      ) v ON true
      WHERE UPPER(s.patente) LIKE ${`%${q}%`}
      ORDER BY s.patente, s.fecha_ingreso DESC
      LIMIT 8
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error("buscar-patente error:", error)
    return NextResponse.json([])
  }
}
