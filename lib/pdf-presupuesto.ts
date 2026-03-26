import jsPDF from "jspdf"
import type { Servicio } from "@/lib/database"

// Place your car/logo image at /public/car-logo.png to include it in the PDF
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generarPDFPresupuesto(servicio: Servicio) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })

  const PW = 210
  const ML = 10
  const MR = 200
  const CW = MR - ML // 190mm

  // Column widths for work items
  const MONTO_W = 48
  const DESC_W = CW - MONTO_W // 142mm

  // ─── LOAD LOGO ────────────────────────────────────────────────────
  const logoBase64 = await loadImageAsBase64("/car-logo.png")

  // ─── HELPER FUNCTIONS ─────────────────────────────────────────────
  const bold = () => doc.setFont("helvetica", "bold")
  const normal = () => doc.setFont("helvetica", "normal")
  const setBlack = () => doc.setTextColor(0, 0, 0)
  const up = (s: string) => (s || "").toUpperCase()

  // ─── HEADER ───────────────────────────────────────────────────────
  // Left: car image
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", ML, 10, 45, 28)
  } else {
    // Placeholder box if no image
    doc.setDrawColor(180, 180, 180)
    doc.setFillColor(240, 240, 240)
    doc.roundedRect(ML, 10, 45, 28, 2, 2, "FD")
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text("Automotora RS", ML + 8, 26)
    doc.setDrawColor(0, 0, 0)
  }

  // "AUTOMOTORA - SERVICIO INTEGRAL" below image
  setBlack()
  bold()
  doc.setFontSize(7)
  doc.text("AUTOMOTORA - SERVICIO INTEGRAL", ML, 43)

  // Right: company name (blue, large)
  doc.setTextColor(30, 80, 180)
  doc.setFontSize(22)
  bold()
  doc.text("Automotora RS", MR, 19, { align: "right" })

  // Company details
  setBlack()
  normal()
  doc.setFontSize(8)
  doc.text("AUTOMOTORA RS SPA", MR, 25, { align: "right" })
  doc.text("RUT 76.858.081-2", MR, 30, { align: "right" })
  doc.text("mail: automotora.rs@gmail.com", MR, 36, { align: "right" })
  doc.text("FRANKLIN 605 - FONO +569 91390267", MR, 41, { align: "right" })

  // ─── TITLE ────────────────────────────────────────────────────────
  setBlack()
  bold()
  doc.setFontSize(16)
  doc.text("PRESUPUESTO", PW / 2, 50, { align: "center" })

  // ─── DATE BOX ─────────────────────────────────────────────────────
  const fechaStr = (() => {
    // fecha_ingreso may be "YYYY-MM-DD" or a full ISO string
    const raw = servicio.fecha_ingreso?.substring(0, 10) || ""
    const [y, m, d] = raw.split("-")
    if (!y || !m || !d) return raw
    return `${d}-${m}-${y}`
  })()

  doc.setLineWidth(0.3)
  doc.setDrawColor(0, 0, 0)
  const dX = MR - 55
  const dY = 53
  doc.rect(dX, dY, 22, 6)
  doc.rect(dX + 22, dY, 33, 6)
  bold()
  doc.setFontSize(8)
  doc.text("FECHA", dX + 2, dY + 4)
  normal()
  doc.text(fechaStr, dX + 24, dY + 4)

  // ─── CLIENT INFO ──────────────────────────────────────────────────
  const ci = { x: ML, y: 62, rh: 6 } // row height 6mm
  const MID = ML + CW * 0.57 // mid-point vertical divider

  doc.setLineWidth(0.3)
  doc.rect(ci.x, ci.y, CW, ci.rh * 4)
  // Horizontal row dividers
  for (let i = 1; i < 4; i++) doc.line(ML, ci.y + ci.rh * i, MR, ci.y + ci.rh * i)
  // Vertical divider for rows 2 & 3
  doc.line(MID, ci.y + ci.rh, MID, ci.y + ci.rh * 3)

  bold()
  doc.setFontSize(8)
  doc.text("NOMBRE:", ML + 1, ci.y + 4)
  doc.text("Atención:", ML + 1, ci.y + ci.rh + 4)
  doc.text("R.U.T.", MID + 2, ci.y + ci.rh + 4)
  doc.text("DOMICILIO:", ML + 1, ci.y + ci.rh * 2 + 4)
  doc.text("COMUNA", MID + 2, ci.y + ci.rh * 2 + 4)
  doc.text("OBSERV.", ML + 1, ci.y + ci.rh * 3 + 4)

  normal()
  doc.text(up(servicio.cliente), ML + 22, ci.y + 4)
  doc.text(up(servicio.telefono), ML + 22, ci.y + ci.rh + 4)
  if (servicio.observaciones) {
    const obs = doc.splitTextToSize(up(servicio.observaciones), CW - 22)
    doc.text(obs[0] || "", ML + 22, ci.y + ci.rh * 3 + 4)
  }

  // ─── VEHICLE TABLE ────────────────────────────────────────────────
  const vy = ci.y + ci.rh * 4 + 2
  const vehicleH = 12
  const vcols = [
    { h: "MARCA", w: 28, v: servicio.marca || "" },
    { h: "MODELO", w: 30, v: servicio.modelo || "" },
    { h: "COLOR", w: 22, v: servicio.color || "" },
    { h: "PATENTE", w: 25, v: servicio.patente || "" },
    { h: "KILOMETRAJE", w: 28, v: servicio.kilometraje?.toString() || "" },
    { h: "AÑO", w: 17, v: servicio.año?.toString() || "" },
    { h: "NUMERO MOTOR", w: CW - 28 - 30 - 22 - 25 - 28 - 17, v: "" },
  ]

  let vx = ML
  vcols.forEach((col) => {
    doc.rect(vx, vy, col.w, vehicleH)
    bold()
    doc.setFontSize(7)
    doc.text(col.h, vx + 1, vy + 4)
    normal()
    doc.setFontSize(8)
    doc.text(up(String(col.v)).substring(0, Math.floor(col.w / 2.2)), vx + 1, vy + 9)
    vx += col.w
  })

  // ─── WORK ITEMS TABLE ─────────────────────────────────────────────
  const wy = vy + vehicleH + 1
  const cobros = servicio.cobros || []
  const itemRowH = 5.5

  // Build display rows grouped by category
  type DisplayRow = { type: "category"; label: string } | { type: "item"; desc: string; monto: number }
  const displayRows: DisplayRow[] = []
  const grouped: Record<string, { descripcion: string; monto: number }[]> = {}
  const categoryOrder: string[] = []

  // Add cobros (charges)
  cobros.forEach((c) => {
    const cat = c.categoria || "Sin categoría"
    if (!grouped[cat]) {
      grouped[cat] = []
      categoryOrder.push(cat)
    }
    grouped[cat].push({ descripcion: c.descripcion || "", monto: Number(c.monto) || 0 })
  })

  // Add piezas_pintura under "Pintura" category
  const piezas = servicio.piezas_pintura || []
  if (piezas.length > 0) {
    if (!grouped["Pintura"]) {
      grouped["Pintura"] = []
      categoryOrder.push("Pintura")
    }
    piezas.forEach((p) => {
      grouped["Pintura"].push({ descripcion: p.nombre || "", monto: Number(p.precio) || 0 })
    })
  }

  categoryOrder.forEach((cat) => {
    displayRows.push({ type: "category", label: cat })
    grouped[cat].forEach((item) => {
      displayRows.push({ type: "item", desc: item.descripcion, monto: item.monto })
    })
  })

  const numRows = Math.max(displayRows.length + 3, 22)

  // Outer rect
  doc.rect(ML, wy, CW, numRows * itemRowH)
  // Vertical divider desc | monto
  doc.line(ML + DESC_W, wy, ML + DESC_W, wy + numRows * itemRowH)

  // Draw filled rows
  displayRows.forEach((row, i) => {
    const ry = wy + i * itemRowH
    doc.setDrawColor(0, 0, 0)
    doc.line(ML, ry + itemRowH, MR, ry + itemRowH)
    doc.setFontSize(8)
    if (row.type === "category") {
      bold()
      doc.text(up(`${row.label}:`), ML + 1.5, ry + itemRowH - 1.5)
    } else {
      normal()
      doc.text(up(row.desc).substring(0, 72), ML + 5, ry + itemRowH - 1.5)
    }
  })

  // Light gray empty row lines
  doc.setDrawColor(180, 180, 180)
  for (let i = displayRows.length; i < numRows; i++) {
    doc.line(ML, wy + i * itemRowH, MR, wy + i * itemRowH)
  }
  doc.setDrawColor(0, 0, 0)

  // ─── TOTALS / SIGNATURES ──────────────────────────────────────────
  const ty = wy + numRows * itemRowH
  const trh = 6 // total row height
  const subtotalVal = Number(servicio.monto_total_sin_iva) || 0
  const totalVal = Number(servicio.monto_total) || 0
  const ivaVal = totalVal - subtotalVal
  const fmt = (n: number) => (n > 0 ? `$${n.toLocaleString("es-CL")}` : "-")

  const labelX = ML + DESC_W
  const labelW = 28
  const valW = MONTO_W - labelW // 20mm — enough for "$460.000"

  // Row 1 — FIRMA CLIENTE / SUB-TOTAL
  doc.rect(ML, ty, DESC_W, trh)
  doc.rect(labelX, ty, labelW, trh)
  doc.rect(labelX + labelW, ty, valW, trh)
  bold()
  doc.setFontSize(8)
  doc.text("FIRMA CLIENTE", ML + 20, ty + 4)
  doc.text("RECIBI CONFORME", ML + DESC_W - 50, ty + 4)
  doc.text("SUB-TOTAL", labelX + 1, ty + 4)
  normal()
  doc.text(fmt(subtotalVal), labelX + labelW + 1, ty + 4)

  // Row 2 — AUTORIZO / 19% IVA
  doc.rect(ML, ty + trh, DESC_W, trh)
  doc.rect(labelX, ty + trh, labelW, trh)
  doc.rect(labelX + labelW, ty + trh, valW, trh)
  bold()
  doc.setFontSize(7)
  doc.text("AUTORIZO LOS TRABAJOS DESCRITOS Y ACEPTO NOTAS", ML + 2, ty + trh + 4)
  doc.text("19% IVA", labelX + 1, ty + trh + 4)
  normal()
  doc.text(fmt(ivaVal), labelX + labelW + 1, ty + trh + 4)

  // Row 3 — TOTAL (right side only)
  doc.rect(labelX, ty + trh * 2, labelW, trh)
  doc.rect(labelX + labelW, ty + trh * 2, valW, trh)
  bold()
  doc.setFontSize(8)
  doc.text("TOTAL", labelX + 1, ty + trh * 2 + 4)
  normal()
  doc.text(fmt(totalVal), labelX + labelW + 1, ty + trh * 2 + 4)

  // ─── NOTES ────────────────────────────────────────────────────────
  const ny = ty + trh * 3 + 1
  doc.rect(ML, ny, CW, 10)
  bold()
  doc.setFontSize(7)
  doc.text("NOTA:", ML + 1, ny + 3.5)
  normal()
  doc.text(
    "1.- AUTOMOTORA RS, NO SE RESPONSABILIZA POR DAÑOS OCASIONADOS POR INCENDIOS U OTRAS CAUSAS DE FUERZA MAYOR",
    ML + 12,
    ny + 3.5,
  )
  doc.text(
    "2.- AUTORIZO PARA MANEJAR EL VEHICULO FUERA DE LA AUTOMOTORA, PARA PRUEBAS MECANICAS",
    ML + 12,
    ny + 7.5,
  )

  // ─── SAVE ─────────────────────────────────────────────────────────
  const fileName = `presupuesto-${servicio.patente}-${servicio.fecha_ingreso.substring(0, 10)}.pdf`
  doc.save(fileName)
}
