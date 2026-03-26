// Sistema de almacenamiento local para servicios y gastos
// Usa localStorage para persistir datos en el navegador

export interface Servicio {
  id: string
  tipo: "presupuesto" | "servicio"
  patente: string
  marca?: string
  modelo?: string
  año?: number
  nombre_cliente: string
  telefono_cliente?: string
  fecha_ingreso: string
  estado:
    | "En Cola"
    | "En Proceso"
    | "Esperando Repuestos"
    | "En Reparación"
    | "Control de Calidad"
    | "Listo para Entrega"
    | "Entregado"
    | "Cerrado/Pagado"
  incluye_iva: boolean
  monto_total_sin_iva: number
  monto_iva: number
  monto_total_con_iva: number
  monto_pagado: number
  saldo_pendiente: number
  cantidad_piezas_pintura: number
  cobro_piezas_pintura: number
  cobro_desabolladura: number
  cobro_reparar: number
  cobro_repuestos: number
  cobro_mecanica: number
  cobro_otros: number
  cobro_total: number
  costo_piezas_pintura: number
  costo_desabolladura: number
  costo_reparar: number
  costo_repuestos: number
  costo_mecanica: number
  costo_otros: number
  costo_total: number
  margen_rentabilidad: number
  servicios_realizados: {
    pintura: boolean
    desabolladura: boolean
    reparar: boolean
    repuestos: boolean
    mecanica: boolean
    otros: boolean
  }
  observaciones?: string
  created_at: string
  updated_at: string
}

export interface Gasto {
  id: string
  fecha: string
  categoria: string
  descripcion: string
  monto: number
  created_at: string
  updated_at: string
}

// Funciones helper para cálculos
function calcularMontos(montoSinIva: number, incluye_iva: boolean) {
  const montoIva = incluye_iva ? Math.round(montoSinIva * 0.19) : 0
  const montoConIva = montoSinIva + montoIva
  return { montoIva, montoConIva }
}

function calcularMargen(cobroTotal: number, costoTotal: number) {
  if (cobroTotal === 0) return 0
  return ((cobroTotal - costoTotal) / cobroTotal) * 100
}

// SERVICIOS
export function getServicios(): Servicio[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem("servicios")
  const allServicios = data ? JSON.parse(data) : []
  return allServicios.filter((s: Servicio) => s.tipo === "servicio")
}

export function getPresupuestos(): Servicio[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem("servicios")
  const allServicios = data ? JSON.parse(data) : []
  return allServicios.filter((s: Servicio) => s.tipo === "presupuesto")
}

export function getAllServiciosAndPresupuestos(): Servicio[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem("servicios")
  return data ? JSON.parse(data) : []
}

export function getServicio(id: string): Servicio | null {
  const servicios = getAllServiciosAndPresupuestos()
  return servicios.find((s) => s.id === id) || null
}

export function createServicio(
  data: Omit<
    Servicio,
    | "id"
    | "tipo"
    | "monto_iva"
    | "monto_total_con_iva"
    | "monto_pagado"
    | "saldo_pendiente"
    | "cobro_total"
    | "costo_total"
    | "margen_rentabilidad"
    | "created_at"
    | "updated_at"
    | "servicios_realizados"
  >,
  tipo: "presupuesto" | "servicio" = "servicio",
): Servicio {
  const servicios = getAllServiciosAndPresupuestos()

  const { montoIva, montoConIva } = calcularMontos(data.monto_total_sin_iva, data.incluye_iva)

  const cobroTotal =
    data.cobro_piezas_pintura +
    data.cobro_desabolladura +
    data.cobro_reparar +
    data.cobro_repuestos +
    data.cobro_mecanica +
    data.cobro_otros

  const costoTotal =
    data.costo_piezas_pintura +
    data.costo_desabolladura +
    data.costo_reparar +
    data.costo_repuestos +
    data.costo_mecanica +
    data.costo_otros

  const margen = calcularMargen(cobroTotal, costoTotal)

  const nuevoServicio: Servicio = {
    ...data,
    id: crypto.randomUUID(),
    tipo,
    monto_iva: montoIva,
    monto_total_con_iva: montoConIva,
    monto_pagado: 0,
    saldo_pendiente: montoConIva,
    cobro_total: cobroTotal,
    costo_total: costoTotal,
    margen_rentabilidad: margen,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    servicios_realizados: {
      pintura: false,
      desabolladura: false,
      reparar: false,
      repuestos: false,
      mecanica: false,
      otros: false,
    },
  }

  servicios.push(nuevoServicio)
  localStorage.setItem("servicios", JSON.stringify(servicios))

  return nuevoServicio
}

export function convertirPresupuestoAServicio(id: string): Servicio | null {
  const servicios = getAllServiciosAndPresupuestos()
  const index = servicios.findIndex((s) => s.id === id)

  if (index === -1) return null

  const presupuesto = servicios[index]
  if (presupuesto.tipo !== "presupuesto") return null

  const servicioActualizado = {
    ...presupuesto,
    tipo: "servicio" as const,
    estado: "En Cola" as const,
    updated_at: new Date().toISOString(),
  }

  servicios[index] = servicioActualizado
  localStorage.setItem("servicios", JSON.stringify(servicios))

  return servicioActualizado
}

export function updateServicio(id: string, data: Partial<Servicio>): Servicio | null {
  const servicios = getAllServiciosAndPresupuestos()
  const index = servicios.findIndex((s) => s.id === id)

  if (index === -1) return null

  const servicioActualizado = {
    ...servicios[index],
    ...data,
    updated_at: new Date().toISOString(),
  }

  if (data.monto_total_sin_iva !== undefined || data.incluye_iva !== undefined) {
    const { montoIva, montoConIva } = calcularMontos(
      servicioActualizado.monto_total_sin_iva,
      servicioActualizado.incluye_iva,
    )
    servicioActualizado.monto_iva = montoIva
    servicioActualizado.monto_total_con_iva = montoConIva
    servicioActualizado.saldo_pendiente = montoConIva - servicioActualizado.monto_pagado
  }

  if (
    data.cobro_piezas_pintura !== undefined ||
    data.cobro_desabolladura !== undefined ||
    data.cobro_reparar !== undefined ||
    data.cobro_repuestos !== undefined ||
    data.cobro_mecanica !== undefined ||
    data.cobro_otros !== undefined ||
    data.costo_piezas_pintura !== undefined ||
    data.costo_desabolladura !== undefined ||
    data.costo_reparar !== undefined ||
    data.costo_repuestos !== undefined ||
    data.costo_mecanica !== undefined ||
    data.costo_otros !== undefined ||
    data.cantidad_piezas_pintura !== undefined
  ) {
    servicioActualizado.cobro_total =
      servicioActualizado.cobro_piezas_pintura +
      servicioActualizado.cobro_desabolladura +
      servicioActualizado.cobro_reparar +
      servicioActualizado.cobro_repuestos +
      servicioActualizado.cobro_mecanica +
      servicioActualizado.cobro_otros

    servicioActualizado.costo_total =
      servicioActualizado.costo_piezas_pintura +
      servicioActualizado.costo_desabolladura +
      servicioActualizado.costo_reparar +
      servicioActualizado.costo_repuestos +
      servicioActualizado.costo_mecanica +
      servicioActualizado.costo_otros

    servicioActualizado.margen_rentabilidad = calcularMargen(
      servicioActualizado.cobro_total,
      servicioActualizado.costo_total,
    )
  }

  servicios[index] = servicioActualizado
  localStorage.setItem("servicios", JSON.stringify(servicios))

  return servicioActualizado
}

export function updateEstadoServicio(id: string, nuevoEstado: Servicio["estado"]): Servicio | null {
  return updateServicio(id, { estado: nuevoEstado })
}

export function registrarPago(id: string, montoPago: number): Servicio | null {
  const servicio = getServicio(id)
  if (!servicio) return null

  const nuevoMontoPagado = servicio.monto_pagado + montoPago
  const nuevoSaldo = servicio.monto_total_con_iva - nuevoMontoPagado

  const nuevoEstado = nuevoSaldo === 0 ? "Cerrado/Pagado" : servicio.estado

  return updateServicio(id, {
    monto_pagado: nuevoMontoPagado,
    saldo_pendiente: nuevoSaldo,
    estado: nuevoEstado,
  })
}

export function deleteServicio(id: string): boolean {
  const servicios = getAllServiciosAndPresupuestos()
  const filtered = servicios.filter((s) => s.id !== id)

  if (filtered.length === servicios.length) return false

  localStorage.setItem("servicios", JSON.stringify(filtered))
  return true
}

export function deleteAllServicios(): boolean {
  if (typeof window === "undefined") return false
  localStorage.removeItem("servicios")
  return true
}

// GASTOS
export function getGastos(): Gasto[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem("gastos")
  return data ? JSON.parse(data) : []
}

export function getGasto(id: string): Gasto | null {
  const gastos = getGastos()
  return gastos.find((g) => g.id === id) || null
}

export function createGasto(data: Omit<Gasto, "id" | "created_at" | "updated_at">): Gasto {
  const gastos = getGastos()

  const nuevoGasto: Gasto = {
    ...data,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  gastos.push(nuevoGasto)
  localStorage.setItem("gastos", JSON.stringify(gastos))

  return nuevoGasto
}

export function updateGasto(id: string, data: Partial<Gasto>): Gasto | null {
  const gastos = getGastos()
  const index = gastos.findIndex((g) => g.id === id)

  if (index === -1) return null

  const gastoActualizado = {
    ...gastos[index],
    ...data,
    updated_at: new Date().toISOString(),
  }

  gastos[index] = gastoActualizado
  localStorage.setItem("gastos", JSON.stringify(gastos))

  return gastoActualizado
}

export function deleteGasto(id: string): boolean {
  const gastos = getGastos()
  const filtered = gastos.filter((g) => g.id !== id)

  if (filtered.length === gastos.length) return false

  localStorage.setItem("gastos", JSON.stringify(filtered))
  return true
}

export function deleteAllGastos(): boolean {
  if (typeof window === "undefined") return false
  localStorage.removeItem("gastos")
  return true
}

// KPIs DEL DASHBOARD
export function getDashboardKPIs() {
  const servicios = getServicios()
  const gastos = getGastos()

  const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")

  const ingresosTotalesSinIva = serviciosCerrados.reduce((sum, s) => sum + s.monto_total_sin_iva, 0)
  const ingresosTotalesConIva = serviciosCerrados.reduce((sum, s) => sum + s.monto_total_con_iva, 0)

  const gastosTotales = gastos.reduce((sum, g) => sum + g.monto, 0)

  const utilidadOperacional = ingresosTotalesSinIva - gastosTotales

  const margenPromedio =
    serviciosCerrados.length > 0
      ? serviciosCerrados.reduce((sum, s) => sum + s.margen_rentabilidad, 0) / serviciosCerrados.length
      : 0

  const totalPorCobrar = servicios.reduce((sum, s) => sum + s.saldo_pendiente, 0)

  const serviciosActivos = servicios.filter((s) => s.estado !== "Cerrado/Pagado").length
  const serviciosCerradosCount = serviciosCerrados.length

  const vehiculosIngresados = servicios.length

  return {
    ingresosTotalesSinIva,
    ingresosTotalesConIva,
    gastosTotales,
    utilidadOperacional,
    margenPromedio,
    totalPorCobrar,
    serviciosActivos,
    serviciosCerrados: serviciosCerradosCount,
    vehiculosIngresados,
  }
}

// Month filter helper functions
export function filterByMonth<T extends { fecha_ingreso?: string; fecha?: string }>(
  items: T[],
  selectedMonth: string,
): T[] {
  return items.filter((item) => {
    const fecha = item.fecha_ingreso || item.fecha
    if (!fecha) return false

    // Extract YYYY-MM from the date string
    const itemMonth = fecha.substring(0, 7)
    return itemMonth === selectedMonth
  })
}

export function getServiciosByMonth(month: string): Servicio[] {
  return filterByMonth(getServicios(), month)
}

export function getPresupuestosByMonth(month: string): Servicio[] {
  return filterByMonth(getPresupuestos(), month)
}

export function getGastosByMonth(month: string): Gasto[] {
  return filterByMonth(getGastos(), month)
}

export function getDashboardKPIsByMonth(month: string) {
  const servicios = getServiciosByMonth(month)
  const gastos = getGastosByMonth(month)

  const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")

  const ingresosTotalesSinIva = serviciosCerrados.reduce((sum, s) => sum + s.monto_total_sin_iva, 0)
  const ingresosTotalesConIva = serviciosCerrados.reduce((sum, s) => sum + s.monto_total_con_iva, 0)

  const gastosTotales = gastos.reduce((sum, g) => sum + g.monto, 0)

  const utilidadOperacional = ingresosTotalesSinIva - gastosTotales

  const margenPromedio =
    serviciosCerrados.length > 0
      ? serviciosCerrados.reduce((sum, s) => sum + s.margen_rentabilidad, 0) / serviciosCerrados.length
      : 0

  const totalPorCobrar = servicios.reduce((sum, s) => sum + s.saldo_pendiente, 0)

  const serviciosActivos = servicios.filter((s) => s.estado !== "Cerrado/Pagado").length
  const serviciosCerradosCount = serviciosCerrados.length

  const vehiculosIngresados = servicios.length

  return {
    ingresosTotalesSinIva,
    ingresosTotalesConIva,
    gastosTotales,
    utilidadOperacional,
    margenPromedio,
    totalPorCobrar,
    serviciosActivos,
    serviciosCerrados: serviciosCerradosCount,
    vehiculosIngresados,
  }
}

// Precio por pieza de pintura
export function getPrecioPiezaPintura(): number {
  if (typeof window === "undefined") return 0
  const precio = localStorage.getItem("precio_pieza_pintura")
  return precio ? Number.parseInt(precio) : 0
}

export function setPrecioPiezaPintura(precio: number): void {
  localStorage.setItem("precio_pieza_pintura", precio.toString())
}

// Costo por mano de obra por pieza de pintura
export function getCostoManoObraPiezaPintura(): number {
  if (typeof window === "undefined") return 0
  const costo = localStorage.getItem("costo_mano_obra_pieza_pintura")
  return costo ? Number.parseInt(costo) : 0
}

export function setCostoManoObraPiezaPintura(costo: number): void {
  localStorage.setItem("costo_mano_obra_pieza_pintura", costo.toString())
}

// WORKER MANAGEMENT
export interface Trabajador {
  id: string
  nombre: string
  sueldo_base: number
  activo: boolean
  created_at: string
  updated_at: string
}

export function getTrabajadores(): Trabajador[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem("trabajadores")
  return data ? JSON.parse(data) : []
}

export function getTrabajador(id: string): Trabajador | null {
  const trabajadores = getTrabajadores()
  return trabajadores.find((t) => t.id === id) || null
}

export function createTrabajador(data: Omit<Trabajador, "id" | "created_at" | "updated_at">): Trabajador {
  const trabajadores = getTrabajadores()

  const nuevoTrabajador: Trabajador = {
    ...data,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  trabajadores.push(nuevoTrabajador)
  localStorage.setItem("trabajadores", JSON.stringify(trabajadores))

  return nuevoTrabajador
}

export function updateTrabajador(id: string, data: Partial<Trabajador>): Trabajador | null {
  const trabajadores = getTrabajadores()
  const index = trabajadores.findIndex((t) => t.id === id)

  if (index === -1) return null

  const trabajadorActualizado = {
    ...trabajadores[index],
    ...data,
    updated_at: new Date().toISOString(),
  }

  trabajadores[index] = trabajadorActualizado
  localStorage.setItem("trabajadores", JSON.stringify(trabajadores))

  return trabajadorActualizado
}

export function deleteTrabajador(id: string): boolean {
  const trabajadores = getTrabajadores()
  const filtered = trabajadores.filter((t) => t.id !== id)

  if (filtered.length === trabajadores.length) return false

  localStorage.setItem("trabajadores", JSON.stringify(filtered))
  return true
}

export function deleteAllData(): boolean {
  if (typeof window === "undefined") return false
  deleteAllServicios()
  deleteAllGastos()
  return true
}
