import type { Servicio, Presupuesto, Gasto, PrecioPintura, PiezaPintura, FotoServicio, Cliente, Vehiculo, Empleado, AbonoEmpleado, EstadoServicio, EstadoTipo } from "./database"

// Patentes Chile — Boostr.cl
export interface VehiculoLookup {
  patente: string
  marca?: string
  modelo?: string
  año?: number
  color?: string
  vin?: string
  mes_revision_tecnica?: string
  fromCache?: boolean
}

export async function lookupPatente(patente: string): Promise<VehiculoLookup | null> {
  const cleanPatente = patente.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  const res = await fetch(`/api/lookup-patente?patente=${encodeURIComponent(cleanPatente)}`)
  if (!res.ok) return null
  return res.json()
}

// Dashboard
const DASHBOARD_TIMEOUT_MS = 60_000
export class DashboardTimeoutError extends Error {
  constructor() {
    super(`La carga del dashboard excedió ${DASHBOARD_TIMEOUT_MS / 1000} segundos`)
    this.name = "DashboardTimeoutError"
  }
}

export async function fetchDashboardData(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<{ servicios: Servicio[]; gastos: Gasto[]; empleados: Empleado[]; serviciosActivos: Servicio[]; abonosMes: AbonoEmpleado[]; kpis: any; entregadosMes: number; serviciosFacturadosMes: Servicio[]; facturasPendientes: Servicio[]; serviciosPendientesCobro: Servicio[]; gastosPendientesPago: Gasto[] }> {
  const params = new URLSearchParams({ year: String(year), month: String(month) })
  // Timeout cliente. Las queries con LATERAL jsonb_array_elements pueden ser
  // lentas y la latencia Chile→Supabase agrega 200-500ms por roundtrip. 60s
  // es suficientemente generoso para el primer load (cache frío).
  const timeoutCtrl = new AbortController()
  const timeoutId = setTimeout(() => timeoutCtrl.abort(new DashboardTimeoutError()), DASHBOARD_TIMEOUT_MS)
  const onExternalAbort = () => timeoutCtrl.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) timeoutCtrl.abort(signal.reason)
    else signal.addEventListener("abort", onExternalAbort, { once: true })
  }
  try {
    const res = await fetch(`/api/dashboard?${params}`, { cache: "no-store", signal: timeoutCtrl.signal })
    if (!res.ok) throw new Error("Error fetching dashboard data")
    return await res.json()
  } catch (err: any) {
    // Si abortó por timeout interno, lanzar el error tipado para que la UI muestre mensaje específico
    if (err?.name === "AbortError" && timeoutCtrl.signal.reason instanceof DashboardTimeoutError) {
      throw timeoutCtrl.signal.reason
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
    if (signal) signal.removeEventListener("abort", onExternalAbort)
  }
}

// Histórico de pintura — 6 meses de estimado vs real (MO + materiales).
export interface PinturaHistoricoRow {
  mes: string // YYYY-MM
  piezas: number
  mo_estimada: number
  mo_real: number
  mat_estimado: number
  mat_real: number
}

export async function fetchPinturaHistorico(): Promise<{ historico: PinturaHistoricoRow[] }> {
  const res = await fetch("/api/pintura-historico", { cache: "no-store" })
  if (!res.ok) throw new Error("Error fetching pintura histórico")
  return res.json()
}

// Chart data — agregados por mes (últimos 6 meses) calculados en SQL.
export interface ChartMonthlyRow {
  mes: string // YYYY-MM
  facturado: number
  cobrado: number
  costos_internos: number
  gastos_operativos: number
  sueldos_comprometidos: number
  count_servicios: number
}

// Deduplicación: si dos componentes (RevenueChart + AverageTicketChart) se montan a la vez,
// comparten la misma promesa en vuelo en lugar de hacer dos requests.
let chartDataInFlight: Promise<{ monthlyData: ChartMonthlyRow[] }> | null = null

export async function fetchChartData(): Promise<{ monthlyData: ChartMonthlyRow[] }> {
  if (chartDataInFlight) return chartDataInFlight
  chartDataInFlight = (async () => {
    try {
      const res = await fetch("/api/chart")
      if (!res.ok) throw new Error("Error fetching chart data")
      return await res.json()
    } finally {
      chartDataInFlight = null
    }
  })()
  return chartDataInFlight
}

// Servicios
export async function fetchServicios(year?: number, month?: number): Promise<Servicio[]> {
  const params = year && month ? `?year=${year}&month=${month}` : ""
  const res = await fetch(`/api/servicios${params}`)
  if (!res.ok) throw new Error("Error fetching servicios")
  return res.json()
}

// Servicios activos (cualquier mes) para mostrar como "pendientes historicos"
// junto con los del mes en la pantalla de Servicios. Filtra server-side por
// estado in (En Cola, En Proceso, ...) -- reemplaza al antiguo getAll() que
// traia todo el historial y filtraba en JS.
export async function fetchServiciosActivos(): Promise<Servicio[]> {
  const res = await fetch(`/api/servicios?activos=1`)
  if (!res.ok) throw new Error("Error fetching servicios activos")
  return res.json()
}

export async function createServicioApi(data: Partial<Servicio>): Promise<Servicio> {
  const res = await fetch("/api/servicios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Error creating servicio")
  return res.json()
}

export async function updateServicioApi(id: string, data: Partial<Servicio>): Promise<Servicio> {
  const res = await fetch("/api/servicios", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error("Error updating servicio")
  return res.json()
}

export async function deleteServicioApi(id: string): Promise<void> {
  const res = await fetch(`/api/servicios?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting servicio")
}

// Presupuestos
export async function fetchPresupuestos(year?: number, month?: number): Promise<Presupuesto[]> {
  const params = year && month ? `?year=${year}&month=${month}` : ""
  const res = await fetch(`/api/presupuestos${params}`)
  if (!res.ok) throw new Error("Error fetching presupuestos")
  return res.json()
}

export async function fetchPresupuestosNoLeidos(): Promise<Presupuesto[]> {
  const res = await fetch(`/api/presupuestos?no_leidas=1`, { cache: "no-store" })
  if (!res.ok) throw new Error("Error fetching presupuestos no leidos")
  return res.json()
}

export async function marcarPresupuestoLeido(id: string): Promise<void> {
  const res = await fetch(`/api/presupuestos/${id}/leer`, { method: "POST" })
  if (!res.ok) throw new Error("Error marking presupuesto as read")
}

export async function createPresupuestoApi(data: Partial<Presupuesto>): Promise<Presupuesto> {
  const res = await fetch("/api/presupuestos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Error creating presupuesto")
  return res.json()
}

export async function updatePresupuestoApi(id: string, data: Partial<Presupuesto>): Promise<Presupuesto> {
  const res = await fetch("/api/presupuestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error("Error updating presupuesto")
  return res.json()
}

export async function deletePresupuestoApi(id: string): Promise<void> {
  const res = await fetch(`/api/presupuestos?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting presupuesto")
}

export async function convertToServicioApi(id: string): Promise<any> {
  const res = await fetch("/api/presupuestos", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error("Error converting presupuesto")
  return res.json()
}

// Gastos
export async function fetchGastos(year?: number, month?: number): Promise<Gasto[]> {
  const params = year && month ? `?year=${year}&month=${month}` : ""
  const res = await fetch(`/api/gastos${params}`)
  if (!res.ok) throw new Error("Error fetching gastos")
  return res.json()
}

export async function createGastoApi(data: Partial<Gasto>): Promise<Gasto> {
  const res = await fetch("/api/gastos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Error creating gasto")
  return res.json()
}

export async function updateGastoApi(id: string, data: Partial<Gasto>): Promise<Gasto> {
  const res = await fetch("/api/gastos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error("Error updating gasto")
  return res.json()
}

export async function deleteGastoApi(id: string): Promise<void> {
  const res = await fetch(`/api/gastos?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting gasto")
}

// Precios Pintura - Solo el precio global
export async function fetchPrecioPintura(): Promise<PrecioPintura | null> {
  const res = await fetch("/api/precios-pintura")
  if (!res.ok) throw new Error("Error fetching precio pintura")
  return res.json()
}

export async function updatePrecioPinturaApi(precio_por_pieza: number): Promise<PrecioPintura> {
  const res = await fetch("/api/precios-pintura", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ precio_por_pieza }),
  })
  if (!res.ok) throw new Error("Error updating precio pintura")
  return res.json()
}

// Piezas Pintura - Lista de piezas
export async function fetchPiezasPintura(): Promise<PiezaPintura[]> {
  const res = await fetch("/api/piezas-pintura")
  if (!res.ok) throw new Error("Error fetching piezas pintura")
  return res.json()
}

export async function createPiezaPinturaApi(nombre: string, cantidad_piezas?: number): Promise<PiezaPintura> {
  const res = await fetch("/api/piezas-pintura", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, cantidad_piezas: cantidad_piezas || 1 }),
  })
  if (!res.ok) throw new Error("Error creating pieza pintura")
  return res.json()
}

export async function updatePiezaPinturaApi(id: string, cantidad_piezas: number): Promise<PiezaPintura> {
  const res = await fetch("/api/piezas-pintura", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, cantidad_piezas }),
  })
  if (!res.ok) throw new Error("Error updating pieza pintura")
  return res.json()
}

export async function deletePiezaPinturaApi(id: string): Promise<void> {
  const res = await fetch(`/api/piezas-pintura?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting pieza pintura")
}

// Estados de Servicio (configurables)
export async function fetchEstadosServicio(): Promise<EstadoServicio[]> {
  const res = await fetch("/api/estados-servicio")
  if (!res.ok) throw new Error("Error fetching estados")
  return res.json()
}

export async function createEstadoServicioApi(nombre: string, tipo: EstadoTipo, orden?: number, color?: string): Promise<EstadoServicio> {
  const res = await fetch("/api/estados-servicio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, tipo, orden, color }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error creando estado")
  return data
}

export async function updateEstadoServicioApi(
  id: string,
  patch: { nombre?: string; tipo?: EstadoTipo; orden?: number; visible?: boolean; color?: string },
): Promise<EstadoServicio> {
  const res = await fetch("/api/estados-servicio", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error actualizando estado")
  return data
}

export type DeleteEstadoConflict = { error: "HAS_SERVICIOS"; count: number; estado: string; message: string }

export async function deleteEstadoServicioApi(
  id: string,
  migrarA?: string,
): Promise<{ success: true } | DeleteEstadoConflict> {
  const url = migrarA
    ? `/api/estados-servicio?id=${id}&migrarA=${encodeURIComponent(migrarA)}`
    : `/api/estados-servicio?id=${id}`
  const res = await fetch(url, { method: "DELETE" })
  const data = await res.json()
  if (res.status === 409 && data?.error === "HAS_SERVICIOS") return data as DeleteEstadoConflict
  if (!res.ok) throw new Error(data.error || "Error eliminando estado")
  return { success: true }
}

// Clientes
export async function fetchClientes(): Promise<Cliente[]> {
  const res = await fetch("/api/clientes")
  if (!res.ok) throw new Error("Error fetching clientes")
  return res.json()
}

export async function fetchVehiculosConCliente(): Promise<(Vehiculo & { cliente?: Cliente })[]> {
  const res = await fetch("/api/clientes?withVehiculos=1")
  if (!res.ok) throw new Error("Error fetching vehiculos")
  return res.json()
}

export async function createClienteApi(data: Partial<Cliente>): Promise<Cliente> {
  const res = await fetch("/api/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Error creating cliente")
  return res.json()
}

export async function updateClienteApi(id: string, data: Partial<Cliente>): Promise<Cliente> {
  const res = await fetch("/api/clientes", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error("Error updating cliente")
  return res.json()
}

export async function deleteClienteApi(id: string): Promise<void> {
  const res = await fetch(`/api/clientes?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting cliente")
}

// Empleados
export async function fetchEmpleados() {
  const res = await fetch("/api/empleados")
  if (!res.ok) throw new Error("Error fetching empleados")
  return res.json()
}

export async function createEmpleadoApi(data: { nombre: string; rut?: string; cargo?: string; sueldo_base: number }) {
  const res = await fetch("/api/empleados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error("Error creating empleado")
  return res.json()
}

export async function updateEmpleadoApi(id: string, data: object) {
  const res = await fetch("/api/empleados", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) })
  if (!res.ok) throw new Error("Error updating empleado")
  return res.json()
}

export async function deleteEmpleadoApi(id: string) {
  const res = await fetch(`/api/empleados?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting empleado")
}

export async function fetchAbonosEmpleados(year: number, month: number) {
  const res = await fetch(`/api/pagos-empleados?year=${year}&month=${month}`)
  if (!res.ok) throw new Error("Error fetching abonos")
  return res.json()
}

export async function createAbonoApi(data: object) {
  const res = await fetch("/api/pagos-empleados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error("Error creating abono")
  return res.json()
}

export async function deleteAbonoApi(id: string) {
  const res = await fetch(`/api/pagos-empleados?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting abono")
}

export type { Servicio, Presupuesto, Gasto, PrecioPintura, PiezaPintura, FotoServicio, Cliente, Vehiculo, Empleado, AbonoEmpleado, EstadoServicio, EstadoTipo } from "./database"

export const api = {
  empleados: {
    getAll: fetchEmpleados,
    create: createEmpleadoApi,
    update: updateEmpleadoApi,
    delete: deleteEmpleadoApi,
  },
  abonos: {
    getByMonth: fetchAbonosEmpleados,
    create: createAbonoApi,
    delete: deleteAbonoApi,
  },
  clientes: {
    getAll: fetchClientes,
    getVehiculosConCliente: fetchVehiculosConCliente,
    create: createClienteApi,
    update: updateClienteApi,
    delete: deleteClienteApi,
  },
  dashboard: {
    getData: fetchDashboardData,
  },
  chart: {
    getData: fetchChartData,
  },
  servicios: {
    getAll: fetchServicios,
    getByMonth: fetchServicios,
    getActivos: fetchServiciosActivos,
    create: createServicioApi,
    update: updateServicioApi,
    delete: deleteServicioApi,
  },
  presupuestos: {
    getAll: fetchPresupuestos,
    getByMonth: fetchPresupuestos,
    getNoLeidos: fetchPresupuestosNoLeidos,
    marcarLeido: marcarPresupuestoLeido,
    create: createPresupuestoApi,
    update: updatePresupuestoApi,
    delete: deletePresupuestoApi,
    convertToServicio: convertToServicioApi,
  },
  gastos: {
    getAll: fetchGastos,
    getByMonth: fetchGastos,
    create: createGastoApi,
    update: updateGastoApi,
    delete: deleteGastoApi,
  },
  precioPintura: {
    get: fetchPrecioPintura,
    update: updatePrecioPinturaApi,
  },
  piezasPintura: {
    getAll: fetchPiezasPintura,
    create: createPiezaPinturaApi,
    update: updatePiezaPinturaApi,
    delete: deletePiezaPinturaApi,
  },
  estadosServicio: {
    getAll: fetchEstadosServicio,
    create: createEstadoServicioApi,
    update: updateEstadoServicioApi,
    delete: deleteEstadoServicioApi,
  },
  proveedores: {
    getAll: fetchProveedores,
    create: createProveedorApi,
    update: updateProveedorApi,
    delete: deleteProveedorApi,
  },
  plantillasServicio: {
    getAll: fetchPlantillasServicio,
    create: createPlantillaServicioApi,
    delete: deletePlantillaServicioApi,
  },
}

// ── Proveedores ───────────────────────────────────────────────────────────────
async function fetchProveedores() {
  const res = await fetch("/api/proveedores")
  if (!res.ok) throw new Error("Error cargando proveedores")
  return res.json()
}

async function createProveedorApi(data: object) {
  const res = await fetch("/api/proveedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error("Error creando proveedor")
  return res.json()
}

async function updateProveedorApi(data: object) {
  const res = await fetch("/api/proveedores", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error("Error actualizando proveedor")
  return res.json()
}

async function deleteProveedorApi(id: string) {
  const res = await fetch(`/api/proveedores?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error eliminando proveedor")
}


// ── Plantillas de Servicio ────────────────────────────────────────────────────
async function fetchPlantillasServicio() {
  const res = await fetch("/api/plantillas-servicio")
  if (!res.ok) throw new Error("Error cargando plantillas")
  return res.json()
}

async function createPlantillaServicioApi(data: { nombre: string; cobros: any; costos: any }) {
  const res = await fetch("/api/plantillas-servicio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
  if (!res.ok) throw new Error("Error creando plantilla")
  return res.json()
}

async function deletePlantillaServicioApi(id: string) {
  const res = await fetch(`/api/plantillas-servicio?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error eliminando plantilla")
}
