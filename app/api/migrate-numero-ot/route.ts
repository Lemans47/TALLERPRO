import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export async function POST() {
  try {
    const sql = getSQL()

    await sql`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS numero_ot INTEGER`
    await sql`CREATE SEQUENCE IF NOT EXISTS servicios_numero_ot_seq`

    const maxRow = await sql`SELECT COALESCE(MAX(numero_ot), 0)::int AS max FROM servicios`
    const currentMax = Number(maxRow[0]?.max || 0)

    if (currentMax > 0) {
      await sql`SELECT setval('servicios_numero_ot_seq', ${currentMax})`
    }

    const updated = await sql`
      UPDATE servicios s
      SET numero_ot = sub.new_ot
      FROM (
        SELECT id, nextval('servicios_numero_ot_seq')::int AS new_ot
        FROM (
          SELECT id
          FROM servicios
          WHERE numero_ot IS NULL
          ORDER BY fecha_ingreso ASC, created_at ASC
        ) ordered
      ) sub
      WHERE s.id = sub.id
      RETURNING s.id
    `

    const finalMaxRow = await sql`SELECT COALESCE(MAX(numero_ot), 0)::int AS max FROM servicios`
    const finalMax = Number(finalMaxRow[0]?.max || 0)
    if (finalMax > 0) {
      await sql`SELECT setval('servicios_numero_ot_seq', ${finalMax})`
    }

    return NextResponse.json({
      backfilled: updated.length,
      max_numero_ot: finalMax,
    })
  } catch (error: any) {
    console.error("migrate-numero-ot error:", error)
    return NextResponse.json({ error: error?.message || "Error en migración" }, { status: 500 })
  }
}
