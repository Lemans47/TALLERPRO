import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Financial Utilities ──────────────────────────────────────────────────────

/** Rounds to nearest integer (pesos chilenos: sin decimales). Guards NaN/Infinity. */
export function roundMoney(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0
  return Math.round(n)
}

/** Division segura: retorna `fallback` (default 0) si denominador es 0, NaN o Infinity. */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || !isFinite(denominator) || isNaN(denominator)) return fallback
  const result = numerator / denominator
  return isFinite(result) ? result : fallback
}

/**
 * Margen de ganancia: ((ingresos - costos) / ingresos) * 100
 * - ingresos=0, costos=0  → 0
 * - ingresos=0, costos>0  → -100 (pérdida total sin ingresos)
 */
export function safeCalculateMargin(ingresos: number, costos: number): number {
  if (ingresos === 0) return costos > 0 ? -100 : 0
  return safeDivide(ingresos - costos, ingresos) * 100
}

export interface IvaBreakdown {
  base: number
  ivaAmount: number
  total: number
}

/**
 * Desglose explícito de IVA (Chile 19% por defecto).
 * Orden matemático: base → ivaAmount → total.
 */
export function calculateIVA(base: number, applyIVA: boolean, rate = 0.19): IvaBreakdown {
  const ivaAmount = applyIVA ? roundMoney(base * rate) : 0
  return { base, ivaAmount, total: base + ivaAmount }
}

/**
 * Tasa de Absorción: qué porcentaje de los gastos fijos operativos cubre el ingreso por mano de obra.
 * Fórmula: (ingresosManoObra / gastosOperativos) * 100
 */
export function calculateAbsorptionRate(laborRevenue: number, fixedExpenses: number): number {
  return safeDivide(laborRevenue, fixedExpenses) * 100
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

/** Formatea una fecha a d/m/a (DD/MM/YYYY). Acepta Date, string ISO o "YYYY-MM-DD". */
export function formatFechaDMA(value: Date | string | null | undefined): string {
  if (!value) return ""
  if (typeof value === "string") {
    const raw = value.substring(0, 10)
    const [yr, m, d] = raw.split("-")
    if (yr && m && d) return `${d}/${m}/${yr}`
    return raw
  }
  const d = String(value.getDate()).padStart(2, "0")
  const m = String(value.getMonth() + 1).padStart(2, "0")
  const y = value.getFullYear()
  return `${d}/${m}/${y}`
}
