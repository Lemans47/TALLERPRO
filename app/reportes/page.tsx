"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Download, FileSpreadsheet, TrendingUp, TrendingDown, DollarSign,
  RefreshCw, Users, ArrowUpRight, ArrowDownRight, Minus, Receipt, Info,
  AlertCircle, Banknote,
} from "lucide-react"
import { ProfitabilityAnalysis } from "@/components/profitability-analysis"
import { useMonth } from "@/lib/month-context"
import { fetchDashboardData, fetchPinturaHistorico, type Servicio, type Gasto, type PinturaHistoricoRow } from "@/lib/api-client"
import type { AbonoEmpleado, Empleado } from "@/lib/database"
import { formatFechaDMA, extraerIvaIncluido } from "@/lib/utils"
import { useEstados } from "@/lib/estados"
import {
  parseJsonbArray, isCostoRealItem, sumarCostosReales, tieneIva,
  type KpisMes,
} from "@/lib/reportes/kpis"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

// Helper de formato chileno
const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`
const fmtPct = (n: number | null) => (n === null || !isFinite(n) ? "—" : `${n.toFixed(1)}%`)

// ── Paleta de marca para el PDF ──────────────────────────────────────────────
type RGB = [number, number, number]
const PDF_AZUL: RGB = [15, 56, 114]      // azul corporativo
const PDF_NAVY: RGB = [15, 23, 42]       // encabezados de tabla
const PDF_VERDE: RGB = [22, 163, 74]     // semáforo "bien"
const PDF_ROJO: RGB = [220, 38, 38]      // semáforo "atención"
const PDF_AMBAR: RGB = [217, 119, 6]     // por cobrar
const PDF_GRIS: RGB = [100, 100, 100]
const PDF_FILL: RGB = [241, 245, 249]    // relleno suave
const PDF_HEAD: RGB = [226, 232, 240]    // encabezados de tabla claros (para imprimir)

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Colores del desglose de gastos (torta). Categorías conocidas fijas; el resto
// rota por una paleta de respaldo.
const GASTO_COLORS: Record<string, string> = {
  "Gastos Fijos": "#1a4ed8",
  "Gastos de Pintura": "#f59e0b",
  "Gastos Misceláneos": "#8e9fc0",
}
const GASTO_FALLBACK = ["#0891b2", "#7c3aed", "#db2777", "#65a30d", "#ca8a04", "#475569"]

// Carga el logo del taller como PNG base64 (mismo patrón que lib/pdf-orden-trabajo.ts).
// Devuelve "" si falla, para degradar con elegancia.
async function loadLogoBase64(): Promise<string> {
  return await new Promise<string>((resolve) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const scale = 3
        const w = (img.width || 560) * scale
        const h = (img.height || 200) * scale
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/png"))
      } catch {
        resolve("")
      }
    }
    img.onerror = () => resolve("")
    img.src = "/logo-sarmiento.svg"
  })
}

// Serializa un <svg> de recharts (dentro de `container`) a PNG base64 para
// incrustarlo en el PDF. Mismo mecanismo canvas que el logo. Devuelve null si falla.
async function svgToPng(
  container: HTMLElement | null,
  scale = 2,
): Promise<{ url: string; w: number; h: number } | null> {
  if (!container) return null
  const svg = container.querySelector("svg")
  if (!svg) return null
  const w = Number(svg.getAttribute("width")) || svg.clientWidth || 520
  const h = Number(svg.getAttribute("height")) || svg.clientHeight || 320
  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(w))
  clone.setAttribute("height", String(h))
  const xml = new XMLSerializer().serializeToString(clone)
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml)
  return await new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = w * scale
        canvas.height = h * scale
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ url: canvas.toDataURL("image/png"), w, h })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Tooltip inline reusable: ícono "i" con texto explicativo
function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-muted-foreground hover:text-foreground"
          onClick={(e) => e.preventDefault()}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

// Tooltip propio para gráficos de dinero: evita el recorte del tooltip por
// defecto de recharts cuando los montos son grandes.
function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md whitespace-nowrap">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {fmtCLP(Number(p.value))}
        </p>
      ))}
    </div>
  )
}

interface DashboardResponse {
  servicios: Servicio[]
  gastos: Gasto[]
  empleados: Empleado[]
  abonosMes: AbonoEmpleado[]
  kpis: KpisMes
  serviciosFacturadosMes: Servicio[]
  serviciosPendientesCobro: Servicio[]
}

export default function ReportsPage() {
  const { selectedMonth } = useMonth()
  const { esCerrado, esPorCobrar } = useEstados()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Mes de comparación (por defecto el anterior)
  const prevMonth = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [selectedMonth])
  const [compMonth, setCompMonth] = useState(prevMonth)
  const [compData, setCompData] = useState<DashboardResponse | null>(null)
  const [compLoading, setCompLoading] = useState(false)
  // KPIs del mes anterior — se cargan secuencialmente DESPUÉS del mes actual
  // para no saturar el pool de Postgres (max:10) ejecutando 22 queries en paralelo.
  const [prevMonthKpis, setPrevMonthKpis] = useState<KpisMes | null>(null)

  // Cargar datos del mes seleccionado desde el endpoint centralizado
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      const res = await fetchDashboardData(year, month)
      setData(res as unknown as DashboardResponse)
      // Mes anterior en SEGUNDO request, no paralelo. Si falla no rompe nada.
      const prevDate = new Date(year, month - 2, 1)
      try {
        const prevRes = await fetchDashboardData(prevDate.getFullYear(), prevDate.getMonth() + 1)
        const prevK = (prevRes as any).kpis as KpisMes
        setPrevMonthKpis(prevK?.serviciosCount > 0 ? prevK : null)
      } catch {
        setPrevMonthKpis(null)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Cargar datos del mes comparado desde el MISMO endpoint para usar idénticas fórmulas
  const loadCompData = useCallback(async () => {
    setCompLoading(true)
    try {
      const [y, m] = compMonth.split("-").map(Number)
      const res = await fetchDashboardData(y, m)
      setCompData(res as unknown as DashboardResponse)
    } catch (e) {
      console.error(e)
    } finally {
      setCompLoading(false)
    }
  }, [compMonth])

  // ── Aliases sobre datos cargados ─────────────────────────────────────────────
  const servicios = data?.servicios ?? []
  const gastos = data?.gastos ?? []
  const kpis = data?.kpis
  const serviciosFacturadosMes = data?.serviciosFacturadosMes ?? []
  const serviciosPendientesCobro = data?.serviciosPendientesCobro ?? []

  // ── Encabezado del mes ───────────────────────────────────────────────────────
  const [selYear, selMonth] = selectedMonth.split("-").map(Number)
  const monthName = new Date(selYear, selMonth - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" })
  const [compYear, compMonthNum] = compMonth.split("-").map(Number)
  const compMonthName = new Date(compYear, compMonthNum - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" })

  // ── Resumen de Pintura (cliente, derivado de servicios JSONB) ───────────────
  const piezasResumen = useMemo(() => {
    return servicios.reduce<Record<string, { nombre: string; veces: number; unidades: number; ingresos: number }>>(
      (acc, s) => {
        parseJsonbArray<any>(s.piezas_pintura).forEach((p) => {
          const nombre = p.nombre || "Sin nombre"
          if (!acc[nombre]) acc[nombre] = { nombre, veces: 0, unidades: 0, ingresos: 0 }
          acc[nombre].veces += 1
          acc[nombre].unidades += Number(p.cantidad || 1)
          acc[nombre].ingresos += Number(p.precio || 0)
        })
        return acc
      },
      {},
    )
  }, [servicios])
  const piezasDetalle = useMemo(
    () => Object.values(piezasResumen).sort((a, b) => b.unidades - a.unidades),
    [piezasResumen],
  )
  const totalUnidadesPintura = piezasDetalle.reduce((s, p) => s + p.unidades, 0)
  const ingresosPiezas = piezasDetalle.reduce((s, p) => s + p.ingresos, 0)

  // ── Rentabilidad por categoría de servicio (cliente, derivado de JSONB) ─────
  const rentabilidadPorCategoria = useMemo(() => {
    const CATS = ["pintura", "desabolladura", "repuestos", "reparar", "mecanica", "desmontar", "otros"] as const
    const CAT_LABEL: Record<string, string> = {
      pintura: "Pintura", desabolladura: "Desabolladura", repuestos: "Repuestos",
      reparar: "Reparar", mecanica: "Mecánica", desmontar: "Desmontar", otros: "Otros",
    }
    const acc: Record<string, { cobros: number; costos: number }> = {}
    const get = (c: string) => (acc[c] ??= { cobros: 0, costos: 0 })
    for (const s of servicios) {
      parseJsonbArray<{ categoria?: string; monto?: number }>(s.cobros).forEach((c) => {
        get(c.categoria ?? "otros").cobros += Number(c.monto || 0)
      })
      parseJsonbArray<{ categoria?: string; monto?: number }>(s.costos).forEach((c) => {
        get(c.categoria ?? "otros").costos += Number(c.monto || 0)
      })
      // El ingreso de pintura proviene de las piezas pintadas, no de cobros[]
      parseJsonbArray<{ precio?: number }>(s.piezas_pintura).forEach((p) => {
        get("pintura").cobros += Number(p.precio || 0)
      })
    }
    return CATS.map((cat) => {
      const { cobros, costos } = acc[cat] ?? { cobros: 0, costos: 0 }
      const margen = cobros - costos
      return { cat, label: CAT_LABEL[cat], cobros, costos, margen, margenPct: cobros > 0 ? (margen / cobros) * 100 : null }
    })
      .filter((r) => r.cobros > 0 || r.costos > 0)
      .sort((a, b) => b.margen - a.margen)
  }, [servicios])
  const rentCatTotales = rentabilidadPorCategoria.reduce(
    (t, r) => ({ cobros: t.cobros + r.cobros, costos: t.costos + r.costos, margen: t.margen + r.margen }),
    { cobros: 0, costos: 0, margen: 0 },
  )
  const materialesPinturaItems = gastos.filter((g) => g.categoria === "Gastos de Pintura")
  const totalMaterialesPintura = materialesPinturaItems.reduce((s, g) => s + Number(g.monto || 0), 0)
  const costoPorUnidad = totalUnidadesPintura > 0 ? totalMaterialesPintura / totalUnidadesPintura : 0
  const margenPintura = ingresosPiezas > 0 ? ((ingresosPiezas - totalMaterialesPintura) / ingresosPiezas) * 100 : null

  // ── Comparativa estimado vs real (MO pintura y materiales) ──────────────────
  // Tarifa default si el servicio no tiene mano_obra_pintura cargada.
  const TARIFA_MO_PIEZA_DEFAULT = 24000

  // Detalle por servicio: piezas, tarifa, estimado calculado, real registrado, desviación.
  // Esto da una tabla expandible para ver dónde se ajustó la MO manualmente.
  const moPinturaPorServicio = useMemo(() => {
    return servicios
      .map((s) => {
        const piezas = parseJsonbArray<any>(s.piezas_pintura)
          .reduce((p, pp) => p + Number(pp.cantidad || 1), 0)
        const tarifaServicio = Number(s.mano_obra_pintura) || TARIFA_MO_PIEZA_DEFAULT
        const estimado = piezas * tarifaServicio
        const real = parseJsonbArray<any>(s.costos)
          .filter((c) => c.isAuto && String(c.descripcion || "").toLowerCase().includes("mano de obra pintura"))
          .reduce((acc: number, c: any) => acc + Number(c.monto || 0), 0)
        return {
          id: s.id,
          numero_ot: s.numero_ot,
          patente: s.patente,
          cliente: s.cliente,
          piezas,
          tarifa: tarifaServicio,
          estimado,
          real,
          diff: real - estimado,
        }
      })
      .filter((r) => r.piezas > 0 || r.real > 0)
  }, [servicios])

  const moPinturaEstimada = moPinturaPorServicio.reduce((s, r) => s + r.estimado, 0)
  const moPinturaReal = moPinturaPorServicio.reduce((s, r) => s + r.real, 0)
  const moPinturaConDiferencia = moPinturaPorServicio.filter((r) => Math.abs(r.diff) > 0)

  // Materiales estimados: items isAuto "materiales pintura" (referencial, calculado por piezas)
  const materialesEstimado = useMemo(() => {
    return servicios.reduce((sum, s) => {
      return sum + parseJsonbArray<any>(s.costos)
        .filter((c) => c.isAuto && String(c.descripcion || "").toLowerCase().includes("materiales pintura"))
        .reduce((acc: number, c: any) => acc + Number(c.monto || 0), 0)
    }, 0)
  }, [servicios])
  const desviacionMO = moPinturaReal - moPinturaEstimada
  const desviacionMat = totalMaterialesPintura - materialesEstimado
  const [showMoDetalle, setShowMoDetalle] = useState(false)

  // Refs a los gráficos ocultos que se capturan para el PDF gerencial.
  const pieChartRef = useRef<HTMLDivElement>(null)
  const barChartRef = useRef<HTMLDivElement>(null)

  // ── Histórico de pintura (6 meses) ───────────────────────────────────────────
  const [pinturaHistorico, setPinturaHistorico] = useState<PinturaHistoricoRow[]>([])
  useEffect(() => {
    fetchPinturaHistorico()
      .then((r) => setPinturaHistorico(r.historico))
      .catch(() => setPinturaHistorico([]))
  }, [])

  // ── Datos para gráficos del Resumen ─────────────────────────────────────────
  const gastosFijos = gastos.filter((g) => g.categoria === "Gastos Fijos").reduce((s, g) => s + Number(g.monto), 0)
  const gastosPinturaCat = gastos.filter((g) => g.categoria === "Gastos de Pintura").reduce((s, g) => s + Number(g.monto), 0)

  // Desglose de "lo que se gastó" en criterio DEVENGADO (gerencial). Se deriva de
  // kpis.gastosDesglose para cubrir TODAS las categorías (no solo 3 fijas) y para
  // que la suma sea exactamente costosDirectos + gastosTabla + sueldosDevengados.
  const gastosChartData = useMemo(() => {
    if (!kpis) return [] as { name: string; value: number; color: string }[]
    let fi = 0
    const cats = kpis.gastosDesglose.map((g) => ({
      name: g.categoria,
      value: g.monto,
      color: GASTO_COLORS[g.categoria] ?? GASTO_FALLBACK[fi++ % GASTO_FALLBACK.length],
    }))
    return [
      ...cats,
      { name: "Sueldos (devengados)", value: kpis.sueldosDevengados, color: "#16a34a" },
      { name: "Costos de servicios", value: kpis.costosDirectos, color: "#dc2626" },
    ].filter((d) => d.value > 0)
  }, [kpis])

  // ── Top clientes (dos rankings: cobrado y facturado) ────────────────────────
  const topClientesCobrado = useMemo(() => {
    const map: Record<string, { cliente: string; total: number; count: number }> = {}
    for (const s of servicios) {
      if (!esCerrado(s.estado)) continue
      const key = s.cliente || "Sin nombre"
      if (!map[key]) map[key] = { cliente: key, total: 0, count: 0 }
      map[key].total += Number(s.monto_total_sin_iva) || 0
      map[key].count++
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [servicios, esCerrado])

  const topClientesFacturado = useMemo(() => {
    const map: Record<string, { cliente: string; total: number; count: number }> = {}
    for (const s of servicios) {
      if (Number(s.monto_total_sin_iva || 0) <= 0) continue
      const key = s.cliente || "Sin nombre"
      if (!map[key]) map[key] = { cliente: key, total: 0, count: 0 }
      map[key].total += Number(s.monto_total_sin_iva) || 0
      map[key].count++
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [servicios])

  // ── Cuentas por Cobrar (NUEVO) ──────────────────────────────────────────────
  // Días = antigüedad de la deuda, medida desde fecha_entregado (cuando el
  // servicio cambió a por_cobrar/cerrado). Si la columna está NULL en servicios
  // viejos previos a la migración, cae a fecha_ingreso como mejor estimación.
  const cuentasPorCobrar = useMemo(() => {
    const hoy = new Date()
    const rows = serviciosPendientesCobro.map((s) => {
      const fechaBase = s.fecha_entregado || s.fecha_ingreso
      const dias = Math.floor((hoy.getTime() - new Date(fechaBase).getTime()) / 86400000)
      return { ...s, dias }
    })
    const total = rows.reduce((s, r) => s + Number(r.saldo_pendiente || 0), 0)
    const buckets = {
      reciente: rows.filter((r) => r.dias <= 15).reduce((s, r) => s + Number(r.saldo_pendiente || 0), 0),
      medio: rows.filter((r) => r.dias > 15 && r.dias <= 30).reduce((s, r) => s + Number(r.saldo_pendiente || 0), 0),
      viejo: rows.filter((r) => r.dias > 30).reduce((s, r) => s + Number(r.saldo_pendiente || 0), 0),
    }
    return { rows: rows.sort((a, b) => b.dias - a.dias), total, buckets }
  }, [serviciosPendientesCobro])

  // ── IVA: usa serviciosFacturadosMes (criterio SII por fecha_facturacion) ────
  const ivaData = useMemo(() => {
    const debitoRows = serviciosFacturadosMes
      .filter((s) => tieneIva(s) && Number(s.monto_total_sin_iva || 0) > 0)
      .map((s) => {
        const neto = Number(s.monto_total_sin_iva || 0)
        const total = Number(s.monto_total || 0)
        return {
          id: s.id,
          fecha: s.fecha_facturacion || s.fecha_ingreso,
          patente: s.patente,
          cliente: s.cliente,
          neto,
          iva: total - neto,
          total,
        }
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    type CreditoRow = { fecha: string; origen: string; descripcion: string; bruto: number; iva: number }
    const creditoGastos: CreditoRow[] = gastos
      .filter((g) => g.tipo_documento === "factura")
      .map((g) => ({
        fecha: g.fecha,
        origen: g.categoria,
        descripcion: g.descripcion,
        bruto: Number(g.monto || 0),
        iva: extraerIvaIncluido(Number(g.monto || 0)),
      }))
    const creditoCostos: CreditoRow[] = servicios.flatMap((s) =>
      parseJsonbArray<any>(s.costos)
        .filter((c) => c.tipo_documento === "factura")
        .map((c) => ({
          fecha: s.fecha_ingreso,
          origen: `Costo servicio (${c.categoria || "—"})`,
          descripcion: `${s.patente} · ${c.descripcion || ""}`,
          bruto: Number(c.monto || 0),
          iva: extraerIvaIncluido(Number(c.monto || 0)),
        })),
    )
    const creditoRows = [...creditoGastos, ...creditoCostos].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    )
    const totalDebitoNeto = debitoRows.reduce((s, r) => s + r.neto, 0)
    const totalDebitoIva = debitoRows.reduce((s, r) => s + r.iva, 0)
    const totalDebitoBruto = debitoRows.reduce((s, r) => s + r.total, 0)
    const totalCreditoBruto = creditoRows.reduce((s, r) => s + r.bruto, 0)
    const totalCreditoIva = creditoRows.reduce((s, r) => s + r.iva, 0)

    return {
      debitoRows,
      creditoRows,
      totalDebitoNeto,
      totalDebitoIva,
      totalDebitoBruto,
      totalCreditoBruto,
      totalCreditoIva,
      ivaNeto: totalDebitoIva - totalCreditoIva,
    }
  }, [serviciosFacturadosMes, gastos, servicios])

  // ── Exportar PDF gerencial ──────────────────────────────────────────────────
  const exportarPDF = async () => {
    if (!kpis) return
    const k = kpis
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const today = new Date().toLocaleDateString("es-CL")
    const periodo = capitalize(monthName)

    // Cargar logo y capturar gráficos (degradan a null/"" sin romper el PDF).
    const [logo, pieImg, barImg] = await Promise.all([
      loadLogoBase64(),
      svgToPng(pieChartRef.current),
      svgToPng(barChartRef.current),
    ])

    // ── Helpers de dibujo ─────────────────────────────────────────────────────
    // Encabezado compacto de marca para páginas de contenido.
    const brandHeader = (titulo: string): number => {
      if (logo) doc.addImage(logo, "PNG", 14, 8, 42, 15)
      doc.setTextColor(...PDF_GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(8)
      doc.text(periodo, pageWidth - 14, 14, { align: "right" })
      doc.setDrawColor(...PDF_AZUL); doc.setLineWidth(1)
      doc.line(14, 26, pageWidth - 14, 26)
      doc.setLineWidth(0.2)
      doc.setTextColor(...PDF_NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(15)
      doc.text(titulo, 14, 36)
      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0)
      return 42
    }
    const afterTable = () => (doc as any).lastAutoTable.finalY as number

    // Comparación numérica con el mes anterior.
    const cmp = (cur: number, prev: number) => {
      const diff = cur - prev
      const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : null
      return { diff, pct }
    }

    // ── PÁGINA 1: Portada (fondo blanco) ──────────────────────────────────────
    if (logo) doc.addImage(logo, "PNG", (pageWidth - 80) / 2, 60, 80, 29)
    // Línea azul de marca bajo el logo
    doc.setDrawColor(...PDF_AZUL); doc.setLineWidth(1)
    doc.line((pageWidth - 80) / 2, 98, (pageWidth + 80) / 2, 98)
    doc.setLineWidth(0.2)
    doc.setTextColor(...PDF_NAVY)
    doc.setFont("helvetica", "bold"); doc.setFontSize(30)
    doc.text("Reporte Gerencial", pageWidth / 2, 130, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(14)
    doc.setTextColor(...PDF_GRIS)
    doc.text("Cómo le fue al taller este mes", pageWidth / 2, 142, { align: "center" })
    // Banda de período (clara, con borde azul)
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...PDF_AZUL); doc.setLineWidth(0.6)
    doc.roundedRect((pageWidth - 110) / 2, 160, 110, 18, 3, 3, "FD")
    doc.setLineWidth(0.2)
    doc.setTextColor(...PDF_AZUL)
    doc.setFont("helvetica", "bold"); doc.setFontSize(16)
    doc.text(periodo, pageWidth / 2, 172, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(10)
    doc.setTextColor(...PDF_GRIS)
    doc.text(`Generado el ${today}`, pageWidth / 2, 270, { align: "center" })

    // ── PÁGINA 2: ¿Cómo le fue este mes? (lenguaje simple) ────────────────────
    // Modelo simple y honesto: Entró − Gastó = Quedó (identidad exacta con utilidadNeta).
    const entro = k.ingresoFacturado
    const gasto = k.costosDirectos + k.gastosOperativos
    const quedo = k.utilidadNeta
    doc.addPage()
    let y = brandHeader("¿Cómo le fue este mes?")

    // Veredicto destacado (recuadro blanco con borde y texto de color, para imprimir)
    const gano = quedo >= 0
    const vColor = gano ? PDF_VERDE : PDF_ROJO
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...vColor); doc.setLineWidth(0.8)
    doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, "FD")
    doc.setLineWidth(0.2)
    doc.setTextColor(...vColor); doc.setFont("helvetica", "bold"); doc.setFontSize(17)
    doc.text(
      gano
        ? `Este mes el taller GANÓ ${fmtCLP(quedo)}`
        : `Este mes el taller PERDIÓ ${fmtCLP(Math.abs(quedo))}`,
      pageWidth / 2, y + 15, { align: "center" },
    )
    y += 34

    // Tarjetas grandes (3 x 2): ingresos arriba (facturado / cobrado / falta),
    // resultado abajo (gasto / ganancia / deuda total).
    const drawCard = (x: number, cy: number, w: number, h: number, label: string, value: string, accent: RGB) => {
      doc.setFillColor(250, 251, 253); doc.setDrawColor(...accent); doc.setLineWidth(0.4)
      doc.roundedRect(x, cy, w, h, 2, 2, "FD")
      doc.setFillColor(...accent); doc.rect(x, cy, 2, h, "F")
      doc.setTextColor(...PDF_GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
      const lab = doc.splitTextToSize(label, w - 9) as string[]
      doc.text(lab, x + 6, cy + 7)
      doc.setTextColor(...accent); doc.setFont("helvetica", "bold"); doc.setFontSize(13)
      doc.text(value, x + 6, cy + h - 6)
    }
    const cobrado = k.ingresoCobrado
    const faltaCobrarMes = Math.max(0, entro - cobrado)
    const gap = 6
    const cardW = (pageWidth - 28 - gap * 2) / 3
    const cardH = 26
    const col = (i: number) => 14 + i * (cardW + gap)
    // Fila 1 — ingresos: facturado vs cobrado de verdad vs diferencia
    drawCard(col(0), y, cardW, cardH, "Se trabajó (facturado)", fmtCLP(entro), PDF_AZUL)
    drawCard(col(1), y, cardW, cardH, "Se cobró de verdad", fmtCLP(cobrado), PDF_VERDE)
    drawCard(col(2), y, cardW, cardH, "Falta cobrar de este mes", fmtCLP(faltaCobrarMes), PDF_AMBAR)
    // Fila 2 — gasto, ganancia y deuda total
    const y2 = y + cardH + gap
    drawCard(col(0), y2, cardW, cardH, "Se gastó", fmtCLP(gasto), PDF_GRIS)
    drawCard(col(1), y2, cardW, cardH, "Quedó de ganancia", fmtCLP(quedo), gano ? PDF_VERDE : PDF_ROJO)
    drawCard(col(2), y2, cardW, cardH, "Le deben en total", fmtCLP(cuentasPorCobrar.total), PDF_AMBAR)
    y = y2 + cardH + 12

    // Comparación simple con el mes pasado
    if (prevMonthKpis) {
      const dq = cmp(quedo, prevMonthKpis.utilidadNeta)
      const de = cmp(entro, prevMonthKpis.ingresoFacturado)
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PDF_NAVY)
      doc.text("Comparado con el mes pasado", 14, y); y += 7
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5)
      const linea = (txt: string, positivo: boolean) => {
        doc.setTextColor(...(positivo ? PDF_VERDE : PDF_ROJO))
        doc.text(`${positivo ? "▲" : "▼"}  ${txt}`, 18, y); y += 7
      }
      linea(
        de.diff >= 0
          ? `Entró ${fmtCLP(de.diff)} más en trabajos`
          : `Entró ${fmtCLP(Math.abs(de.diff))} menos en trabajos`,
        de.diff >= 0,
      )
      linea(
        dq.diff >= 0
          ? `Quedó ${fmtCLP(dq.diff)} más de ganancia`
          : `Quedó ${fmtCLP(Math.abs(dq.diff))} menos de ganancia`,
        dq.diff >= 0,
      )
      y += 4
    }

    // Diagnóstico en frases simples
    const bullets: { text: string; tone: "ok" | "warn" | "info" }[] = []
    bullets.push({
      text: gano
        ? `Este mes el negocio dejó ganancia (${fmtCLP(quedo)}).`
        : `Este mes el negocio perdió plata (${fmtCLP(Math.abs(quedo))}). Conviene revisar los gastos.`,
      tone: gano ? "ok" : "warn",
    })
    if (faltaCobrarMes > 0) {
      bullets.push({
        text: `De lo que se trabajó este mes (${fmtCLP(entro)}), se cobró ${fmtCLP(cobrado)} y faltan ${fmtCLP(faltaCobrarMes)} por cobrar.`,
        tone: "info",
      })
    }
    if (cuentasPorCobrar.total > 0) {
      if (cuentasPorCobrar.buckets.viejo > 0) {
        bullets.push({
          text: `Le deben ${fmtCLP(cuentasPorCobrar.total)} en total; ${fmtCLP(cuentasPorCobrar.buckets.viejo)} es de hace más de un mes — conviene cobrar.`,
          tone: "warn",
        })
      } else {
        bullets.push({
          text: `Le deben ${fmtCLP(cuentasPorCobrar.total)} por trabajos ya entregados.`,
          tone: "info",
        })
      }
    }
    if (rentabilidadPorCategoria.length > 0) {
      const best = rentabilidadPorCategoria[0]
      bullets.push({ text: `El trabajo que más deja es ${best.label} (ganó ${fmtCLP(best.margen)} después de costos).`, tone: "info" })
      const worst = rentabilidadPorCategoria[rentabilidadPorCategoria.length - 1]
      if (worst.margen < 0) {
        bullets.push({ text: `Ojo: en ${worst.label} se gastó más de lo que entró (${fmtCLP(worst.margen)}).`, tone: "warn" })
      }
    }
    bullets.push({
      text: `Se trabajó en ${k.serviciosCount} ${k.serviciosCount === 1 ? "vehículo" : "vehículos"} este mes.`,
      tone: "info",
    })

    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PDF_NAVY)
    doc.text("En resumen", 14, y); y += 7
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5)
    for (const b of bullets) {
      const color = b.tone === "ok" ? PDF_VERDE : b.tone === "warn" ? PDF_ROJO : PDF_NAVY
      doc.setFillColor(...color); doc.circle(16, y - 1.2, 1.1, "F")
      doc.setTextColor(40, 40, 40)
      const lines = doc.splitTextToSize(b.text, pageWidth - 38) as string[]
      doc.text(lines, 20, y)
      y += lines.length * 6 + 2
    }

    // ── PÁGINA 3: ¿En qué se va la plata? (torta de gastos) ───────────────────
    doc.addPage()
    y = brandHeader("¿En qué se va la plata?")
    doc.setFontSize(8); doc.setTextColor(...PDF_GRIS)
    doc.text("Incluye sueldos del mes completos (devengados), gastos del taller y costos de los trabajos.", 14, y)
    doc.setTextColor(0); y += 5
    if (pieImg) {
      const imgW = 120
      const imgH = imgW * (pieImg.h / pieImg.w)
      doc.addImage(pieImg.url, "PNG", (pageWidth - imgW) / 2, y, imgW, imgH)
      y += imgH + 6
    }
    const totalGastosChart = gastosChartData.reduce((s, d) => s + d.value, 0)
    if (gastosChartData.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Tipo de gasto", "Monto", "%"]],
        body: gastosChartData.map((d) => [
          d.name,
          fmtCLP(d.value),
          totalGastosChart > 0 ? `${((d.value / totalGastosChart) * 100).toFixed(0)}%` : "—",
        ]),
        foot: [["Total", fmtCLP(totalGastosChart), "100%"]],
        theme: "striped",
        headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
        footStyles: { fillColor: PDF_FILL, textColor: PDF_NAVY, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      })
    }

    // ── PÁGINA: Plata que aún le deben (cuentas por cobrar, lenguaje simple) ───
    if (cuentasPorCobrar.rows.length > 0) {
      doc.addPage()
      y = brandHeader("Plata que aún le deben")
      doc.setFontSize(10); doc.setTextColor(...PDF_GRIS)
      doc.text(
        `Total: ${fmtCLP(cuentasPorCobrar.total)}   ·   Hace +30 días: ${fmtCLP(cuentasPorCobrar.buckets.viejo)}   ·   15-30 días: ${fmtCLP(cuentasPorCobrar.buckets.medio)}   ·   Reciente: ${fmtCLP(cuentasPorCobrar.buckets.reciente)}`,
        14, y,
      )
      doc.setTextColor(0)
      autoTable(doc, {
        startY: y + 5,
        head: [["Patente", "Cliente", "Entregado", "Días", "Le debe"]],
        body: cuentasPorCobrar.rows.map((r) => [
          r.patente,
          r.cliente,
          formatFechaDMA(r.fecha_entregado || r.fecha_ingreso),
          String(r.dias),
          fmtCLP(Number(r.saldo_pendiente || 0)),
        ]),
        theme: "striped",
        styles: { fontSize: 8 },
        headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
        columnStyles: { 4: { halign: "right" } },
        // Resalta en rojo las deudas de más de 30 días.
        didParseCell: (data: any) => {
          if (data.section === "body" && Number(cuentasPorCobrar.rows[data.row.index]?.dias) > 30) {
            data.cell.styles.textColor = PDF_ROJO
          }
        },
      })
    }

    // ── PÁGINA: ¿Qué trabajos dejan más? (rentabilidad por categoría) ─────────
    if (rentabilidadPorCategoria.length > 0) {
      doc.addPage()
      y = brandHeader("¿Qué trabajos dejan más?")
      if (barImg) {
        const imgW = 165
        const imgH = imgW * (barImg.h / barImg.w)
        doc.addImage(barImg.url, "PNG", (pageWidth - imgW) / 2, y, imgW, imgH)
        y += imgH + 6
      }
      autoTable(doc, {
        startY: y,
        head: [["Trabajo", "Entró", "Costó", "Quedó"]],
        body: rentabilidadPorCategoria.map((r) => [r.label, fmtCLP(r.cobros), fmtCLP(r.costos), fmtCLP(r.margen)]),
        foot: [["Total", fmtCLP(rentCatTotales.cobros), fmtCLP(rentCatTotales.costos), fmtCLP(rentCatTotales.margen)]],
        theme: "striped",
        headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
        footStyles: { fillColor: PDF_FILL, textColor: PDF_NAVY, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      })
    }

    // ── PÁGINA: Mejores clientes ──────────────────────────────────────────────
    if (topClientesFacturado.length > 0 || topClientesCobrado.length > 0) {
      doc.addPage()
      y = brandHeader("Mejores clientes del mes")
      if (topClientesCobrado.length > 0) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PDF_NAVY)
        doc.text("Por plata cobrada (trabajos pagados)", 14, y)
        autoTable(doc, {
          startY: y + 3,
          head: [["#", "Cliente", "Trabajos", "Total"]],
          body: topClientesCobrado.map((c, i) => [String(i + 1), c.cliente, String(c.count), fmtCLP(c.total)]),
          theme: "striped",
          styles: { fontSize: 8 },
          headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
          columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "center" }, 3: { halign: "right" } },
        })
        y = afterTable() + 8
      }
      if (topClientesFacturado.length > 0) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PDF_NAVY)
        doc.text("Por plata facturada (incluye lo por cobrar)", 14, y)
        autoTable(doc, {
          startY: y + 3,
          head: [["#", "Cliente", "Trabajos", "Total"]],
          body: topClientesFacturado.map((c, i) => [String(i + 1), c.cliente, String(c.count), fmtCLP(c.total)]),
          theme: "striped",
          styles: { fontSize: 8 },
          headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
          columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "center" }, 3: { halign: "right" } },
        })
      }
    }

    // ── PÁGINA: Pintura ───────────────────────────────────────────────────────
    if (piezasDetalle.length > 0 || pinturaHistorico.length > 0) {
      doc.addPage()
      y = brandHeader("Trabajos de pintura")
      if (piezasDetalle.length > 0) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PDF_NAVY)
        doc.text("Piezas pintadas este mes", 14, y)
        autoTable(doc, {
          startY: y + 3,
          head: [["Pieza", "Veces", "Unidades", "Ingresos"]],
          body: piezasDetalle.map((p) => [p.nombre, String(p.veces), String(p.unidades), fmtCLP(p.ingresos)]),
          foot: [["Total", "", String(totalUnidadesPintura), fmtCLP(ingresosPiezas)]],
          theme: "striped",
          styles: { fontSize: 8 },
          headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
          footStyles: { fillColor: PDF_FILL, textColor: PDF_NAVY, fontStyle: "bold" },
          columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "right" } },
        })
        y = afterTable() + 8
      }
      if (pinturaHistorico.length > 0) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PDF_NAVY)
        doc.text("Últimos meses (piezas y mano de obra)", 14, y)
        autoTable(doc, {
          startY: y + 3,
          head: [["Mes", "Piezas", "MO estimada", "MO real", "Mat. estimado", "Mat. real"]],
          body: pinturaHistorico.map((h) => [
            h.mes, String(h.piezas), fmtCLP(h.mo_estimada), fmtCLP(h.mo_real), fmtCLP(h.mat_estimado), fmtCLP(h.mat_real),
          ]),
          theme: "striped",
          styles: { fontSize: 8 },
          headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
          columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
        })
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ANEXOS TÉCNICOS (parte contable) — separados de la lectura simple
    // ════════════════════════════════════════════════════════════════════════
    doc.addPage()
    // Línea azul de marca sobre el título (fondo blanco para imprimir)
    doc.setDrawColor(...PDF_AZUL); doc.setLineWidth(1)
    doc.line((pageWidth - 80) / 2, 128, (pageWidth + 80) / 2, 128)
    doc.setLineWidth(0.2)
    doc.setTextColor(...PDF_NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(26)
    doc.text("Anexos técnicos", pageWidth / 2, 140, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(12)
    doc.setTextColor(...PDF_GRIS)
    doc.text("Detalle contable e indicadores de gestión", pageWidth / 2, 152, { align: "center" })

    // ── Resumen Ejecutivo (KPIs) + comparación con mes anterior ───────────────
    doc.addPage()
    y = brandHeader("Resumen Ejecutivo (indicadores)")
    const kpiRow = (label: string, cur: string, prev: string, diff: string) => [label, cur, prev, diff]
    const prev = prevMonthKpis
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Mes actual", "Mes anterior", "Variación"]],
      body: [
        kpiRow("Ingresos Cobrados (cerrados)", fmtCLP(k.ingresoCobrado), prev ? fmtCLP(prev.ingresoCobrado) : "—", prev ? fmtCLP(cmp(k.ingresoCobrado, prev.ingresoCobrado).diff) : "—"),
        kpiRow("Ingresos Facturados (con monto)", fmtCLP(k.ingresoFacturado), prev ? fmtCLP(prev.ingresoFacturado) : "—", prev ? fmtCLP(cmp(k.ingresoFacturado, prev.ingresoFacturado).diff) : "—"),
        kpiRow("Falta por cobrar (Facturado − Cobrado)", fmtCLP(k.ingresoFacturado - k.ingresoCobrado), prev ? fmtCLP(prev.ingresoFacturado - prev.ingresoCobrado) : "—", prev ? fmtCLP(cmp(k.ingresoFacturado - k.ingresoCobrado, prev.ingresoFacturado - prev.ingresoCobrado).diff) : "—"),
        kpiRow("Costos Directos (variables)", fmtCLP(k.costosDirectos), prev ? fmtCLP(prev.costosDirectos) : "—", prev ? fmtCLP(cmp(k.costosDirectos, prev.costosDirectos).diff) : "—"),
        kpiRow("Margen de Contribución", `${fmtCLP(k.margenContribucion)} (${fmtPct(k.margenContribucionPct)})`, prev ? fmtCLP(prev.margenContribucion) : "—", prev ? fmtCLP(cmp(k.margenContribucion, prev.margenContribucion).diff) : "—"),
        kpiRow("Sueldos devengados", fmtCLP(k.sueldosDevengados), prev ? fmtCLP(prev.sueldosDevengados) : "—", prev ? fmtCLP(cmp(k.sueldosDevengados, prev.sueldosDevengados).diff) : "—"),
        kpiRow("Sueldos pagados (caja)", fmtCLP(k.sueldosPagados), prev ? fmtCLP(prev.sueldosPagados) : "—", prev ? fmtCLP(cmp(k.sueldosPagados, prev.sueldosPagados).diff) : "—"),
        kpiRow("Gastos operacionales (s/sueldos)", fmtCLP(k.gastosTabla), prev ? fmtCLP(prev.gastosTabla) : "—", prev ? fmtCLP(cmp(k.gastosTabla, prev.gastosTabla).diff) : "—"),
        kpiRow("Utilidad Neta", `${fmtCLP(k.utilidadNeta)} (${fmtPct(k.margenPct)})`, prev ? fmtCLP(prev.utilidadNeta) : "—", prev ? fmtCLP(cmp(k.utilidadNeta, prev.utilidadNeta).diff) : "—"),
        kpiRow("Servicios facturados (n°)", String(k.serviciosCount), prev ? String(prev.serviciosCount) : "—", prev ? String(k.serviciosCount - prev.serviciosCount) : "—"),
        kpiRow("Servicios finalizados (n°)", String(k.serviciosFinalizados), prev ? String(prev.serviciosFinalizados) : "—", prev ? String(k.serviciosFinalizados - prev.serviciosFinalizados) : "—"),
        kpiRow("Punto de equilibrio", k.puntoEquilibrio === null ? "No alcanzable" : `${k.puntoEquilibrio} serv.`, prev ? (prev.puntoEquilibrio === null ? "No alcanzable" : `${prev.puntoEquilibrio} serv.`) : "—", "—"),
        kpiRow("Cobertura de gastos", fmtPct(k.coberturaGastos), prev ? fmtPct(prev.coberturaGastos) : "—", "—"),
        kpiRow("IVA Neto a pagar", fmtCLP(k.ivaNetoMes), prev ? fmtCLP(prev.ivaNetoMes) : "—", prev ? fmtCLP(cmp(k.ivaNetoMes, prev.ivaNetoMes).diff) : "—"),
      ],
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    })

    // ── Estado de Resultados (cascada) ────────────────────────────────────────
    y = afterTable() + 10
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...PDF_NAVY)
    doc.text("Estado de Resultados", 14, y)
    doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0)
    autoTable(doc, {
      startY: y + 4,
      head: [["Concepto", "Monto"]],
      body: [
        ["Ingresos facturados", fmtCLP(k.ingresoFacturado)],
        ["(−) Costos directos", `-${fmtCLP(k.costosDirectos)}`],
        ["= Margen de contribución", fmtCLP(k.margenContribucion)],
        ["(−) Sueldos devengados", `-${fmtCLP(k.sueldosDevengados)}`],
        ["(−) Gastos operacionales", `-${fmtCLP(k.gastosTabla)}`],
        ["= Utilidad neta", fmtCLP(k.utilidadNeta)],
      ],
      theme: "striped",
      headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
      columnStyles: { 1: { halign: "right" } },
    })

    // ── IVA ────────────────────────────────────────────────────────────────────
    y = afterTable() + 10
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...PDF_NAVY)
    doc.text("IVA del mes (criterio SII por fecha de facturación)", 14, y)
    doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0)
    autoTable(doc, {
      startY: y + 4,
      body: [
        ["IVA Débito (ventas)", fmtCLP(k.ivaDebitoMes)],
        ["IVA Crédito (compras c/factura)", fmtCLP(k.ivaCreditoMes)],
        ["IVA Neto a pagar", fmtCLP(k.ivaNetoMes)],
      ],
      theme: "grid",
      columnStyles: { 1: { halign: "right" } },
    })

    // ── Anexo A: servicios del mes (agrupados por estado) ─────────────────────
    doc.addPage()
    y = brandHeader("Anexo A: Servicios del Mes")
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text("Agrupados por estado, ordenados por fecha", 14, y)
    doc.setTextColor(0)
    y += 4

    // Agrupar por estado y ordenar grupos por monto total descendente
    const grupos = new Map<string, Servicio[]>()
    for (const s of servicios) {
      const est = s.estado || "Sin estado"
      if (!grupos.has(est)) grupos.set(est, [])
      grupos.get(est)!.push(s)
    }
    const gruposOrdenados = [...grupos.entries()]
      .map(([estado, items]) => ({
        estado,
        items: [...items].sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime()),
        subtotal: items.reduce((s, sv) => s + Number(sv.monto_total_sin_iva || 0), 0),
      }))
      .sort((a, b) => b.subtotal - a.subtotal)

    // Construir filas: header de grupo + servicios + subtotal
    const bodyServicios: any[] = []
    for (const g of gruposOrdenados) {
      // Fila de título de grupo (todas las celdas en una)
      bodyServicios.push([
        {
          content: `${g.estado.toUpperCase()} — ${g.items.length} servicio${g.items.length !== 1 ? "s" : ""}`,
          colSpan: 6,
          styles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: "bold", fontSize: 8 },
        },
      ])
      for (const s of g.items) {
        bodyServicios.push([
          formatFechaDMA(s.fecha_ingreso),
          s.patente,
          s.cliente,
          `${s.marca} ${s.modelo}`,
          s.estado,
          fmtCLP(Number(s.monto_total_sin_iva)),
        ])
      }
      // Subtotal del grupo
      bodyServicios.push([
        { content: "Subtotal", colSpan: 5, styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: fmtCLP(g.subtotal), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249] } },
      ])
    }
    // Fila de total general
    const totalGeneral = gruposOrdenados.reduce((s, g) => s + g.subtotal, 0)
    bodyServicios.push([
      {
        content: `TOTAL ${servicios.length} servicios`,
        colSpan: 5,
        styles: { halign: "right", fontStyle: "bold", fillColor: PDF_HEAD, textColor: PDF_NAVY },
      },
      { content: fmtCLP(totalGeneral), styles: { halign: "right", fontStyle: "bold", fillColor: PDF_HEAD, textColor: PDF_NAVY } },
    ])

    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Patente", "Cliente", "Marca/Modelo", "Estado", "Monto"]],
      body: bodyServicios,
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
      columnStyles: { 5: { halign: "right" } },
      margin: { top: 28 },
    })

    // ── Anexo B: gastos del mes (agrupados por categoría) ─────────────────────
    if (gastos.length > 0) {
      doc.addPage()
      y = brandHeader("Anexo B: Gastos del Mes")
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text("Agrupados por categoría, ordenados por fecha", 14, y)
      doc.setTextColor(0)
      y += 4

      const cats = new Map<string, Gasto[]>()
      for (const g of gastos) {
        const cat = g.categoria || "Sin categoría"
        if (!cats.has(cat)) cats.set(cat, [])
        cats.get(cat)!.push(g)
      }
      const categoriasOrdenadas = [...cats.entries()]
        .map(([categoria, items]) => ({
          categoria,
          items: [...items].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
          subtotal: items.reduce((s, g) => s + Number(g.monto || 0), 0),
        }))
        .sort((a, b) => b.subtotal - a.subtotal)

      const bodyGastos: any[] = []
      for (const c of categoriasOrdenadas) {
        bodyGastos.push([
          {
            content: `${c.categoria.toUpperCase()} — ${c.items.length} ítem${c.items.length !== 1 ? "s" : ""}`,
            colSpan: 5,
            styles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: "bold", fontSize: 8 },
          },
        ])
        for (const g of c.items) {
          bodyGastos.push([
            formatFechaDMA(g.fecha),
            g.categoria,
            g.descripcion,
            g.tipo_documento || "boleta",
            fmtCLP(Number(g.monto)),
          ])
        }
        bodyGastos.push([
          { content: "Subtotal", colSpan: 4, styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249] } },
          { content: fmtCLP(c.subtotal), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249] } },
        ])
      }
      const totalGastos = categoriasOrdenadas.reduce((s, c) => s + c.subtotal, 0)
      bodyGastos.push([
        {
          content: `TOTAL ${gastos.length} gastos`,
          colSpan: 4,
          styles: { halign: "right", fontStyle: "bold", fillColor: PDF_HEAD, textColor: PDF_NAVY },
        },
        { content: fmtCLP(totalGastos), styles: { halign: "right", fontStyle: "bold", fillColor: PDF_HEAD, textColor: PDF_NAVY } },
      ])

      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Categoría", "Descripción", "Doc.", "Monto"]],
        body: bodyGastos,
        theme: "striped",
        styles: { fontSize: 7 },
        headStyles: { fillColor: PDF_HEAD, textColor: PDF_NAVY },
        columnStyles: { 4: { halign: "right" } },
        margin: { top: 28 },
      })
    }

    // ── Anexo C: definiciones ─────────────────────────────────────────────────
    doc.addPage()
    y = brandHeader("Anexo C: Definiciones de KPIs")
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Definición"]],
      body: [
        ["Ingresos Cobrados", "Suma de monto_total_sin_iva de servicios cerrados/pagados. Es lo realmente cobrado."],
        ["Ingresos Facturados", "Suma de monto_total_sin_iva de servicios con monto > 0 (incluye por cobrar)."],
        ["Falta por cobrar (mes)", "Facturado − Cobrado. Trabajo del mes con monto asignado que aún no está cerrado/pagado."],
        ["Lo que se gastó", "Costos directos + gastos del taller (s/sueldos) + sueldos devengados. Criterio devengado."],
        ["Costos Directos", "Items de costos[] excluyendo isAuto=true (mano de obra de pintura auto, materiales pintura auto) para evitar doble conteo con la categoría 'Gastos de Pintura'."],
        ["Sueldos Devengados", "Sueldo base de empleados activos. Criterio contable."],
        ["Sueldos Pagados", "Abonos efectivamente realizados a empleados en el mes. Criterio caja."],
        ["Margen Contribución", "Ingresos Facturados − Costos Directos."],
        ["Utilidad Neta", "Margen Contribución − Sueldos Devengados − Gastos Operacionales."],
        ["Punto de Equilibrio", "ceil(Gastos Operativos ÷ Margen Contribución por Servicio). 'No alcanzable' si margen ≤ 0."],
        ["Cobertura Gastos", "Utilidad Neta ÷ Gastos Operativos × 100. Cuán bien la utilidad cubre los gastos."],
        ["IVA Débito", "Suma de IVA emitido en servicios con fecha_facturacion en el mes (criterio SII)."],
        ["IVA Crédito", "Suma de IVA contenido en gastos y costos con tipo_documento='factura'."],
        ["IVA Neto", "IVA Débito − IVA Crédito. Lo que se paga al SII."],
      ],
      theme: "grid",
      styles: { fontSize: 8 },
      columnStyles: { 1: { cellWidth: 130 } },
      margin: { top: 28 },
    })

    // ── Pie de página con numeración (en todas menos la portada) ──────────────
    const totalPages = doc.getNumberOfPages()
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...PDF_GRIS)
      doc.text(`Reporte Gerencial · ${periodo} · Generado ${today}`, 14, 290)
      doc.text(`Página ${i - 1} de ${totalPages - 1}`, pageWidth - 14, 290, { align: "right" })
    }

    doc.save(`reporte-gerencial-${selectedMonth}.pdf`)
  }

  const exportarExcelServicios = () => {
    const data = servicios.map((s) => ({
      Fecha: formatFechaDMA(s.fecha_ingreso),
      Patente: s.patente,
      Cliente: s.cliente,
      Marca: s.marca,
      Modelo: s.modelo,
      Estado: s.estado,
      "Monto Total (c/IVA)": Number(s.monto_total),
      "Monto Sin IVA": Number(s.monto_total_sin_iva),
      Anticipo: Number(s.anticipo),
      "Saldo Pendiente": Number(s.saldo_pendiente),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Servicios")
    XLSX.writeFile(wb, `servicios-${selectedMonth}.xlsx`)
  }

  const exportarExcelGastos = () => {
    const data = gastos.map((g) => ({
      Fecha: formatFechaDMA(g.fecha),
      Categoría: g.categoria,
      Descripción: g.descripcion,
      Doc: g.tipo_documento || "boleta",
      Monto: Number(g.monto),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Gastos")
    XLSX.writeFile(wb, `gastos-${selectedMonth}.xlsx`)
  }

  // ── Estado de carga ──────────────────────────────────────────────────────────
  if (loading || !kpis) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Cargando reportes…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Gráficos ocultos, siempre montados, para capturar al PDF (no dependen
          de la pestaña activa). Posicionados fuera de pantalla. */}
      <div aria-hidden style={{ position: "absolute", left: -99999, top: 0, pointerEvents: "none" }}>
        <div ref={pieChartRef} style={{ width: 520, height: 320, background: "#fff" }}>
          {gastosChartData.length > 0 && (
            <PieChart width={520} height={320}>
              <Pie
                data={gastosChartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
                label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {gastosChartData.map((entry, index) => (
                  <Cell key={`pdf-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          )}
        </div>
        <div ref={barChartRef} style={{ width: 640, height: 340, background: "#fff" }}>
          {rentabilidadPorCategoria.length > 0 && (
            <BarChart width={640} height={340} data={rentabilidadPorCategoria} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtCLP(Number(v))} width={90} />
              <Bar dataKey="cobros" fill="#1a4ed8" radius={[4, 4, 0, 0]} name="Entró" isAnimationActive={false} />
              <Bar dataKey="costos" fill="#dc2626" radius={[4, 4, 0, 0]} name="Costó" isAnimationActive={false} />
            </BarChart>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes y Análisis</h1>
          <p className="text-muted-foreground mt-1 capitalize">{monthName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  exportarPDF().catch((e) => {
                    console.error(e)
                    alert("No se pudo generar el PDF. Intenta de nuevo.")
                  })
                }
              >
                <Download className="w-4 h-4 mr-2" />
                Reporte Gerencial PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportarExcelServicios}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Servicios Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportarExcelGastos}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Gastos Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <div className="overflow-x-auto -mx-4 px-4 mb-4">
          <TabsList className="w-max">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
            <TabsTrigger value="por-cobrar">Por Cobrar</TabsTrigger>
            <TabsTrigger value="pintura">Pintura</TabsTrigger>
            <TabsTrigger value="clientes">Top Clientes</TabsTrigger>
            <TabsTrigger value="iva">IVA</TabsTrigger>
            <TabsTrigger value="comparar">Comparar meses</TabsTrigger>
          </TabsList>
        </div>

        {/* ── RESUMEN ───────────────────────────────────────────────────────── */}
        <TabsContent value="resumen" className="space-y-6">
          {/* KPIs principales — DOBLE métrica de ingresos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Ingresos Cobrados
                      <InfoTip>Solo servicios en estado cerrado/pagado. Suma de monto sin IVA. Refleja dinero efectivamente ganado en el mes.</InfoTip>
                    </p>
                    <p className="text-xl font-bold">{fmtCLP(kpis.ingresoCobrado)}</p>
                    <p className="text-xs text-muted-foreground">Cerrados/pagados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Banknote className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Ingresos Facturados
                      <InfoTip>Todos los servicios con monto asignado, incluye por cobrar. Refleja volumen producido aunque aún no se haya cobrado.</InfoTip>
                    </p>
                    <p className="text-xl font-bold">{fmtCLP(kpis.ingresoFacturado)}</p>
                    <p className="text-xs text-muted-foreground">Incluye por cobrar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Gastos Totales
                      <InfoTip>Costos directos + sueldos devengados + gastos operacionales (sin sueldos). Criterio contable.</InfoTip>
                    </p>
                    <p className="text-xl font-bold">{fmtCLP(kpis.costosDirectos + kpis.gastosOperativos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Utilidad Neta
                      <InfoTip>Ingresos Facturados − Costos Directos − Sueldos Devengados − Gastos Operacionales.</InfoTip>
                    </p>
                    <p className={`text-xl font-bold ${kpis.utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtCLP(kpis.utilidadNeta)}
                    </p>
                    <p className="text-xs text-muted-foreground">Margen {fmtPct(kpis.margenPct)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-1.5">
                Desglose de Gastos
                <InfoTip>
                  Criterio devengado: costos directos + gastos del taller (sin sueldos) +
                  sueldos devengados. Suma exactamente el total de "Gastos Totales".
                </InfoTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gastosChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={gastosChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {gastosChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(value) => [fmtCLP(Number(value)), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  No hay gastos registrados
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rentabilidad por Categoría de Servicio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-1.5">
                Rentabilidad por Categoría de Servicio
                <InfoTip>
                  Cobros vs. costos del mes agrupados por categoría. La fila de Pintura incluye el
                  ingreso de las piezas pintadas y, en el costo, la mano de obra y materiales
                  calculados automáticamente.
                </InfoTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rentabilidadPorCategoria.length > 0 ? (
                <div className="space-y-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={rentabilidadPorCategoria} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtCLP(Number(v))} width={80} />
                      <RTooltip content={<MoneyTooltip />} allowEscapeViewBox={{ x: true }} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                      <Bar dataKey="cobros" fill="#1a4ed8" radius={[4, 4, 0, 0]} name="Cobros" />
                      <Bar dataKey="costos" fill="#dc2626" radius={[4, 4, 0, 0]} name="Costos" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left font-medium py-2 pr-4">Categoría</th>
                          <th className="text-right font-medium py-2 px-4">Cobros</th>
                          <th className="text-right font-medium py-2 px-4">Costos</th>
                          <th className="text-right font-medium py-2 px-4">Margen $</th>
                          <th className="text-right font-medium py-2 pl-4">Margen %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentabilidadPorCategoria.map((r) => (
                          <tr key={r.cat} className="border-b last:border-0">
                            <td className="text-left py-2 pr-4 font-medium">{r.label}</td>
                            <td className="text-right py-2 px-4 tabular-nums">{fmtCLP(r.cobros)}</td>
                            <td className="text-right py-2 px-4 tabular-nums">{fmtCLP(r.costos)}</td>
                            <td className={`text-right py-2 px-4 tabular-nums font-medium ${r.margen >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {fmtCLP(r.margen)}
                            </td>
                            <td className={`text-right py-2 pl-4 tabular-nums ${r.margen >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {fmtPct(r.margenPct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold">
                          <td className="text-left py-2 pr-4">Total</td>
                          <td className="text-right py-2 px-4 tabular-nums">{fmtCLP(rentCatTotales.cobros)}</td>
                          <td className="text-right py-2 px-4 tabular-nums">{fmtCLP(rentCatTotales.costos)}</td>
                          <td className={`text-right py-2 px-4 tabular-nums ${rentCatTotales.margen >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {fmtCLP(rentCatTotales.margen)}
                          </td>
                          <td className={`text-right py-2 pl-4 tabular-nums ${rentCatTotales.margen >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {fmtPct(rentCatTotales.cobros > 0 ? (rentCatTotales.margen / rentCatTotales.cobros) * 100 : null)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No hay cobros ni costos registrados este mes
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Gastos Fijos</CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmtCLP(gastosFijos)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Gastos de Pintura</CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmtCLP(gastosPinturaCat)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Costos de Servicios</CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmtCLP(kpis.costosDirectos)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  Sueldos Pagados
                  <InfoTip>Abonos efectivamente realizados en el mes. Criterio caja.</InfoTip>
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmtCLP(kpis.sueldosPagados)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  Sueldos Devengados
                  <InfoTip>Sueldo base de empleados activos. Criterio contable.</InfoTip>
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmtCLP(kpis.sueldosDevengados)}</p></CardContent>
            </Card>
            <Card
              className={
                kpis.margenPct === null ? "border-border"
                  : kpis.margenPct >= 20 ? "border-green-200"
                  : kpis.margenPct >= 0 ? "border-orange-200"
                  : "border-red-200"
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Margen de Utilidad</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    kpis.margenPct === null ? "text-muted-foreground"
                      : kpis.margenPct >= 20 ? "text-green-600"
                      : kpis.margenPct >= 0 ? "text-orange-600"
                      : "text-red-600"
                  }`}
                >
                  {fmtPct(kpis.margenPct)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── RENTABILIDAD ──────────────────────────────────────────────────── */}
        <TabsContent value="rentabilidad">
          <ProfitabilityAnalysis kpis={kpis} prevKpis={prevMonthKpis} />
        </TabsContent>

        {/* ── CUENTAS POR COBRAR (NUEVO) ───────────────────────────────────── */}
        <TabsContent value="por-cobrar" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total por cobrar</p>
                <p className="text-2xl font-bold">{fmtCLP(cuentasPorCobrar.total)}</p>
                <p className="text-xs text-muted-foreground">{cuentasPorCobrar.rows.length} servicio(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Reciente (≤15 días)</p>
                <p className="text-2xl font-bold text-green-600">{fmtCLP(cuentasPorCobrar.buckets.reciente)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Medio (16-30 días)</p>
                <p className="text-2xl font-bold text-orange-500">{fmtCLP(cuentasPorCobrar.buckets.medio)}</p>
              </CardContent>
            </Card>
            <Card className={cuentasPorCobrar.buckets.viejo > 0 ? "border-red-300" : ""}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Vencido (&gt;30 días)</p>
                <p className="text-2xl font-bold text-red-600">{fmtCLP(cuentasPorCobrar.buckets.viejo)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Detalle de cuentas por cobrar
                <InfoTip>Servicios con saldo &gt; 0 en estado "por cobrar". Datos globales (no filtrado por mes) — son los que importan para flujo de caja hoy.</InfoTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cuentasPorCobrar.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cuentas por cobrar pendientes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Patente</th>
                        <th className="py-2 pr-3 font-medium">Cliente</th>
                        <th className="py-2 pr-3 font-medium">Ingreso</th>
                        <th className="py-2 pr-3 font-medium text-right">Días</th>
                        <th className="py-2 pr-3 font-medium text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentasPorCobrar.rows.map((r) => (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-2 pr-3 font-mono text-xs">{r.patente}</td>
                          <td className="py-2 pr-3">{r.cliente}</td>
                          <td className="py-2 pr-3 text-xs">{formatFechaDMA(r.fecha_ingreso)}</td>
                          <td className={`py-2 pr-3 text-right font-medium ${r.dias > 30 ? "text-red-600" : r.dias > 15 ? "text-orange-500" : ""}`}>
                            {r.dias}
                          </td>
                          <td className="py-2 pr-3 text-right font-semibold">{fmtCLP(Number(r.saldo_pendiente || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td colSpan={4} className="py-2 pr-3 text-right text-muted-foreground">Total</td>
                        <td className="py-2 pr-3 text-right">{fmtCLP(cuentasPorCobrar.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PINTURA ─────────────────────────────────────────────────────── */}
        <TabsContent value="pintura" className="space-y-6">
          <div className="rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <p>
              <span className="font-medium text-foreground">Nota:</span> el costo material/unidad usa solo compras del mes
              actual. Si compraste pintura en un mes y la usaste en otro, el indicador puede aparecer alto o bajo
              artificialmente. Para tendencias confiables compara varios meses.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Unidades pintadas</p>
                <p className="text-3xl font-bold mt-1">{totalUnidadesPintura.toLocaleString("es-CL")}</p>
                <p className="text-xs text-muted-foreground mt-1">{piezasDetalle.length} tipos de piezas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Materiales comprados</p>
                <p className="text-3xl font-bold mt-1">{fmtCLP(totalMaterialesPintura)}</p>
                <p className="text-xs text-muted-foreground mt-1">{materialesPinturaItems.length} compras registradas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Ingresos por pintura</p>
                <p className="text-3xl font-bold mt-1">{fmtCLP(ingresosPiezas)}</p>
                <p className="text-xs text-muted-foreground mt-1">Cobros de piezas pintadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Costo material / unidad</p>
                <p className="text-3xl font-bold mt-1">{fmtCLP(costoPorUnidad)}</p>
                <p className={`text-xs mt-1 font-medium ${
                  margenPintura === null ? "text-muted-foreground"
                    : margenPintura >= 50 ? "text-green-500"
                    : margenPintura >= 20 ? "text-yellow-500"
                    : "text-red-500"
                }`}>
                  Margen {fmtPct(margenPintura)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Piezas pintadas este mes</CardTitle></CardHeader>
              <CardContent>
                {piezasDetalle.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay piezas pintadas registradas este mes.</p>
                ) : (
                  <div className="space-y-2">
                    {piezasDetalle.map((p) => (
                      <div key={p.nombre} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">{p.veces} servicio{p.veces !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{p.unidades % 1 === 0 ? p.unidades : p.unidades.toFixed(1)} ud.</p>
                          <p className="text-xs text-muted-foreground">{fmtCLP(p.ingresos)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 font-semibold text-sm">
                      <span>Total</span>
                      <span>
                        {totalUnidadesPintura % 1 === 0 ? totalUnidadesPintura : totalUnidadesPintura.toFixed(1)} ud. — {fmtCLP(ingresosPiezas)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Materiales comprados (Gastos de Pintura)</CardTitle></CardHeader>
              <CardContent>
                {materialesPinturaItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay gastos de pintura registrados este mes.</p>
                ) : (
                  <div className="space-y-2">
                    {materialesPinturaItems.map((g) => (
                      <div key={g.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{g.descripcion}</p>
                          <p className="text-xs text-muted-foreground">{g.fecha}</p>
                        </div>
                        <p className="text-sm font-semibold">{fmtCLP(Number(g.monto))}</p>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 font-semibold text-sm">
                      <span>Total materiales</span>
                      <span>{fmtCLP(totalMaterialesPintura)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comparativa Estimado vs Real */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Estimado vs Real
                <InfoTip>
                  Estimado = piezas × tarifa (MO) o cálculo automático del sistema (materiales).
                  Real = lo que efectivamente se registró en costos[] (MO) o se compró en Gastos de Pintura (materiales).
                </InfoTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Concepto</th>
                      <th className="py-2 pr-3 font-medium text-right">Estimado</th>
                      <th className="py-2 pr-3 font-medium text-right">Real</th>
                      <th className="py-2 pr-3 font-medium text-right">Desviación</th>
                      <th className="py-2 pr-3 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        <div className="font-medium">Mano de obra pintura</div>
                        <div className="text-xs text-muted-foreground">
                          {totalUnidadesPintura} pza · tarifa por servicio (default ${TARIFA_MO_PIEZA_DEFAULT.toLocaleString("es-CL")})
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtCLP(moPinturaEstimada)}</td>
                      <td className="py-2 pr-3 text-right">{fmtCLP(moPinturaReal)}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${desviacionMO === 0 ? "text-muted-foreground" : desviacionMO > 0 ? "text-red-600" : "text-green-600"}`}>
                        {desviacionMO >= 0 ? "+" : ""}{fmtCLP(desviacionMO)}
                      </td>
                      <td className="py-2 pr-3 text-right text-xs text-muted-foreground">
                        {moPinturaEstimada > 0 ? `${((desviacionMO / moPinturaEstimada) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        <div className="font-medium">Materiales pintura</div>
                        <div className="text-xs text-muted-foreground">Estimado por sistema vs gastos reales del mes</div>
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtCLP(materialesEstimado)}</td>
                      <td className="py-2 pr-3 text-right">{fmtCLP(totalMaterialesPintura)}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${desviacionMat === 0 ? "text-muted-foreground" : desviacionMat > 0 ? "text-red-600" : "text-green-600"}`}>
                        {desviacionMat >= 0 ? "+" : ""}{fmtCLP(desviacionMat)}
                      </td>
                      <td className="py-2 pr-3 text-right text-xs text-muted-foreground">
                        {materialesEstimado > 0 ? `${((desviacionMat / materialesEstimado) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                <span className="text-red-600">Rojo</span> = pagaste/gastaste más de lo estimado.
                <span className="text-green-600 ml-2">Verde</span> = pagaste/gastaste menos.
                La desviación negativa en MO suele venir de ajustes manuales en cada OT cuando le pagas distinto al pintor.
              </p>

              {moPinturaConDiferencia.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowMoDetalle(!showMoDetalle)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showMoDetalle ? "▼" : "▶"} Ver detalle por servicio ({moPinturaConDiferencia.length} con diferencia)
                  </button>
                  {showMoDetalle && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="border-b border-border">
                          <tr className="text-left text-muted-foreground">
                            <th className="py-1.5 pr-2 font-medium">OT</th>
                            <th className="py-1.5 pr-2 font-medium">Patente</th>
                            <th className="py-1.5 pr-2 font-medium">Cliente</th>
                            <th className="py-1.5 pr-2 font-medium text-right">Piezas</th>
                            <th className="py-1.5 pr-2 font-medium text-right">Tarifa</th>
                            <th className="py-1.5 pr-2 font-medium text-right">Estimado</th>
                            <th className="py-1.5 pr-2 font-medium text-right">Real</th>
                            <th className="py-1.5 pr-2 font-medium text-right">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moPinturaConDiferencia.map((r) => (
                            <tr key={r.id} className="border-b border-border/40">
                              <td className="py-1.5 pr-2 font-mono">
                                {r.numero_ot != null ? `OT-${String(r.numero_ot).padStart(4, "0")}` : "—"}
                              </td>
                              <td className="py-1.5 pr-2 font-mono">{r.patente}</td>
                              <td className="py-1.5 pr-2 truncate max-w-[160px]">{r.cliente}</td>
                              <td className="py-1.5 pr-2 text-right">{r.piezas}</td>
                              <td className="py-1.5 pr-2 text-right">${r.tarifa.toLocaleString("es-CL")}</td>
                              <td className="py-1.5 pr-2 text-right">{fmtCLP(r.estimado)}</td>
                              <td className="py-1.5 pr-2 text-right">{fmtCLP(r.real)}</td>
                              <td className={`py-1.5 pr-2 text-right font-medium ${r.diff > 0 ? "text-red-600" : "text-green-600"}`}>
                                {r.diff >= 0 ? "+" : ""}{fmtCLP(r.diff)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico Pintura — últimos 6 meses */}
          {pinturaHistorico.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Histórico Pintura — últimos 6 meses
                  <InfoTip>
                    Para detectar tendencias del pintor (a trato) y proveedores de materiales.
                    Si la desviación es consistentemente positiva en MO, podrías estar pagando más de la tarifa.
                    Si lo es en materiales, los precios subieron o estás comprando de más.
                  </InfoTip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Mes</th>
                        <th className="py-2 pr-3 font-medium text-right">Piezas</th>
                        <th className="py-2 pr-3 font-medium text-right">MO estimada</th>
                        <th className="py-2 pr-3 font-medium text-right">MO real</th>
                        <th className="py-2 pr-3 font-medium text-right">Δ MO</th>
                        <th className="py-2 pr-3 font-medium text-right">Mat. estimado</th>
                        <th className="py-2 pr-3 font-medium text-right">Mat. real</th>
                        <th className="py-2 pr-3 font-medium text-right">Δ Mat.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pinturaHistorico.map((r) => {
                        const dMO = r.mo_real - r.mo_estimada
                        const dMat = r.mat_real - r.mat_estimado
                        const [y, m] = r.mes.split("-").map(Number)
                        const label = new Date(y, m - 1, 1).toLocaleDateString("es-CL", { month: "short", year: "2-digit" })
                        return (
                          <tr key={r.mes} className="border-b border-border/50">
                            <td className="py-2 pr-3 font-medium capitalize">{label}</td>
                            <td className="py-2 pr-3 text-right">{r.piezas % 1 === 0 ? r.piezas : r.piezas.toFixed(1)}</td>
                            <td className="py-2 pr-3 text-right text-muted-foreground">{fmtCLP(r.mo_estimada)}</td>
                            <td className="py-2 pr-3 text-right">{fmtCLP(r.mo_real)}</td>
                            <td className={`py-2 pr-3 text-right font-medium ${dMO === 0 ? "text-muted-foreground" : dMO > 0 ? "text-red-600" : "text-green-600"}`}>
                              {r.mo_estimada === 0 ? "—" : `${dMO >= 0 ? "+" : ""}${fmtCLP(dMO)}`}
                            </td>
                            <td className="py-2 pr-3 text-right text-muted-foreground">{fmtCLP(r.mat_estimado)}</td>
                            <td className="py-2 pr-3 text-right">{fmtCLP(r.mat_real)}</td>
                            <td className={`py-2 pr-3 text-right font-medium ${dMat === 0 ? "text-muted-foreground" : dMat > 0 ? "text-red-600" : "text-green-600"}`}>
                              {r.mat_estimado === 0 && r.mat_real === 0 ? "—" : `${dMat >= 0 ? "+" : ""}${fmtCLP(dMat)}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  <span className="text-red-600">Rojo</span> = pagaste/gastaste más de lo estimado en ese mes.
                  <span className="text-green-600 ml-2">Verde</span> = menos. Compara la columna Δ entre meses para
                  detectar tendencias (ej. desviación creciente puede indicar precios subiendo o ajustes recurrentes).
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TOP CLIENTES (DOBLE RANKING) ─────────────────────────────────── */}
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-4 h-4" /> Top clientes — Cobrado
                  <InfoTip>Solo servicios cerrados/pagados. Refleja dinero efectivamente recibido.</InfoTip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topClientesCobrado.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin datos este mes</p>
                ) : (
                  <div className="space-y-2">
                    {topClientesCobrado.map((c, i) => (
                      <div key={c.cliente} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.cliente}</p>
                          <p className="text-xs text-muted-foreground">{c.count} servicio(s)</p>
                        </div>
                        <span className="text-sm font-semibold shrink-0">{fmtCLP(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-4 h-4" /> Top clientes — Facturado
                  <InfoTip>Todos los servicios con monto asignado, incluye por cobrar. Refleja volumen producido.</InfoTip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topClientesFacturado.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin datos este mes</p>
                ) : (
                  <div className="space-y-2">
                    {topClientesFacturado.map((c, i) => (
                      <div key={c.cliente} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.cliente}</p>
                          <p className="text-xs text-muted-foreground">{c.count} servicio(s)</p>
                        </div>
                        <span className="text-sm font-semibold shrink-0">{fmtCLP(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── IVA (criterio SII por fecha_facturacion) ─────────────────────── */}
        <TabsContent value="iva" className="space-y-6">
          <div className="rounded-lg border border-blue-300/40 bg-blue-50 dark:bg-blue-900/10 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
            <p>
              <span className="font-medium text-foreground">Criterio SII:</span> el IVA débito se calcula por
              <code className="mx-1 px-1 bg-muted rounded">fecha_facturacion</code> (cuándo se EMITIÓ la factura),
              no por fecha de ingreso del auto al taller. Coincide con lo que se declara mensualmente al SII.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <ArrowUpRight className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">IVA Débito (ventas)</p>
                    <p className="text-xl font-bold">{fmtCLP(ivaData.totalDebitoIva)}</p>
                    <p className="text-xs text-muted-foreground">
                      {ivaData.debitoRows.length} servicio{ivaData.debitoRows.length !== 1 ? "s" : ""} con IVA
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <ArrowDownRight className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">IVA Crédito (compras c/factura)</p>
                    <p className="text-xl font-bold">{fmtCLP(ivaData.totalCreditoIva)}</p>
                    <p className="text-xs text-muted-foreground">
                      {ivaData.creditoRows.length} item{ivaData.creditoRows.length !== 1 ? "s" : ""} con factura
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={ivaData.ivaNeto > 0 ? "border-orange-500/40 bg-orange-500/5" : "border-green-500/40 bg-green-500/5"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${ivaData.ivaNeto > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                    <Receipt className={`w-5 h-5 ${ivaData.ivaNeto > 0 ? "text-orange-600" : "text-green-600"}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">IVA Neto a pagar al SII</p>
                    <p className={`text-xl font-bold ${ivaData.ivaNeto > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {fmtCLP(ivaData.ivaNeto)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ivaData.ivaNeto > 0 ? "Débito > Crédito" : "Crédito ≥ Débito"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-red-600" /> IVA Débito — Servicios facturados en el mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ivaData.debitoRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin servicios con IVA facturados este mes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Fecha factura</th>
                        <th className="py-2 pr-3 font-medium">Patente</th>
                        <th className="py-2 pr-3 font-medium">Cliente</th>
                        <th className="py-2 pr-3 font-medium text-right">Neto</th>
                        <th className="py-2 pr-3 font-medium text-right">IVA</th>
                        <th className="py-2 pr-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ivaData.debitoRows.map((r) => (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-2 pr-3 text-xs">{formatFechaDMA(r.fecha)}</td>
                          <td className="py-2 pr-3 font-mono text-xs">{r.patente}</td>
                          <td className="py-2 pr-3">{r.cliente}</td>
                          <td className="py-2 pr-3 text-right">{fmtCLP(r.neto)}</td>
                          <td className="py-2 pr-3 text-right text-red-600 font-medium">{fmtCLP(r.iva)}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{fmtCLP(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td colSpan={3} className="py-2 pr-3 text-right text-muted-foreground">Total</td>
                        <td className="py-2 pr-3 text-right">{fmtCLP(ivaData.totalDebitoNeto)}</td>
                        <td className="py-2 pr-3 text-right text-red-600">{fmtCLP(ivaData.totalDebitoIva)}</td>
                        <td className="py-2 pr-3 text-right">{fmtCLP(ivaData.totalDebitoBruto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-green-600" /> IVA Crédito — Compras con factura
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ivaData.creditoRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin compras marcadas como factura este mes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Fecha</th>
                        <th className="py-2 pr-3 font-medium">Origen</th>
                        <th className="py-2 pr-3 font-medium">Descripción</th>
                        <th className="py-2 pr-3 font-medium text-right">Bruto</th>
                        <th className="py-2 pr-3 font-medium text-right">IVA recuperable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ivaData.creditoRows.map((r, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 pr-3 text-xs">{formatFechaDMA(r.fecha)}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{r.origen}</td>
                          <td className="py-2 pr-3">{r.descripcion}</td>
                          <td className="py-2 pr-3 text-right">{fmtCLP(r.bruto)}</td>
                          <td className="py-2 pr-3 text-right text-green-600 font-medium">{fmtCLP(r.iva)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td colSpan={3} className="py-2 pr-3 text-right text-muted-foreground">Total</td>
                        <td className="py-2 pr-3 text-right">{fmtCLP(ivaData.totalCreditoBruto)}</td>
                        <td className="py-2 pr-3 text-right text-green-600">{fmtCLP(ivaData.totalCreditoIva)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COMPARAR MESES (corregido) ──────────────────────────────────── */}
        <TabsContent value="comparar" className="space-y-6">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium">Comparar con:</p>
            <input
              type="month"
              value={compMonth}
              onChange={(e) => setCompMonth(e.target.value)}
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
            />
            <Button size="sm" onClick={loadCompData} disabled={compLoading}>
              {compLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Cargar"}
            </Button>
          </div>

          {compData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Ingresos Cobrados",
                  cur: kpis.ingresoCobrado,
                  comp: compData.kpis.ingresoCobrado,
                },
                {
                  label: "Ingresos Facturados",
                  cur: kpis.ingresoFacturado,
                  comp: compData.kpis.ingresoFacturado,
                },
                {
                  label: "Gastos Totales",
                  cur: kpis.costosDirectos + kpis.gastosOperativos,
                  comp: compData.kpis.costosDirectos + compData.kpis.gastosOperativos,
                },
                {
                  label: "Utilidad Neta",
                  cur: kpis.utilidadNeta,
                  comp: compData.kpis.utilidadNeta,
                },
                {
                  label: "Servicios facturados",
                  cur: kpis.serviciosCount,
                  comp: compData.kpis.serviciosCount,
                  isCurrency: false,
                },
                {
                  label: "Margen %",
                  cur: kpis.margenPct ?? 0,
                  comp: compData.kpis.margenPct ?? 0,
                  isCurrency: false,
                  isPct: true,
                },
                {
                  label: "Sueldos Devengados",
                  cur: kpis.sueldosDevengados,
                  comp: compData.kpis.sueldosDevengados,
                },
                {
                  label: "IVA Neto",
                  cur: kpis.ivaNetoMes,
                  comp: compData.kpis.ivaNetoMes,
                },
              ].map(({ label, cur, comp, isCurrency = true, isPct = false }) => {
                const diff = cur - comp
                const pct = comp !== 0 ? ((diff / Math.abs(comp)) * 100).toFixed(1) : null
                const up = diff >= 0
                const fmt = (v: number) =>
                  isPct ? `${v.toFixed(1)}%` : isCurrency ? fmtCLP(v) : String(v)
                return (
                  <Card key={label}>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{monthName.split(" ")[0]}</span>
                          <span className="font-semibold">{fmt(cur)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{compMonthName.split(" ")[0]}</span>
                          <span className="font-semibold">{fmt(comp)}</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium ${up ? "text-green-500" : "text-red-500"}`}>
                        {diff === 0 ? <Minus className="w-3 h-3" /> : up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {pct ? `${up ? "+" : ""}${pct}%` : "—"}
                        <span className="text-muted-foreground font-normal">vs período</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Selecciona un mes y presiona "Cargar" para comparar.</p>
          )}
        </TabsContent>

      </Tabs>
    </div>
  )
}
