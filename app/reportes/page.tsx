"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, TrendingUp, TrendingDown, DollarSign, Wrench, RefreshCw, Users, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { ProfitabilityAnalysis } from "@/components/profitability-analysis"
import { useMonth } from "@/lib/month-context"
import { api, type Servicio, type Gasto } from "@/lib/api-client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

export default function ReportsPage() {
  const { selectedMonth } = useMonth()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [abonos, setAbonos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Comparison month
  const prevMonth = (() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  const [compMonth, setCompMonth] = useState(prevMonth)
  const [compServicios, setCompServicios] = useState<Servicio[]>([])
  const [compGastos, setCompGastos] = useState<Gasto[]>([])
  const [compAbonos, setCompAbonos] = useState<any[]>([])
  const [compLoading, setCompLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      const [serviciosData, gastosData, abonosData] = await Promise.all([
        api.servicios.getByMonth(year, month),
        api.gastos.getByMonth(year, month),
        api.abonos.getByMonth(year, month),
      ])
      setServicios(serviciosData)
      setGastos(gastosData)
      setAbonos(abonosData)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Calculate KPIs
  const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")
  const ingresosTotales = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva), 0)
  const ingresosBrutos = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total), 0)

  const gastosFijos = gastos.filter((g) => g.categoria === "Gastos Fijos").reduce((sum, g) => sum + Number(g.monto), 0)
  const gastosPintura = gastos
    .filter((g) => g.categoria === "Gastos de Pintura")
    .reduce((sum, g) => sum + Number(g.monto), 0)
  const gastosMiscelaneos = gastos
    .filter((g) => g.categoria === "Gastos Misceláneos")
    .reduce((sum, g) => sum + Number(g.monto), 0)
  const gastosSueldos = abonos.reduce((sum, a) => sum + Number(a.monto), 0)
  const totalGastos = gastos.filter((g) => g.categoria !== "Sueldos").reduce((sum, g) => sum + Number(g.monto), 0) + gastosSueldos

  // Costos de servicios
  const parseArr = (v: any) => Array.isArray(v) ? v : (typeof v === "string" && v ? JSON.parse(v) : [])
  const costosServicios = servicios.reduce((sum, s) => {
    return sum + parseArr(s.costos)
      .filter((c: any) => !String(c.descripcion || "").toLowerCase().includes("materiales pintura"))
      .reduce((c: number, costo: any) => c + Number(costo.monto), 0)
  }, 0)

  const utilidadNeta = ingresosTotales - totalGastos - costosServicios
  const margenUtilidad = ingresosTotales > 0 ? (utilidadNeta / ingresosTotales) * 100 : 0

  // Chart data
  const gastosChartData = [
    { name: "Fijos", value: gastosFijos, color: "#3b82f6" },
    { name: "Pintura", value: gastosPintura, color: "#f59e0b" },
    { name: "Misceláneos", value: gastosMiscelaneos, color: "#8b5cf6" },
    { name: "Sueldos", value: gastosSueldos, color: "#10b981" },
    { name: "Servicios", value: costosServicios, color: "#ef4444" },
  ].filter((d) => d.value > 0)

  const serviciosChartData = [
    { name: "Pintura", value: servicios.filter((s) => s.observaciones_checkboxes?.includes("pintura")).length },
    {
      name: "Desabolladura",
      value: servicios.filter((s) => s.observaciones_checkboxes?.includes("desabolladura")).length,
    },
    { name: "Mecánica", value: servicios.filter((s) => s.observaciones_checkboxes?.includes("mecanica")).length },
    { name: "Otros", value: servicios.filter((s) => s.observaciones_checkboxes?.includes("otros")).length },
  ].filter((d) => d.value > 0)

  // Load comparison month data
  const loadCompData = useCallback(async () => {
    setCompLoading(true)
    try {
      const [y, m] = compMonth.split("-").map(Number)
      const [s, g, a] = await Promise.all([api.servicios.getByMonth(y, m), api.gastos.getByMonth(y, m), api.abonos.getByMonth(y, m)])
      setCompServicios(s)
      setCompGastos(g)
      setCompAbonos(a)
    } catch (e) {
      console.error(e)
    } finally {
      setCompLoading(false)
    }
  }, [compMonth])

  // Top clientes
  const topClientes = (() => {
    const map: Record<string, { cliente: string; total: number; count: number }> = {}
    for (const s of serviciosCerrados) {
      const key = s.cliente || "Sin nombre"
      if (!map[key]) map[key] = { cliente: key, total: 0, count: 0 }
      map[key].total += Number(s.monto_total_sin_iva) || 0
      map[key].count++
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
  })()

  // Ingresos por tipo de servicio
  const ingresosPorTipo = [
    { name: "Pintura", value: servicios.filter(s => s.observaciones_checkboxes?.includes("pintura")).reduce((acc, s) => acc + Number(s.monto_total_sin_iva), 0) },
    { name: "Desabolladura", value: servicios.filter(s => s.observaciones_checkboxes?.includes("desabolladura")).reduce((acc, s) => acc + Number(s.monto_total_sin_iva), 0) },
    { name: "Mecánica", value: servicios.filter(s => s.observaciones_checkboxes?.includes("mecanica")).reduce((acc, s) => acc + Number(s.monto_total_sin_iva), 0) },
    { name: "Otros", value: servicios.filter(s => s.observaciones_checkboxes?.includes("otros")).reduce((acc, s) => acc + Number(s.monto_total_sin_iva), 0) },
  ].filter(d => d.value > 0)

  // Comparison KPIs
  const compIngresos = compServicios.filter(s => s.estado === "Cerrado/Pagado").reduce((sum, s) => sum + Number(s.monto_total_sin_iva), 0)
  const compGastosTot = compGastos.filter(g => g.categoria !== "Sueldos").reduce((sum, g) => sum + Number(g.monto), 0) + compAbonos.reduce((sum, a) => sum + Number(a.monto), 0)
  const compCostos = compServicios.reduce((sum, s) => sum + parseArr(s.costos).filter((x: any) => !String(x.descripcion || "").toLowerCase().includes("materiales pintura")).reduce((c: number, x: any) => c + Number(x.monto), 0), 0)
  const compUtilidad = compIngresos - compGastosTot - compCostos

  const [selYear, selMonth] = selectedMonth.split("-").map(Number)
  const monthName = new Date(selYear, selMonth - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" })
  const [compYear, compMonthNum] = compMonth.split("-").map(Number)
  const compMonthName = new Date(compYear, compMonthNum - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" })

  const exportarPDF = () => {
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text("Reporte Mensual - Taller", 14, 22)
    doc.setFontSize(12)
    doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), 14, 30)

    autoTable(doc, {
      startY: 38,
      head: [["Indicador", "Valor"]],
      body: [
        ["Ingresos Netos (sin IVA)", `$${ingresosTotales.toLocaleString("es-CL")}`],
        ["Ingresos Brutos (con IVA)", `$${ingresosBrutos.toLocaleString("es-CL")}`],
        ["Gastos Totales", `$${(totalGastos + costosServicios).toLocaleString("es-CL")}`],
        ["Utilidad Neta", `$${utilidadNeta.toLocaleString("es-CL")}`],
        ["Margen de Utilidad", `${margenUtilidad.toFixed(1)}%`],
        ["Total Servicios", servicios.length.toString()],
        ["Servicios Cerrados/Pagados", serviciosCerrados.length.toString()],
      ],
      theme: "grid",
    })

    const afterKpis = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(12)
    doc.text("Desglose de Gastos", 14, afterKpis)

    autoTable(doc, {
      startY: afterKpis + 6,
      head: [["Categoría", "Monto"]],
      body: [
        ["Gastos Fijos", `$${gastosFijos.toLocaleString("es-CL")}`],
        ["Gastos de Pintura", `$${gastosPintura.toLocaleString("es-CL")}`],
        ["Gastos Misceláneos", `$${gastosMiscelaneos.toLocaleString("es-CL")}`],
        ["Sueldos", `$${gastosSueldos.toLocaleString("es-CL")}`],
        ["Costos de Servicios", `$${costosServicios.toLocaleString("es-CL")}`],
        ["Total", `$${(totalGastos + costosServicios).toLocaleString("es-CL")}`],
      ],
      theme: "grid",
    })

    const afterGastos = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(12)
    doc.text("Servicios del Mes", 14, afterGastos)

    autoTable(doc, {
      startY: afterGastos + 6,
      head: [["Fecha", "Patente", "Cliente", "Marca/Modelo", "Estado", "Monto"]],
      body: servicios.map((s) => [
        new Date(s.fecha_ingreso).toLocaleDateString("es-CL"),
        s.patente,
        s.cliente,
        `${s.marca} ${s.modelo}`,
        s.estado,
        `$${Number(s.monto_total_sin_iva).toLocaleString("es-CL")}`,
      ]),
      theme: "striped",
      styles: { fontSize: 8 },
    })

    doc.save(`reporte-${selectedMonth}.pdf`)
  }

  const exportarExcelServicios = () => {
    const data = servicios.map((s) => ({
      Fecha: new Date(s.fecha_ingreso).toLocaleDateString("es-CL"),
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
      Fecha: new Date(g.fecha).toLocaleDateString("es-CL"),
      Categoría: g.categoria,
      Descripción: g.descripcion,
      Monto: Number(g.monto),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Gastos")
    XLSX.writeFile(wb, `gastos-${selectedMonth}.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes y Análisis</h1>
          <p className="text-muted-foreground mt-1 capitalize">{monthName}</p>
        </div>
        <div className="flex gap-2">
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
              <DropdownMenuItem onClick={exportarPDF}>
                <Download className="w-4 h-4 mr-2" />
                Reporte Mensual PDF
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

        <TabsList className="mb-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
          <TabsTrigger value="clientes">Top Clientes</TabsTrigger>
          <TabsTrigger value="comparar">Comparar meses</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ingresos Netos</p>
                <p className="text-xl font-bold">${ingresosTotales.toLocaleString("es-CL")}</p>
                <p className="text-xs text-muted-foreground">Solo cerrados/pagados</p>
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
              <div>
                <p className="text-xs text-muted-foreground">Gastos Totales</p>
                <p className="text-xl font-bold">${(totalGastos + costosServicios).toLocaleString("es-CL")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilidad Neta</p>
                <p className={`text-xl font-bold ${utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${utilidadNeta.toLocaleString("es-CL")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Wrench className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Servicios</p>
                <p className="text-xl font-bold">{servicios.length}</p>
                <p className="text-xs text-muted-foreground">{serviciosCerrados.length} cerrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Desglose de Gastos</CardTitle>
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
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {gastosChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString("es-CL")}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                No hay gastos registrados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Servicios por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {serviciosChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={serviciosChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Cantidad" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                No hay servicios registrados
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gastos Fijos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${gastosFijos.toLocaleString("es-CL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gastos de Pintura</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${gastosPintura.toLocaleString("es-CL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Costos de Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${costosServicios.toLocaleString("es-CL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sueldos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${gastosSueldos.toLocaleString("es-CL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ingresos Brutos (c/IVA)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${ingresosBrutos.toLocaleString("es-CL")}</p>
          </CardContent>
        </Card>
        <Card
          className={
            margenUtilidad >= 20 ? "border-green-200" : margenUtilidad >= 0 ? "border-orange-200" : "border-red-200"
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Margen de Utilidad</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${margenUtilidad >= 20 ? "text-green-600" : margenUtilidad >= 0 ? "text-orange-600" : "text-red-600"}`}
            >
              {margenUtilidad.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        {/* ── RENTABILIDAD ── */}
        <TabsContent value="rentabilidad">
          <ProfitabilityAnalysis />
        </TabsContent>

        {/* ── TOP CLIENTES ── */}
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking por ingresos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-4 h-4" /> Top clientes por ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topClientes.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin datos este mes</p>
                ) : (
                  <div className="space-y-2">
                    {topClientes.map((c, i) => (
                      <div key={c.cliente} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.cliente}</p>
                          <p className="text-xs text-muted-foreground">{c.count} servicio(s)</p>
                        </div>
                        <span className="text-sm font-semibold shrink-0">${c.total.toLocaleString("es-CL")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ingresos por tipo de servicio */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ingresos por tipo de servicio</CardTitle>
              </CardHeader>
              <CardContent>
                {ingresosPorTipo.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin datos este mes</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={ingresosPorTipo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [`$${v.toLocaleString("es-CL")}`, "Ingresos"]} contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                      <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Ingresos" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── COMPARAR MESES ── */}
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

          {compServicios.length > 0 || compGastos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Ingresos Netos", cur: ingresosTotales, comp: compIngresos },
                { label: "Gastos Totales", cur: totalGastos + costosServicios, comp: compGastosTot + compCostos },
                { label: "Utilidad Neta", cur: utilidadNeta, comp: compUtilidad },
                { label: "N° Servicios", cur: servicios.length, comp: compServicios.length, isCurrency: false },
              ].map(({ label, cur, comp, isCurrency = true }) => {
                const diff = cur - comp
                const pct = comp !== 0 ? ((diff / Math.abs(comp)) * 100).toFixed(1) : null
                const up = diff >= 0
                return (
                  <Card key={label}>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{monthName.split(" ")[0]}</span>
                          <span className="font-semibold">{isCurrency ? `$${cur.toLocaleString("es-CL")}` : cur}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{compMonthName.split(" ")[0]}</span>
                          <span className="font-semibold">{isCurrency ? `$${comp.toLocaleString("es-CL")}` : comp}</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium ${up ? "text-green-500" : "text-red-500"}`}>
                        {diff === 0 ? <Minus className="w-3 h-3" /> : up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {pct ? `${up ? "+" : ""}${pct}%` : "—"}
                        <span className="text-muted-foreground font-normal">vs mes anterior</span>
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
