// Módulo centralizado de cálculo de KPIs del taller.
// Esta es la ÚNICA fuente de verdad de cómo se calcula cada métrica.
// Tanto /api/dashboard como /reportes deben consumir este archivo.
//
// Reglas de diseño:
// - Funciones puras (no acceden a DB). Reciben datos crudos y devuelven KPIs.
// - Cada KPI documenta su fórmula en comentario. Si cambia la definición, se cambia aquí
//   y se propaga a todo el sistema, evitando que dashboard y /reportes muestren números distintos.

import type { Servicio, Gasto, Empleado, AbonoEmpleado } from "../database"
import { extraerIvaIncluido, safeDivide, safeCalculateMargin, calculateAbsorptionRate } from "../utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parsea un campo JSONB de Postgres que puede llegar como string ya doble-encoded o como array nativo. */
export function parseJsonbArray<T = any>(raw: unknown): T[] {
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

/**
 * Filtro canónico para items de `costos[]` que cuentan como costos directos reales.
 *
 * Reglas:
 *   - Items "Materiales pintura" (sea isAuto o no): EXCLUIDOS, porque ya están
 *     contabilizados en la tabla `gastos` categoría "Gastos de Pintura" con los
 *     montos reales de las compras del mes. Los materiales auto-calculados son
 *     solo referenciales.
 *   - Items "Mano de obra pintura" (isAuto): INCLUIDOS, porque representan lo que
 *     se le paga al pintor a trato (no es empleado con sueldo fijo, así que no
 *     está cubierto por Sueldos Devengados). Si en el futuro el pintor pasa a
 *     planilla con sueldo_base, este criterio debe revisarse.
 *   - Items normales: INCLUIDOS.
 */
export function isCostoRealItem(item: { isAuto?: boolean; descripcion?: string }): boolean {
  const desc = String(item.descripcion || "").toLowerCase()
  // Siempre excluir materiales pintura (los reales están en Gastos de Pintura)
  if (desc.includes("materiales pintura")) return false
  // Todo lo demás cuenta, incluida la MO pintura auto (pintor a trato)
  return true
}

/** Suma `monto` de los items que pasan `isCostoRealItem`. */
export function sumarCostosReales(costos: any): number {
  return parseJsonbArray(costos)
    .filter(isCostoRealItem)
    .reduce((sum: number, c: any) => sum + Number(c.monto || 0), 0)
}

/** ¿El servicio tiene IVA emitido? Acepta variantes legacy del campo `iva`. */
export function tieneIva(s: { iva?: string | null }): boolean {
  const v = String(s.iva || "").toLowerCase().trim()
  return v === "con" || v === "incluido"
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface KpisMes {
  // ── Ingresos ──
  /** Solo servicios cerrados/pagados. Dinero efectivamente cobrado por servicios. */
  ingresoCobrado: number
  /** Todos los servicios con monto > 0. Incluye por cobrar. Volumen producido. */
  ingresoFacturado: number
  /** Mantengo `ingresoNeto` apuntando a `ingresoFacturado` por compatibilidad con consumidores antiguos. */
  ingresoNeto: number

  // ── Costos directos (variables) ──
  /** Costos de servicios cerrados. Pareado con ingresoCobrado. */
  costosDirectosCobrados: number
  /** Costos de todos los servicios facturados. Pareado con ingresoFacturado. */
  costosDirectos: number

  // ── Gastos operacionales ──
  /** Suma de `gastos` excluyendo categoría "Sueldos". */
  gastosTabla: number
  /** Sueldos efectivamente abonados en el mes (cash flow). */
  sueldosPagados: number
  /** Sueldos devengados: `sueldo_base` de empleados activos (criterio contable). */
  sueldosDevengados: number
  /** gastosTabla + sueldosDevengados (criterio devengado). Lo usa la cascada y el punto de equilibrio. */
  gastosOperativos: number
  /** Desglose de gastos por categoría (sin sueldos). */
  gastosDesglose: { categoria: string; monto: number; items: { descripcion: string; monto: number }[] }[]

  // ── Resultado ──
  /** Margen de contribución sobre Facturado: ingresoFacturado - costosDirectos. */
  margenContribucion: number
  margenContribucionPct: number
  /** Resultado neto contable: margenContribucion - gastosOperativos. */
  utilidadNeta: number
  /** % utilidad neta sobre ingreso facturado. Devuelve null si no hubo ingresos. */
  margenPct: number | null

  // ── Promedios ──
  ingresoPromedio: number
  costoDirectoPromedio: number
  serviciosCount: number
  serviciosFinalizados: number

  // ── Punto de equilibrio ──
  /** Servicios necesarios para cubrir gastos fijos. null = no alcanzable (margen ≤ 0). */
  puntoEquilibrio: number | null

  // ── Indicadores de eficiencia ──
  /** Antiguamente "ROI". Cuánto de los gastos cubre la utilidad neta (en %). */
  coberturaGastos: number
  /** Tasa de absorción: ingresos mano de obra / gastos operativos. */
  tasaAbsorcion: number
  ingresosManoObra: number

  // ── IVA ──
  /** IVA débito por fecha de facturación (criterio SII). */
  ivaDebitoMes: number
  /** IVA crédito de gastos+costos con tipo_documento='factura'. */
  ivaCreditoMes: number
  /** ivaDebitoMes - ivaCreditoMes. */
  ivaNetoMes: number
}

export interface KpisInput {
  servicios: Servicio[]
  gastos: Gasto[]
  empleados: Empleado[]
  abonosMes?: AbonoEmpleado[]
  /** Servicios con `fecha_facturacion` dentro del mes (para IVA débito por criterio SII). */
  serviciosFacturadosMes?: Servicio[]
  /** Set de nombres de estados configurados como `cerrado` (no hardcodear "Cerrado/Pagado"). */
  estadosCerrado: Set<string>
  /** Set de nombres de estados configurados como `por_cobrar` o `cerrado` (= finalizados). */
  estadosFinalizados: Set<string>
}

// ─── Cálculo principal ────────────────────────────────────────────────────────

export function computeKpisMes(input: KpisInput): KpisMes {
  const {
    servicios,
    gastos,
    empleados,
    abonosMes = [],
    serviciosFacturadosMes = [],
    estadosCerrado,
    estadosFinalizados,
  } = input

  // ── Subconjuntos ──
  const serviciosFacturados = servicios.filter((s) => Number(s.monto_total_sin_iva || 0) > 0)
  const serviciosCerrados = servicios.filter((s) => estadosCerrado.has(s.estado))
  const serviciosFinalizadosCount = servicios.filter((s) => estadosFinalizados.has(s.estado)).length

  // ── Ingresos ──
  // Cobrado: solo cerrados/pagados (criterio conservador, refleja caja real).
  const ingresoCobrado = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)
  // Facturado: todos los servicios con monto > 0 (volumen producido, incluye por cobrar).
  const ingresoFacturado = serviciosFacturados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva || 0), 0)

  // ── Costos directos ──
  const costosDirectosCobrados = serviciosCerrados.reduce((sum, s) => sum + sumarCostosReales(s.costos), 0)
  const costosDirectos = serviciosFacturados.reduce((sum, s) => sum + sumarCostosReales(s.costos), 0)

  // ── Gastos operacionales ──
  const gastosNoSueldos = gastos.filter((g) => g.categoria !== "Sueldos")
  const gastosTabla = gastosNoSueldos.reduce((sum, g) => sum + Number(g.monto || 0), 0)
  const sueldosPagados = abonosMes.reduce((sum, a) => sum + Number(a.monto || 0), 0)
  const sueldosDevengados = empleados
    .filter((e) => e.activo)
    .reduce((sum, e) => sum + Number(e.sueldo_base || 0), 0)
  // Criterio devengado para reporte gerencial: gastos + sueldos completos del mes.
  const gastosOperativos = gastosTabla + sueldosDevengados

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

  // ── Resultado ──
  const margenContribucion = ingresoFacturado - costosDirectos
  const margenContribucionPct = safeCalculateMargin(ingresoFacturado, costosDirectos)
  const utilidadNeta = margenContribucion - gastosOperativos
  const margenPct = ingresoFacturado > 0
    ? safeDivide(utilidadNeta, ingresoFacturado) * 100
    : null

  // ── Promedios ──
  const serviciosCount = serviciosFacturados.length
  const ingresoPromedio = safeDivide(ingresoFacturado, serviciosCount)
  const costoDirectoPromedio = safeDivide(costosDirectos, serviciosCount)

  // ── Punto de equilibrio ──
  const margenContribucionPorServicio = safeDivide(margenContribucion, serviciosCount)
  const puntoEquilibrio = margenContribucionPorServicio > 0
    ? Math.ceil(safeDivide(gastosOperativos, margenContribucionPorServicio))
    : null

  // ── Indicadores de eficiencia ──
  const coberturaGastos = safeDivide(utilidadNeta, gastosOperativos) * 100

  // Ingresos de mano de obra: cobros excl. "repuestos" + piezas_pintura.precio.
  const ingresosManoObra = serviciosFacturados.reduce((sum, sv) => {
    const cobros = parseJsonbArray<{ categoria?: string; monto?: number }>(sv.cobros)
    const labor = cobros
      .filter((c) => c.categoria !== "repuestos")
      .reduce((s, c) => s + Number(c.monto || 0), 0)
    const piezas = parseJsonbArray<{ precio?: number }>(sv.piezas_pintura)
    const laborPiezas = piezas.reduce((s, p) => s + Number(p.precio || 0), 0)
    return sum + labor + laborPiezas
  }, 0)
  const tasaAbsorcion = calculateAbsorptionRate(ingresosManoObra, gastosOperativos)

  // ── IVA ──
  // Débito: por fecha_facturacion (criterio SII), no fecha_ingreso.
  const ivaDebitoMes = serviciosFacturadosMes.reduce(
    (sum, s) => sum + (Number(s.monto_total || 0) - Number(s.monto_total_sin_iva || 0)),
    0,
  )
  // Crédito: gastos y costos[] con tipo_documento='factura'.
  const ivaCreditoGastos = gastos
    .filter((g) => g.tipo_documento === "factura")
    .reduce((sum, g) => sum + extraerIvaIncluido(Number(g.monto || 0)), 0)
  const ivaCreditoCostos = servicios.reduce((sum, s) => {
    return sum + parseJsonbArray<any>(s.costos)
      .filter((c) => c.tipo_documento === "factura")
      .reduce((c, costo) => c + extraerIvaIncluido(Number(costo.monto || 0)), 0)
  }, 0)
  const ivaCreditoMes = ivaCreditoGastos + ivaCreditoCostos
  const ivaNetoMes = ivaDebitoMes - ivaCreditoMes

  return {
    ingresoCobrado,
    ingresoFacturado,
    ingresoNeto: ingresoFacturado, // alias por compatibilidad
    costosDirectosCobrados,
    costosDirectos,
    gastosTabla,
    sueldosPagados,
    sueldosDevengados,
    gastosOperativos,
    gastosDesglose,
    margenContribucion,
    margenContribucionPct,
    utilidadNeta,
    margenPct,
    ingresoPromedio,
    costoDirectoPromedio,
    serviciosCount,
    serviciosFinalizados: serviciosFinalizadosCount,
    puntoEquilibrio,
    coberturaGastos,
    tasaAbsorcion,
    ingresosManoObra,
    ivaDebitoMes,
    ivaCreditoMes,
    ivaNetoMes,
  }
}
