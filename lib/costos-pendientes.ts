// Helpers puros para el seguimiento pagado/pendiente de los "Costo Taller"
// por ítem de un servicio. El flag `pagado` vive dentro de cada elemento del
// JSONB `costos` (clave ausente o true = pagado, false = pendiente; ver
// service-form.tsx). Quedan fuera del seguimiento los ítems de pintura y los
// auto-generados: los materiales se controlan en la página de Gastos y la MO
// del pintor tiene su propio flujo.
//
// Reutilizado por: components/pending-costos-alert.tsx (dashboard) y
// components/services-table.tsx (chips del listado).

import { parseJsonbArray } from "@/lib/reportes/kpis"

export interface CostoItemPago {
  categoria?: string
  descripcion?: string
  monto?: number
  isAuto?: boolean
  pagado?: boolean
}

/** ¿Este ítem de costo participa del seguimiento pagado/pendiente? */
export function esCostoTrackeable(c: CostoItemPago): boolean {
  if (c.isAuto) return false
  if ((c.categoria || "") === "pintura") return false
  const desc = String(c.descripcion || "").toLowerCase()
  // Ítems auto de pintura legacy, anteriores al flag isAuto
  if (desc.includes("mano de obra pintura") || desc.includes("materiales pintura")) return false
  return Number(c.monto || 0) > 0
}

/** Ítems de costo pendientes de pago (trackeables con pagado === false). */
export function getCostosPendientes(costos: unknown): CostoItemPago[] {
  return parseJsonbArray<CostoItemPago>(costos).filter((c) => esCostoTrackeable(c) && c.pagado === false)
}

export interface ResumenPagosCostos {
  /** sin_costos = sin ítems trackeables; pendiente = al menos uno sin pagar; pagado = todos pagados */
  estado: "sin_costos" | "pendiente" | "pagado"
  cantidadPendiente: number
  totalPendiente: number
}

export function resumenPagosCostos(costos: unknown): ResumenPagosCostos {
  const trackeables = parseJsonbArray<CostoItemPago>(costos).filter(esCostoTrackeable)
  if (trackeables.length === 0) return { estado: "sin_costos", cantidadPendiente: 0, totalPendiente: 0 }
  const pendientes = trackeables.filter((c) => c.pagado === false)
  return {
    estado: pendientes.length > 0 ? "pendiente" : "pagado",
    cantidadPendiente: pendientes.length,
    totalPendiente: pendientes.reduce((sum, c) => sum + Number(c.monto || 0), 0),
  }
}
