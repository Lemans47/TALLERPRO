import { NextResponse } from "next/server"
import { getServicios, updateServicio } from "@/lib/database"
import { getPresupuestos, updatePresupuesto } from "@/lib/database"

function unwrap(v: any): any {
  let val = v
  while (typeof val === "string" && val) {
    try { val = JSON.parse(val) } catch { break }
  }
  return val
}

export async function POST() {
  try {
    const [servicios, presupuestos] = await Promise.all([getServicios(), getPresupuestos()])
    const results: string[] = []

    for (const s of servicios) {
      const needsFix =
        typeof s.cobros === "string" ||
        typeof s.costos === "string" ||
        typeof s.piezas_pintura === "string" ||
        typeof s.observaciones_checkboxes === "string"

      if (needsFix) {
        await updateServicio(s.id, {
          cobros: unwrap(s.cobros),
          costos: unwrap(s.costos),
          piezas_pintura: unwrap(s.piezas_pintura),
          observaciones_checkboxes: unwrap(s.observaciones_checkboxes),
        })
        results.push(`servicio ${s.patente} (${s.cliente}) fixed`)
      }
    }

    for (const p of presupuestos) {
      const needsFix =
        typeof p.cobros === "string" ||
        typeof p.costos === "string" ||
        typeof p.piezas_pintura === "string"

      if (needsFix) {
        await updatePresupuesto(p.id, {
          cobros: unwrap(p.cobros),
          costos: unwrap(p.costos),
          piezas_pintura: unwrap(p.piezas_pintura),
        })
        results.push(`presupuesto ${p.patente} (${p.cliente}) fixed`)
      }
    }

    return NextResponse.json({ fixed: results.length, records: results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
