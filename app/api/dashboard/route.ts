import { NextResponse } from "next/server"
import { getServiciosByMonth, getGastosByMonth, getEmpleados, getActiveServicios } from "@/lib/database"
import { safeDivide, safeCalculateMargin, calculateAbsorptionRate } from "@/lib/utils"

function computeKpis(
  servicios: Awaited<ReturnType<typeof getServiciosByMonth>>,
  gastos: Awaited<ReturnType<typeof getGastosByMonth>>,
  empleados: Awaited<ReturnType<typeof getEmpleados>>,
) {
  // Helper: parsea campo JSONB que puede llegar como string o array ya parseado
  function parseJsonbArray<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[]
    if (typeof raw === "string" && raw) {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  // Base: todos los servicios del mes con monto asignado (igual que "Facturado del Mes" en el dashboard)
  const serviciosConMonto = servicios.filter((s) => Number(s.monto_total_sin_iva || 0) > 0)
  const serviciosFinalizadosCount = servicios.filter((s) =>
    ["Cerrado/Pagado", "Entregado", "Por Cobrar"].includes(s.estado),
  ).length

  // Ingresos netos (sin IVA)
  const ingresoNeto = serviciosConMonto.reduce((sum, sv) => sum + Number(sv.monto_total_sin_iva || 0), 0)

  // Costos directos desde JSONB costos[], excluyendo "materiales pintura" (evita doble conteo)
  const costosDirectos = serviciosConMonto.reduce((sum, sv) => {
    const costos = parseJsonbArray<{ descripcion?: string; monto?: number }>(sv.costos)
    return (
      sum +
      costos
        .filter((c) => !String(c.descripcion || "").toLowerCase().includes("materiales pintura"))
        .reduce((s, c) => s + Number(c.monto || 0), 0)
    )
  }, 0)

  // Gastos operativos: excluir "Sueldos" de tabla gastos y usar sueldo_base de empleados activos
  const gastosTabla = gastos
    .filter((g) => g.categoria !== "Sueldos")
    .reduce((s, g) => s + Number(g.monto || 0), 0)

  const sueldosComprometidos = (empleados as { activo: boolean; sueldo_base: number }[])
    .filter((e) => e.activo)
    .reduce((s, e) => s + Number(e.sueldo_base || 0), 0)

  const gastosOperativos = gastosTabla + sueldosComprometidos

  // Ingresos de mano de obra: cobros excl. "repuestos" + piezas_pintura
  const ingresosManoObra = serviciosConMonto.reduce((sum, sv) => {
    const cobros = parseJsonbArray<{ categoria?: string; monto?: number }>(sv.cobros)
    const laborCobros = cobros
      .filter((c) => c.categoria !== "repuestos")
      .reduce((s, c) => s + Number(c.monto || 0), 0)

    const piezas = parseJsonbArray<{ precio?: number }>(sv.piezas_pintura)
    const laborPiezas = piezas.reduce((s, p) => s + Number(p.precio || 0), 0)

    return sum + laborCobros + laborPiezas
  }, 0)

  const utilidadNeta = ingresoNeto - costosDirectos - gastosOperativos
  const costoTotal = costosDirectos + gastosOperativos
  const count = serviciosConMonto.length

  const margenPct = safeCalculateMargin(ingresoNeto, costosDirectos + gastosOperativos)
  const roi = safeDivide(utilidadNeta, costoTotal) * 100
  const ingresoPromedio = safeDivide(ingresoNeto, count)
  const costoPromedio = safeDivide(costoTotal, count)
  const tasaAbsorcion = calculateAbsorptionRate(ingresosManoObra, gastosOperativos)

  return {
    ingresoNeto,
    costosDirectos,
    gastosOperativos,
    utilidadNeta,
    margenPct,
    ingresoPromedio,
    costoPromedio,
    roi,
    serviciosFinalizados: serviciosFinalizadosCount,
    tasaAbsorcion,
    ingresosManoObra,
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
