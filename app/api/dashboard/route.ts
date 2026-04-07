import { NextResponse } from "next/server"
import { getServiciosByMonth, getGastosByMonth, getEmpleados, getActiveServicios } from "@/lib/database"

function computeKpis(
  servicios: Awaited<ReturnType<typeof getServiciosByMonth>>,
  gastos: Awaited<ReturnType<typeof getGastosByMonth>>,
  empleados: Awaited<ReturnType<typeof getEmpleados>>,
) {
  const ESTADOS_FINALIZADOS = ["Cerrado/Pagado", "Entregado", "Por Cobrar"]
  const finalizados = servicios.filter((s) => ESTADOS_FINALIZADOS.includes(s.estado))

  // Ingresos netos (sin IVA) de servicios finalizados
  const ingresoNeto = finalizados.reduce((sum, sv) => sum + Number(sv.monto_total_sin_iva || 0), 0)

  // Costos directos desde JSONB costos[], excluyendo "materiales pintura" (evita doble conteo con gastos de pintura)
  const costosDirectos = finalizados.reduce((sum, sv) => {
    const raw = sv.costos
    const costos: { descripcion?: string; monto?: number }[] = Array.isArray(raw)
      ? raw
      : (() => { try { const p = JSON.parse(raw as unknown as string); return Array.isArray(p) ? p : [] } catch { return [] } })()
    return (
      sum +
      costos
        .filter((c) => !String(c.descripcion || "").toLowerCase().includes("materiales pintura"))
        .reduce((s, c) => s + Number(c.monto || 0), 0)
    )
  }, 0)

  // Gastos operativos: excluir "Sueldos" de tabla gastos (los abonos ya crean esas filas)
  // y usar sueldo_base de empleados activos — misma lógica que revenue-chart.tsx
  const gastosTabla = gastos
    .filter((g) => g.categoria !== "Sueldos")
    .reduce((s, g) => s + Number(g.monto || 0), 0)

  const sueldosComprometidos = (empleados as { activo: boolean; sueldo_base: number }[])
    .filter((e) => e.activo)
    .reduce((s, e) => s + Number(e.sueldo_base || 0), 0)

  const gastosOperativos = gastosTabla + sueldosComprometidos

  const utilidadNeta = ingresoNeto - costosDirectos - gastosOperativos
  const margenPct = ingresoNeto > 0 ? (utilidadNeta / ingresoNeto) * 100 : 0
  const count = finalizados.length
  const ingresoPromedio = count > 0 ? ingresoNeto / count : 0
  const costoTotal = costosDirectos + gastosOperativos
  const costoPromedio = count > 0 ? costoTotal / count : 0
  const roi = costoTotal > 0 ? (utilidadNeta / costoTotal) * 100 : 0

  return {
    ingresoNeto,
    costosDirectos,
    gastosOperativos,
    utilidadNeta,
    margenPct,
    ingresoPromedio,
    costoPromedio,
    roi,
    serviciosFinalizados: count,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = Number.parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = Number.parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())

    const [servicios, gastos, empleados, serviciosActivos] = await Promise.all([
      getServiciosByMonth(year, month),
      getGastosByMonth(year, month),
      getEmpleados(),
      getActiveServicios(),
    ])

    const kpis = computeKpis(servicios, gastos, empleados)

    return NextResponse.json({ servicios, gastos, empleados, serviciosActivos, kpis })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json({ error: "Error loading dashboard data" }, { status: 500 })
  }
}
