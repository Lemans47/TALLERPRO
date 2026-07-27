import { roundMoney, extraerIvaIncluido } from "@/lib/utils"
import { parseJsonbArray } from "@/lib/reportes/kpis"

/**
 * Regla única de reconciliación de pagos de un servicio.
 *
 * ─── Contrato de unidades ────────────────────────────────────────────────────
 * `anticipo`, `saldo_pendiente` y `abonos[].monto` son BRUTOS (IVA incluido):
 * son caja efectivamente recibida, y es lo que se le imprime al cliente en el
 * recibo (lib/pdf-recibo.ts). `monto_total` también es bruto; `monto_total_sin_iva`
 * es neto. NUNCA sumar un campo bruto dentro de un agregado neto (los KPI de
 * ingresos usan `monto_total_sin_iva`).
 *
 * ─── Invariantes ─────────────────────────────────────────────────────────────
 *   anticipo        = Σ abonos[].monto
 *   saldo_pendiente = max(0, monto_total − anticipo)
 *   estado cerrado  ⇒ los abonos cubren el monto_total (⇒ saldo 0)
 *
 * Antes esto se mantenía sólo en el cliente, en dos lugares que divergían
 * (el dropdown de estado de services-table escribía `anticipo`/`saldo_pendiente`
 * sin tocar `abonos`, y el Select del formulario sólo agregaba el abono en la
 * transición no-cerrado → cerrado). El resultado era un servicio "Cerrado/Pagado"
 * con deuda viva, invisible en todas las pantallas de cobranza. Ahora la regla
 * vive acá y la aplica el servidor en cada escritura (lib/database.ts).
 *
 * Módulo puro: sin acceso a BD y sin React, para poder usarlo en el servidor y
 * en la UI (la UI lo usa para previsualizar el abono antes de guardar).
 */

export interface Abono {
  fecha: string // "YYYY-MM-DD"
  monto: number
  /** true si lo generó el cierre automático (no un pago tecleado por el usuario). */
  auto?: boolean
}

/** Normaliza el jsonb `abonos` a un array tipado, redondeando los montos. */
export function parseAbonos(raw: unknown): Abono[] {
  return parseJsonbArray<any>(raw)
    .map((a) => ({
      fecha: String(a?.fecha ?? ""),
      monto: roundMoney(Number(a?.monto ?? 0)),
      ...(a?.auto ? { auto: true as const } : {}),
    }))
    .filter((a) => Number.isFinite(a.monto))
}

/** Única definición de "anticipo": la suma del historial de abonos. */
export function sumAbonos(abonos: unknown): number {
  return roundMoney(parseAbonos(abonos).reduce((s, a) => s + a.monto, 0))
}

/** Neto contenido en un monto bruto de caja. Nombra la intención del `/1.19`. */
export function netoDesdeBruto(montoBruto: number, tieneIva: boolean): number {
  const bruto = Number(montoBruto) || 0
  if (!tieneIva) return roundMoney(bruto)
  return roundMoney(bruto - extraerIvaIncluido(bruto))
}

export interface ReconciliarInput {
  /** Historial actual (jsonb crudo de la fila o array ya parseado). */
  abonos: unknown
  /** Monto total bruto a cobrar. */
  montoTotal: number
  /** Estado destino del servicio. */
  estado: string
  /** Nombres de estados de tipo `cerrado`. */
  estadosCerrado: Iterable<string>
  /** Nombres de estados de tipo `por_cobrar`. */
  estadosPorCobrar: Iterable<string>
  /** Estado `cerrado` al que promover cuando se salda (primero visible por orden). */
  estadoCerradoDestino?: string | null
  /** Fecha del abono automático, "YYYY-MM-DD" (hoyChile() en cliente, CURRENT_DATE en server). */
  hoy: string
}

export interface ReconciliarResult {
  abonos: Abono[]
  anticipo: number
  saldoPendiente: number
  estado: string
  /** El abono sintético agregado por el cierre, si hubo. */
  abonoAgregado: Abono | null
  /** true si el estado se promovió a cerrado por saldarse la deuda. */
  estadoPromovido: boolean
}

export function reconciliarPagos(input: ReconciliarInput): ReconciliarResult {
  const cerrado = new Set(input.estadosCerrado)
  const porCobrar = new Set(input.estadosPorCobrar)

  const montoTotal = roundMoney(Number(input.montoTotal) || 0)
  const abonos = parseAbonos(input.abonos)
  let estado = input.estado
  let abonoAgregado: Abono | null = null

  // 1. Cerrar siempre salda: si el destino es un estado cerrado y los abonos no
  //    cubren el total, se registra la diferencia como un abono real. Se evalúa
  //    en CADA escritura (no sólo en la transición), que es justo el hueco que
  //    dejaba el Select del formulario para un servicio ya cerrado.
  const sumaPrevia = abonos.reduce((s, a) => s + a.monto, 0)
  if (cerrado.has(estado) && montoTotal > 0 && sumaPrevia < montoTotal) {
    abonoAgregado = { fecha: input.hoy, monto: roundMoney(montoTotal - sumaPrevia), auto: true }
    abonos.push(abonoAgregado)
  }

  // 2. El sobrepago no se trunca: es plata recibida de verdad. Sólo el saldo
  //    se clampea a 0 (no existe "saldo negativo" en las pantallas de cobranza).
  const anticipo = roundMoney(abonos.reduce((s, a) => s + a.monto, 0))
  const saldoPendiente = Math.max(0, montoTotal - anticipo)

  // 3. Auto-cierre: sólo desde un estado `por_cobrar` (el trabajo ya se entregó).
  //    Un auto que sigue en el taller y pagó el 100% NO se cierra: su ingreso no
  //    debe contarse como cobrado hasta que se entregue.
  let estadoPromovido = false
  if (
    saldoPendiente === 0 &&
    montoTotal > 0 &&
    porCobrar.has(estado) &&
    input.estadoCerradoDestino
  ) {
    estado = input.estadoCerradoDestino
    estadoPromovido = true
  }

  return { abonos, anticipo, saldoPendiente, estado, abonoAgregado, estadoPromovido }
}

/**
 * ¿Esta fila viola alguna invariante? Sirve de tripwire permanente en la UI
 * (badge "Revisar pagos") y de base para las queries de auditoría.
 */
export function esInconsistente(s: {
  abonos?: unknown
  anticipo?: number | string | null
  saldo_pendiente?: number | string | null
  monto_total?: number | string | null
}): boolean {
  const anticipo = Number(s.anticipo || 0)
  const saldo = Number(s.saldo_pendiente || 0)
  const total = Number(s.monto_total || 0)
  if (anticipo !== sumAbonos(s.abonos)) return true
  if (saldo !== Math.max(0, total - anticipo)) return true
  return false
}
