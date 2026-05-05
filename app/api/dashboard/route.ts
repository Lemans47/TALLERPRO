import { NextResponse } from "next/server"
import {
  getServiciosByMonth,
  getGastosByMonth,
  getEmpleados,
  getActiveServicios,
  getAbonosByMonth,
  getEntregadosByMonth,
  getServiciosFacturadosByMes,
  getFacturasPendientesEmitir,
  getNombresEstadosByTipoMap,
  getServiciosPendientesCobro,
  getGastosPendientesPago,
} from "@/lib/database"
import { computeKpisMes } from "@/lib/reportes/kpis"

export const dynamic = "force-dynamic"
export const revalidate = 0

// ── Cache en memoria del proceso ────────────────────────────────────────────
// Las queries del dashboard son pesadas (latencia Chile→Supabase + 11 queries
// paralelas). Recargas repetidas en 30s devuelven la misma respuesta sin pegar
// a la DB. Si el usuario edita un servicio y vuelve, espera ≤30s para refrescar.
// Cache es global para sobrevivir hot-reload de Next en dev.
declare global {
  // eslint-disable-next-line no-var
  var _dashboardCache: Map<string, { value: unknown; expires: number; inFlight?: Promise<unknown> }> | undefined
}
function getCache() {
  if (!global._dashboardCache) global._dashboardCache = new Map()
  return global._dashboardCache
}
const TTL_MS = 30_000

async function loadDashboardData(year: number, month: number) {
  // 11 queries paralelas; el pool de Postgres es max:20. Una sola query a
  // estados_servicio devuelve cerrado + por_cobrar agrupados por tipo, así
  // evitamos sumar una 12ª.
  const [
    servicios,
    gastos,
    empleados,
    serviciosActivos,
    abonosMes,
    entregadosMes,
    serviciosFacturadosMes,
    facturasPendientes,
    estadosMap,
    serviciosPendientesCobro,
    gastosPendientesPago,
  ] = await Promise.all([
    getServiciosByMonth(year, month),
    getGastosByMonth(year, month),
    getEmpleados(),
    getActiveServicios(),
    getAbonosByMonth(year, month),
    getEntregadosByMonth(year, month),
    getServiciosFacturadosByMes(year, month),
    getFacturasPendientesEmitir(),
    getNombresEstadosByTipoMap(["por_cobrar", "cerrado"]),
    getServiciosPendientesCobro(),
    getGastosPendientesPago(),
  ])
  const nombresCerrado = estadosMap.cerrado || []
  const nombresFinalizado = [...(estadosMap.cerrado || []), ...(estadosMap.por_cobrar || [])]

  const kpis = computeKpisMes({
    servicios,
    gastos,
    empleados,
    abonosMes,
    serviciosFacturadosMes,
    estadosCerrado: new Set(nombresCerrado),
    estadosFinalizados: new Set(nombresFinalizado),
  })

  return {
    servicios,
    gastos,
    empleados,
    serviciosActivos,
    abonosMes,
    kpis,
    entregadosMes: entregadosMes.length,
    serviciosFacturadosMes,
    facturasPendientes,
    serviciosPendientesCobro,
    gastosPendientesPago,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = Number.parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = Number.parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())
    const skipCache = searchParams.get("nocache") === "1"

    const cache = getCache()
    const key = `${year}-${month}`
    const now = Date.now()
    const hit = cache.get(key)

    // Cache hit válido y no se pidió nocache → devolver inmediato
    if (!skipCache && hit && hit.expires > now && !hit.inFlight) {
      return NextResponse.json(hit.value)
    }

    // Si ya hay un fetch en vuelo para este mes, compartir la promesa para
    // no disparar fetches duplicados cuando varios componentes piden a la vez.
    if (!skipCache && hit?.inFlight) {
      const value = await hit.inFlight
      return NextResponse.json(value)
    }

    // Lanzar fetch fresco. Guardar la promesa en cache para deduplicar requests concurrentes.
    const inFlight = loadDashboardData(year, month)
    cache.set(key, { value: null, expires: 0, inFlight })

    try {
      const value = await inFlight
      cache.set(key, { value, expires: now + TTL_MS })
      return NextResponse.json(value)
    } catch (err) {
      // CRÍTICO: si la promesa falla, INVALIDAR el cache para que el próximo
      // intento dispare un fetch nuevo en vez de esperar una promesa rechazada.
      cache.delete(key)
      throw err
    }
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json({ error: "Error loading dashboard data" }, { status: 500 })
  }
}
