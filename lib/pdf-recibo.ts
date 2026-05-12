import jsPDF from "jspdf"
import type { Servicio } from "./database"
import { formatFechaDMA } from "./utils"

const LOGO_URL = "/logo-sarmiento.svg"

async function loadLogo(): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const scale = 3
      const w = (img.width || 560) * scale
      const h = (img.height || 200) * scale
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => resolve("")
    img.src = LOGO_URL
  })
}

function parseCobros(v: any): any[] {
  let val = v
  while (typeof val === "string" && val) {
    try { val = JSON.parse(val) } catch { return [] }
  }
  if (Array.isArray(val)) return val
  if (val && typeof val === "object") return Object.values(val).flatMap((i: any) => Array.isArray(i) ? i : [])
  return []
}

export async function generarReciboPDF(servicio: Servicio): Promise<{ blobUrl: string; fileName: string }> {
  const doc = new jsPDF()
  const logoBase64 = await loadLogo()

  // ── Header ──────────────────────────────────────────
  // Wide logo on the left (560x200 aspect ≈ 2.8:1)
  if (logoBase64) doc.addImage(logoBase64, "PNG", 15, 10, 75, 27)

  // Contact info on the right
  doc.setTextColor(80, 80, 80)
  doc.setFont("helvetica", "bold"); doc.setFontSize(8)
  doc.text("automotora.rs@gmail.com", 195, 16, { align: "right" })
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
  doc.text("FRANKLIN 605", 195, 22, { align: "right" })
  doc.text("FONO +569 91390267", 195, 27, { align: "right" })
  doc.setTextColor(20, 20, 20); doc.setFontSize(7)
  doc.text("RUT 76.858.081-2", 195, 33, { align: "right" })
  doc.setTextColor(0, 0, 0)

  // Blue separator + thin gray line
  doc.setDrawColor(15, 56, 114); doc.setLineWidth(1.2)
  doc.line(15, 42, 195, 42)
  doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.3)
  doc.line(15, 44.5, 195, 44.5)
  doc.setDrawColor(0, 0, 0)

  // ── Título ──────────────────────────────────────────
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("RECIBO DE PAGO", 105, 53, { align: "center" })

  // ── Metadatos ────────────────────────────────────────
  const fechaHoy = formatFechaDMA(new Date())
  const otNum = servicio.numero_ot ? `OT-${String(servicio.numero_ot).padStart(4, "0")}` : ""

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  if (otNum) {
    doc.text(`N° ${otNum}`, 15, 62)
  }
  doc.text(`Fecha: ${fechaHoy}`, 195, 62, { align: "right" })

  // ── Datos del cliente ────────────────────────────────
  let y = 72
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("CLIENTE:", 15, y)
  doc.setFont("helvetica", "normal")
  doc.text(servicio.cliente?.toUpperCase() || "", 42, y)

  if (servicio.telefono) {
    y += 6
    doc.setFont("helvetica", "bold")
    doc.text("TELÉFONO:", 15, y)
    doc.setFont("helvetica", "normal")
    doc.text(servicio.telefono, 42, y)
  }

  // ── Datos del vehículo ───────────────────────────────
  y += 10
  const colW = [30, 30, 30, 20, 35, 25]
  const headers = ["MARCA", "MODELO", "PATENTE", "AÑO", "KILOMETRAJE", "COLOR"]
  const vehiculoVals = [
    servicio.marca || "",
    servicio.modelo || "",
    servicio.patente || "",
    servicio.año?.toString() || "",
    servicio.kilometraje?.toString() || "",
    servicio.color || "",
  ]

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  let xPos = 15
  headers.forEach((h, i) => {
    doc.rect(xPos, y, colW[i], 7)
    doc.text(h, xPos + 2, y + 5)
    xPos += colW[i]
  })
  doc.setFont("helvetica", "normal")
  xPos = 15
  vehiculoVals.forEach((val, i) => {
    doc.rect(xPos, y + 7, colW[i], 7)
    doc.text(val, xPos + 2, y + 12)
    xPos += colW[i]
  })

  // ── Trabajos realizados ──────────────────────────────
  y += 22
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("TRABAJOS REALIZADOS:", 15, y)
  y += 6

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

  const cobrosPorCat: Record<string, { descripcion: string; monto: number }[]> = {}

  // Piezas pintadas (van bajo "Pintura")
  const piezas = parseCobros(servicio.piezas_pintura)
  piezas.forEach((p: any) => {
    if (!cobrosPorCat["Pintura"]) cobrosPorCat["Pintura"] = []
    cobrosPorCat["Pintura"].push({ descripcion: p.nombre, monto: Number(p.precio || 0) })
  })

  // Cobros por categoría
  parseCobros(servicio.cobros).forEach((c: any) => {
    const key = CAT_LABELS[c.categoria?.toLowerCase().trim()] || c.categoria || "Otros"
    if (!cobrosPorCat[key]) cobrosPorCat[key] = []
    cobrosPorCat[key].push({ descripcion: c.descripcion, monto: Number(c.monto || 0) })
  })

  const cats = [...CAT_ORDER.filter((c) => cobrosPorCat[c]), ...Object.keys(cobrosPorCat).filter((c) => !CAT_ORDER.includes(c))]

  doc.setFontSize(9)
  cats.forEach((cat) => {
    doc.setFont("helvetica", "bold")
    doc.text(`${cat.toUpperCase()}:`, 15, y)
    y += 5

    doc.setFont("helvetica", "normal")
    cobrosPorCat[cat].forEach((item) => {
      const lines = doc.splitTextToSize(`• ${item.descripcion}`, 145) || []
      doc.text(lines, 20, y)
      if (item.monto > 0) {
        doc.text(`$${Math.round(item.monto).toLocaleString("es-CL")}`, 190, y, { align: "right" })
      }
      y += 5 * lines.length
    })
    y += 2
  })

  // ── Totales ──────────────────────────────────────────
  const totY = Math.max(y + 8, 210)
  const totX = 130

  doc.setLineWidth(0.3)
  doc.line(15, totY - 4, 195, totY - 4)

  const montoSinIva = Number(servicio.monto_total_sin_iva || 0)
  const montoIva = servicio.iva === "con" ? Math.round(montoSinIva * 0.19) : 0
  const montoTotal = montoSinIva + montoIva
  const anticipo = Number(servicio.anticipo || 0)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  doc.text("SUB-TOTAL:", totX, totY)
  doc.text(`$${montoSinIva.toLocaleString("es-CL")}`, 195, totY, { align: "right" })

  if (servicio.iva === "con") {
    doc.text("IVA (19%):", totX, totY + 7)
    doc.text(`$${montoIva.toLocaleString("es-CL")}`, 195, totY + 7, { align: "right" })
  }

  doc.setFont("helvetica", "bold")
  doc.text("TOTAL:", totX, totY + 14)
  doc.text(`$${montoTotal.toLocaleString("es-CL")}`, 195, totY + 14, { align: "right" })

  if (anticipo > 0) {
    doc.setFont("helvetica", "normal")
    doc.text("Anticipo recibido:", totX, totY + 21)
    doc.text(`$${anticipo.toLocaleString("es-CL")}`, 195, totY + 21, { align: "right" })

    doc.setFont("helvetica", "bold")
    doc.text("SALDO CANCELADO:", totX, totY + 28)
    doc.text(`$${(montoTotal - anticipo).toLocaleString("es-CL")}`, 195, totY + 28, { align: "right" })
  }

  // ── Sello PAGADO ─────────────────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(28)
  doc.setTextColor(34, 197, 94) // verde
  doc.text("✓ PAGADO", 60, totY + 22)
  doc.setTextColor(0, 0, 0)

  // ── Pie de página ────────────────────────────────────
  const pieY = 278
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("AUTOMOTORA RS agradece su preferencia.", 105, pieY, { align: "center" })

  // Generar blob para preview
  const blob = doc.output("blob")
  const blobUrl = URL.createObjectURL(blob)
  const fileName = `Recibo_${servicio.patente}_${new Date().toISOString().split("T")[0]}.pdf`

  return { blobUrl, fileName }
}
