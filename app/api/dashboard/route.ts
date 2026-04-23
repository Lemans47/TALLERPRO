import { NextResponse } from "next/server"
import { getServiciosByMonth, getGastosByMonth, getEmpleados, getActiveServicios, getAbonosByMonth, getEntregadosByMonth, getServiciosFacturadosByMes, getFacturasPendientesEmitir } from "@/lib/database"
import { safeDivide, safeCalculateMargin, calculateAbsorptionRate } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

function computeKpis(
  servicios: Awaited<ReturnType<typeof getServiciosByMonth>>,
  gastos: Awaited<ReturnType<typeof getGastosByMonth>>,
  empleados: Awaited<ReturnType<typeof getEmpleados>>,
  abonosMes?: Awaited<ReturnType<typeof getAbonosByMonth>>,
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

  // Costos directos desde JSONB costos[], excluyendo items auto-calculados de pintura (evita doble conteo)
  const costosDirectos = serviciosConMonto.reduce((sum, sv) => {
    const costos = parseJsonbArray<{ descripcion?: string; monto?: number; isAuto?: boolean }>(sv.costos)
    return (
      sum +
      costos
        .filter((c) => !c.isAuto)
        .reduce((s, c) => s + Number(c.monto || 0), 0)
    )
  }, 0)

  // Gastos operativos: excluir "Sueldos" de tabla gastos y usar sueldo_base de empleados activos
  const gastosNoSueldos = gastos.filter((g) => g.categoria !== "Sueldos")
  const gastosTabla = gastosNoSueldos.reduce((s, g) => s + Number(g.monto || 0), 0)

  // Desglose por categoría
  const gastosDesglose = Object.values(
    gastosNoSueldos.reduce<Record<string, { categoria: string; monto: number; items: { descripcion: string; monto: number }[] }>>(
      (acc, g) => {
        const cat = g.categoria || "Sin categoría"
        if (!acc[cat]) acc[cat] = { categoria: cat, monto: 0, items: [] }
        acc[cat].monto += Number(g.monto || 0)
        acc[cat].items.push({ descripcion: g.descripcion, monto: Number(g.monto || 0) })
        return acc
      },
      {},
    ),
  ).sort((a, b) => b.monto - a.monto)

  // sueldosComprometidos: sueldo_base proyectado (dashboard) o abonos reales del mes (reportes)
  const sueldosComprometidos = abonosMes
    ? abonosMes.reduce((s, a) => s + Number(a.monto || 0), 0)
    : (empleados as { activo: boolean; sueldo_base: number }[])
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

  const count = serviciosConMonto.length

  // Margen de contribución (ingresos - costos variables directos)
  const margenContribucion = ingresoNeto - costosDirectos
  const margenContribucionPct = safeCalculateMargin(ingresoNeto, costosDirectos)

  // Resultado neto (margen de contribución - gastos fijos)
  const utilidadNeta = margenContribucion - gastosOperativos

  // Punto de equilibrio en número de servicios
  const margenContribucionPorServicio = safeDivide(margenContribucion, count)
  const puntoEquilibrio = margenContribucionPorServicio > 0
    ? Math.ceil(safeDivide(gastosOperativos, margenContribucionPorServicio))
    : 0

  const margenPct = safeCalculateMargin(ingresoNeto, costosDirectos + gastosOperativos)
  const roi = safeDivide(utilidadNeta, gastosOperativos) * 100
  const ingresoPromedio = safeDivide(ingresoNeto, count)
  const costoDirectoPromedio = safeDivide(costosDirectos, count)
  const tasaAbsorcion = calculateAbsorptionRate(ingresosManoObra, gastosOperativos)

  return {
    ingresoNeto,
    costosDirectos,
    gastosOperativos,
    gastosTabla,
    gastosDesglose,
    sueldosComprometidos,
    margenContribucion,
    margenContribucionPct,
    utilidadNeta,
    margenPct,
    ingresoPromedio,
    costoDirectoPromedio,
    puntoEquilibrio,
    serviciosCount: count,
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

    const useAbonos = searchParams.get("useAbonos") === "true"

    const [servicios, gastos, empleados, serviciosActivos, abonosMes, entregadosMes, serviciosFacturadosMes, facturasPendientes] = await Promise.all([
      getServiciosByMonth(year, month),
      getGastosByMonth(year, month),
      getEmpleados(),
      getActiveServicios(),
      useAbonos ? getAbonosByMonth(year, month) : Promise.resolve(undefined),
      getEntregadosByMonth(year, month),
      getServiciosFacturadosByMes(year, month),
      getFacturasPendientesEmitir(),
    ])

    const kpis = computeKpis(servicios, gastos, empleados, abonosMes ?? undefined)

    return NextResponse.json({ servicios, gastos, empleados, serviciosActivos, kpis, entregadosMes: entregadosMes.length, serviciosFacturadosMes, facturasPendientes })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json({ error: "Error loading dashboard data" }, { status: 500 })
  }
}
