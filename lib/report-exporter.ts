import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { getServicios, getGastos, getDashboardKPIs } from "./local-storage"

export function exportMonthlyReportPDF(month: string) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFontSize(20)
  doc.text("REPORTE MENSUAL", pageWidth / 2, 20, { align: "center" })
  doc.setFontSize(12)
  doc.text(`Período: ${month}`, pageWidth / 2, 28, { align: "center" })
  doc.text("Automotora RS", pageWidth / 2, 35, { align: "center" })

  // KPIs
  const kpis = getDashboardKPIs()
  doc.setFontSize(14)
  doc.text("Resumen Ejecutivo", 14, 50)

  const kpiData = [
    ["Ingresos Sin IVA", `$${kpis.ingresosTotalesSinIva.toLocaleString("es-CL")}`],
    ["Ingresos Con IVA", `$${kpis.ingresosTotalesConIva.toLocaleString("es-CL")}`],
    ["Gastos Totales", `$${kpis.gastosTotales.toLocaleString("es-CL")}`],
    ["Utilidad Operacional", `$${kpis.utilidadOperacional.toLocaleString("es-CL")}`],
    ["Margen Promedio", `${kpis.margenPromedio.toFixed(2)}%`],
    ["Total Por Cobrar", `$${kpis.totalPorCobrar.toLocaleString("es-CL")}`],
    ["Servicios Activos", kpis.serviciosActivos.toString()],
    ["Servicios Cerrados", kpis.serviciosCerrados.toString()],
  ]

  autoTable(doc, {
    startY: 55,
    head: [["Métrica", "Valor"]],
    body: kpiData,
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  // Services Summary
  const servicios = getServicios()
  doc.setFontSize(14)
  doc.text("Servicios del Período", 14, (doc as any).lastAutoTable.finalY + 15)

  const serviciosData = servicios.map((s) => [
    s.patente,
    s.nombre_cliente,
    s.estado,
    `$${s.monto_total_con_iva.toLocaleString("es-CL")}`,
    `$${s.saldo_pendiente.toLocaleString("es-CL")}`,
  ])

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["Patente", "Cliente", "Estado", "Total", "Saldo"]],
    body: serviciosData.length > 0 ? serviciosData : [["No hay servicios registrados", "", "", "", ""]],
    theme: "striped",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  // Expenses Summary
  const gastos = getGastos()
  const gastosPorCategoria = gastos.reduce(
    (acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
      return acc
    },
    {} as Record<string, number>,
  )

  doc.addPage()
  doc.setFontSize(14)
  doc.text("Gastos por Categoría", 14, 20)

  const gastosData = Object.entries(gastosPorCategoria).map(([categoria, monto]) => [
    categoria,
    `$${monto.toLocaleString("es-CL")}`,
  ])

  autoTable(doc, {
    startY: 25,
    head: [["Categoría", "Monto"]],
    body: gastosData.length > 0 ? gastosData : [["No hay gastos registrados", ""]],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
      align: "center",
    })
    doc.text(`Generado: ${new Date().toLocaleString("es-CL")}`, 14, doc.internal.pageSize.getHeight() - 10)
  }

  doc.save(`reporte-${month}.pdf`)
}

export function exportServicesToExcel() {
  const servicios = getServicios()

  // Create CSV content
  const headers = [
    "Patente",
    "Marca",
    "Modelo",
    "Año",
    "Cliente",
    "Teléfono",
    "Fecha Ingreso",
    "Estado",
    "Incluye IVA",
    "Monto Sin IVA",
    "Monto IVA",
    "Monto Con IVA",
    "Monto Pagado",
    "Saldo Pendiente",
    "Margen Rentabilidad",
  ]

  const rows = servicios.map((s) => [
    s.patente,
    s.marca || "",
    s.modelo || "",
    s.año?.toString() || "",
    s.nombre_cliente,
    s.telefono_cliente || "",
    s.fecha_ingreso,
    s.estado,
    s.incluye_iva ? "Sí" : "No",
    s.monto_total_sin_iva,
    s.monto_iva,
    s.monto_total_con_iva,
    s.monto_pagado,
    s.saldo_pendiente,
    s.margen_rentabilidad.toFixed(2),
  ])

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

  // Download as CSV
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `servicios-${new Date().toISOString().split("T")[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportGastosToExcel() {
  const gastos = getGastos()

  // Create CSV content
  const headers = ["Fecha", "Categoría", "Descripción", "Monto"]

  const rows = gastos.map((g) => [g.fecha, g.categoria, g.descripcion, g.monto])

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

  // Download as CSV
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `gastos-${new Date().toISOString().split("T")[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
