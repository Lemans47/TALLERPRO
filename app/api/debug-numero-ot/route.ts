import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export async function GET() {
  const db = getSQL()

  try {
    const [counts]: any[] = await db`
      SELECT
        (SELECT COUNT(*) FROM servicios)::int AS total,
        (SELECT COUNT(*) FROM servicios WHERE numero_ot IS NULL)::int AS sin_numero,
        (SELECT COUNT(*) FROM servicios WHERE numero_ot IS NOT NULL)::int AS con_numero,
        (SELECT MAX(numero_ot) FROM servicios)::int AS max_numero
    `

    const [seqInfo]: any[] = await db`
      SELECT last_value::int AS last_value, is_called
      FROM servicios_numero_ot_seq
    `

    const duplicados: any[] = await db`
      SELECT numero_ot, COUNT(*)::int AS cantidad, ARRAY_AGG(id ORDER BY created_at) AS ids
      FROM servicios
      WHERE numero_ot IS NOT NULL
      GROUP BY numero_ot
      HAVING COUNT(*) > 1
      ORDER BY numero_ot DESC
    `

    const ultimos: any[] = await db`
      SELECT id, numero_ot, patente, cliente, marca, modelo, fecha_ingreso, created_at
      FROM servicios
      ORDER BY created_at DESC
      LIMIT 20
    `

    const chevrolet: any[] = await db`
      SELECT id, numero_ot, patente, cliente, marca, modelo, estado, fecha_ingreso, created_at
      FROM servicios
      WHERE patente ILIKE '%LGSD72%' OR cliente ILIKE '%SANTA GEMA%'
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      counts,
      seqInfo,
      duplicados,
      ultimos,
      chevrolet,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error", stack: e?.stack }, { status: 500 })
  }
}
