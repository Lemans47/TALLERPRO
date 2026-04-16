import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export async function POST(request: Request) {
  try {
    const { tarifa } = await request.json()
    if (!tarifa || tarifa <= 0) {
      return NextResponse.json({ error: "Tarifa inválida" }, { status: 400 })
    }

    const sql = getSQL()

    // Actualizar servicios que tienen piezas de pintura pero mano_obra_pintura = 0
    const result = await sql`
      UPDATE servicios
      SET mano_obra_pintura = ${tarifa},
          updated_at = NOW()
      WHERE (mano_obra_pintura IS NULL OR mano_obra_pintura = 0)
        AND piezas_pintura IS NOT NULL
        AND piezas_pintura::text != '[]'
        AND piezas_pintura::text != 'null'
    `

    // También actualizar presupuestos
    const result2 = await sql`
      UPDATE presupuestos
      SET mano_obra_pintura = ${tarifa},
          updated_at = NOW()
      WHERE (mano_obra_pintura IS NULL OR mano_obra_pintura = 0)
        AND piezas_pintura IS NOT NULL
        AND piezas_pintura::text != '[]'
        AND piezas_pintura::text != 'null'
    `

    return NextResponse.json({
      servicios_actualizados: result.count,
      presupuestos_actualizados: result2.count,
      tarifa,
    })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json({ error: "Error en migración" }, { status: 500 })
  }
}
