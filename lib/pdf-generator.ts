import jsPDF from "jspdf"
import type { Servicio, Presupuesto } from "./database"

export function generateServicioPDF(data: Servicio | Presupuesto) {
  const doc = new jsPDF()

  // Header - Empresa
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("AUTOMOTORA RS", 105, 15, { align: "center" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("AUTOMOTORA RS SPA", 105, 21, { align: "center" })
  doc.text("RUT 76.858.081-2", 105, 26, { align: "center" })
  doc.text("FRANKLIN 605 - FONO +569 91390267", 105, 31, { align: "center" })
  doc.text("mail: automotora.rs@gmail.com", 105, 36, { align: "center" })

  // Título PRESUPUESTO
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("PRESUPUESTO", 105, 48, { align: "center" })

  // Fecha
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`FECHA: ${new Date(data.fecha_ingreso).toLocaleDateString("es-CL")}`, 150, 55)

  // Información del Cliente
  doc.setFontSize(10)
  doc.text("NOMBRE:", 20, 65)
  doc.text(data.cliente.toUpperCase(), 50, 65)

  if (data.telefono) {
    doc.text("TELÉFONO:", 20, 72)
    doc.text(data.telefono, 50, 72)
  }

  // Tabla de Información del Vehículo
  const vehiculoY = 85
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")

  // Headers de la tabla
  const colWidths = [25, 25, 30, 25, 30, 25]
  const headers = ["MARCA", "MODELO", "PATENTE", "AÑO", "KILOMETRAJE", "COLOR"]
  let xPos = 20

  headers.forEach((header, i) => {
    doc.rect(xPos, vehiculoY, colWidths[i], 8)
    doc.text(header, xPos + 2, vehiculoY + 5)
    xPos += colWidths[i]
  })

  // Datos del vehículo
  doc.setFont("helvetica", "normal")
  xPos = 20
  const vehiculoData = [
    data.marca || "",
    data.modelo || "",
    data.patente,
    data.año?.toString() || "",
    data.kilometraje?.toString() || "",
    data.color || "",
  ]

  vehiculoData.forEach((dataItem, i) => {
    doc.rect(xPos, vehiculoY + 8, colWidths[i], 8)
    doc.text(dataItem, xPos + 2, vehiculoY + 13)
    xPos += colWidths[i]
  })

  // Trabajos Realizados
  let yPos = vehiculoY + 25
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("TRABAJOS A REALIZAR:", 20, yPos)

  yPos += 7
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)

  // Agrupar cobros por categoría
  const cobrosPorCategoria: { [key: string]: { descripcion: string; monto: number }[] } = {}

  const CAT_LABELS: Record<string, string> = {
    desmontar: "Desmontar y Montar",
    desabolladura: "Desabolladura",
    reparar: "Reparar",
    pintura: "Pintura",
    mecanica: "Mecánica",
    repuestos: "Repuestos",
    otros: "Otros",
  }
  const CAT_ORDER = ["Desmontar y Montar", "Desabolladura", "Reparar", "Pintura", "Mecánica", "Repuestos", "Otros"]
  const cobrosArr = Array.isArray(data.cobros) ? data.cobros : (typeof data.cobros === "string" ? JSON.parse(data.cobros) : [])
  cobrosArr.forEach((cobro: any) => {
    const key = CAT_LABELS[cobro.categoria?.toLowerCase().trim()] || cobro.categoria
    if (!cobrosPorCategoria[key]) {
      cobrosPorCategoria[key] = []
    }
    cobrosPorCategoria[key].push({ ...cobro, categoria: key })
  })

  // Merge piezas_pintura into Pintura category
  if (data.piezas_pintura && Array.isArray(data.piezas_pintura) && data.piezas_pintura.length > 0) {
    if (!cobrosPorCategoria["Pintura"]) cobrosPorCategoria["Pintura"] = []
    data.piezas_pintura.forEach((pieza) => {
      cobrosPorCategoria["Pintura"].push({ categoria: "Pintura", descripcion: pieza.nombre, monto: pieza.precio || 0 })
    })
  }

  // Mostrar trabajos por categoría en orden fijo
  const orderedCats = [...CAT_ORDER.filter((c) => cobrosPorCategoria[c]), ...Object.keys(cobrosPorCategoria).filter((c) => !CAT_ORDER.includes(c))]
  orderedCats.forEach((categoria) => {
    const items = cobrosPorCategoria[categoria]
    doc.setFont("helvetica", "bold")
    doc.text(`${categoria.toUpperCase()}:`, 20, yPos)
    yPos += 5

    doc.setFont("helvetica", "normal")
    items.forEach((item) => {
      const wrappedLines = doc.splitTextToSize(`• ${item.descripcion}`, 170) || []
      if (wrappedLines.length > 0) {
        doc.text(wrappedLines, 25, yPos)
        yPos += 5 * wrappedLines.length
      }
    })
    yPos += 2
  })

  // Observaciones adicionales
  if (data.observaciones) {
    doc.setFont("helvetica", "bold")
    doc.text("OBSERVACIONES:", 20, yPos)
    yPos += 5

    doc.setFont("helvetica", "normal")
    const wrappedLines = doc.splitTextToSize(data.observaciones.toUpperCase(), 170) || []
    if (wrappedLines.length > 0) {
      doc.text(wrappedLines, 20, yPos)
    }
  }

  // Totales - Posicionados en la parte inferior derecha
  const totalesY = 240
  const totalesX = 130

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")

  const montoSinIva = Number(data.monto_total_sin_iva)
  const montoIva = data.iva === "con" ? Math.round(montoSinIva * 0.19) : 0
  const montoConIva = montoSinIva + montoIva

  // SUB-TOTAL
  doc.text("SUB-TOTAL", totalesX, totalesY)
  doc.text(`$${montoSinIva.toLocaleString("es-CL")}`, totalesX + 50, totalesY, { align: "right" })

  // IVA
  if (data.iva === "con") {
    doc.text("19% IVA", totalesX, totalesY + 7)
    doc.text(`$${montoIva.toLocaleString("es-CL")}`, totalesX + 50, totalesY + 7, { align: "right" })
  } else {
    doc.text("19% IVA", totalesX, totalesY + 7)
    doc.text("$0", totalesX + 50, totalesY + 7, { align: "right" })
  }

  // TOTAL
  doc.setFont("helvetica", "bold")
  doc.text("TOTAL", totalesX, totalesY + 14)
  doc.text(`$${montoConIva.toLocaleString("es-CL")}`, totalesX + 50, totalesY + 14, { align: "right" })

  // Firmas
  const firmasY = 260
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  // Líneas para firmas
  doc.line(20, firmasY, 70, firmasY)
  doc.text("FIRMA CLIENTE", 30, firmasY + 5)

  doc.line(90, firmasY, 140, firmasY)
  doc.text("RECIBI CONFORME", 95, firmasY + 5)

  // Autorización
  doc.setFontSize(8)
  doc.text("AUTORIZO LOS TRABAJOS DESCRITOS Y ACEPTO NOTAS", 20, firmasY + 12)

  // Notas al pie
  const notasY = 275
  doc.setFontSize(7)
  doc.text(
    "NOTA: 1.- AUTOMOTORA RS, NO SE RESPONSABILIZA POR DAÑOS OCASIONADOS POR INCENDIOS U OTRAS CAUSAS DE FUERZA MAYOR",
    20,
    notasY,
  )
  doc.text("      2.- AUTORIZO PARA MANEJAR EL VEHICULO FUERA DE LA AUTOMOTORA, PARA PRUEBAS MECANICAS", 20, notasY + 4)

  // Save PDF
  const fileName = `Presupuesto_${data.patente}_${new Date().toISOString().split("T")[0]}.pdf`
  doc.save(fileName)
}

export const generatePresupuestoPDF = generateServicioPDF
