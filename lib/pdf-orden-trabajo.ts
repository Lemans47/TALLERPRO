import jsPDF from "jspdf"
import type { Servicio } from "@/lib/database"

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

export async function generarOrdenTrabajo(servicio: Servicio) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })

  const PW = 210
  const ML = 10
  const MR = 200
  const CW = MR - ML

  const MONTO_W = 48
  const DESC_W = CW - MONTO_W

  const logoBase64 = await loadImageAsBase64("/car-logo.png")

  const bold = () => doc.setFont("helvetica", "bold")
  const normal = () => doc.setFont("helvetica", "normal")
  const setBlack = () => doc.setTextColor(0, 0, 0)
  const up = (s: string) => (s || "").toUpperCase()
  const fmt = (n: number) => (n > 0 ? `$${n.toLocaleString("es-CL")}` : "-")

  // ─── HEADER ───────────────────────────────────────────────────────
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", ML, 10, 45, 28)
  } else {
    doc.setDrawColor(180, 180, 180)
    doc.setFillColor(240, 240, 240)
    doc.roundedRect(ML, 10, 45, 28, 2, 2, "FD")
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text("Automotora RS", ML + 8, 26)
    doc.setDrawColor(0, 0, 0)
  }

  setBlack()
  bold()
  doc.setFontSize(7)
  doc.text("AUTOMOTORA - SERVICIO INTEGRAL", ML, 43)

  doc.setTextColor(30, 80, 180)
  doc.setFontSize(22)
  bold()
  doc.text("Automotora RS", MR, 19, { align: "right" })

  setBlack()
  normal()
  doc.setFontSize(8)
  doc.text("AUTOMOTORA RS SPA", MR, 25, { align: "right" })
  doc.text("RUT 76.858.081-2", MR, 30, { align: "right" })
  doc.text("mail: automotora.rs@gmail.com", MR, 36, { align: "right" })
  doc.text("FRANKLIN 605 - FONO +569 91390267", MR, 41, { align: "right" })

  // ─── TITLE + ORDER NUMBER ─────────────────────────────────────────
  setBlack()
  bold()
  doc.setFontSize(16)
  doc.text("ORDEN DE TRABAJO", PW / 2, 50, { align: "center" })

  // Order number box (top-right)
  const orderNum = servicio.id.substring(0, 8).toUpperCase()
  const dX = MR - 55
  const dY = 53
  doc.setLineWidth(0.3)
  doc.setDrawColor(0, 0, 0)
  doc.rect(dX, dY, 22, 6)
  doc.rect(dX + 22, dY, 33, 6)
  bold()
  doc.setFontSize(8)
  doc.text("N° OT", dX + 2, dY + 4)
  normal()
  doc.text(`#${orderNum}`, dX + 24, dY + 4)

  // Date box below order number
  const fechaStr = (() => {
    const raw = servicio.fecha_ingreso?.substring(0, 10) || ""
    const [y, m, d] = raw.split("-")
    if (!y || !m || !d) return raw
    return `${d}-${m}-${y}`
  })()
  doc.rect(dX, dY + 7, 22, 6)
  doc.rect(dX + 22, dY + 7, 33, 6)
  bold()
  doc.setFontSize(8)
  doc.text("FECHA", dX + 2, dY + 11)
  normal()
  doc.text(fechaStr, dX + 24, dY + 11)

  // ─── CLIENT INFO ──────────────────────────────────────────────────
  const ci = { x: ML, y: 68, rh: 6 }
  const MID = ML + CW * 0.57

  doc.setLineWidth(0.3)
  doc.rect(ci.x, ci.y, CW, ci.rh * 3)
  for (let i = 1; i < 3; i++) doc.line(ML, ci.y + ci.rh * i, MR, ci.y + ci.rh * i)
  doc.line(MID, ci.y + ci.rh, MID, ci.y + ci.rh * 2)

  bold()
  doc.setFontSize(8)
  doc.text("CLIENTE:", ML + 1, ci.y + 4)
  doc.text("TELÉFONO:", ML + 1, ci.y + ci.rh + 4)
  doc.text("ESTADO:", MID + 2, ci.y + ci.rh + 4)
  doc.text("OBSERV.:", ML + 1, ci.y + ci.rh * 2 + 4)

  normal()
  doc.text(up(servicio.cliente), ML + 22, ci.y + 4)
  doc.text(up(servicio.telefono || ""), ML + 22, ci.y + ci.rh + 4)
  doc.text(up(servicio.estado || "En Cola"), MID + 20, ci.y + ci.rh + 4)
  if (servicio.observaciones) {
    const obs = doc.splitTextToSize(up(servicio.observaciones), CW - 22)
    doc.text(obs[0] || "", ML + 22, ci.y + ci.rh * 2 + 4)
  }

  // ─── VEHICLE TABLE ────────────────────────────────────────────────
  const vy = ci.y + ci.rh * 3 + 2
  const vehicleH = 12
  const vcols = [
    { h: "PATENTE", w: 28, v: servicio.patente || "" },
    { h: "MARCA", w: 28, v: servicio.marca || "" },
    { h: "MODELO", w: 32, v: servicio.modelo || "" },
    { h: "COLOR", w: 22, v: servicio.color || "" },
    { h: "AÑO", w: 18, v: servicio.año?.toString() || "" },
    { h: "KILOMETRAJE", w: 30, v: servicio.kilometraje?.toString() || "" },
    { h: "N° MOTOR", w: CW - 28 - 28 - 32 - 22 - 18 - 30, v: "" },
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

  // Table header
  doc.setFillColor(230, 236, 255)
  doc.rect(ML, wy, DESC_W, 6, "FD")
  doc.rect(ML + DESC_W, wy, MONTO_W, 6, "FD")
  bold()
  doc.setFontSize(8)
  doc.text("DESCRIPCIÓN DEL TRABAJO", ML + 2, wy + 4)
  doc.text("VALOR", ML + DESC_W + MONTO_W / 2, wy + 4, { align: "center" })

  const tableStartY = wy + 6
  const cobros = servicio.cobros || []
  const piezas = servicio.piezas_pintura || []
  const itemRowH = 5.5

  type DisplayRow = { type: "category"; label: string } | { type: "item"; desc: string; monto: number }
  const displayRows: DisplayRow[] = []
  const grouped: Record<string, { descripcion: string; monto: number }[]> = {}
  const categoryOrder: string[] = []

  cobros.forEach((c) => {
    const cat = c.categoria || "Sin categoría"
    if (!grouped[cat]) { grouped[cat] = []; categoryOrder.push(cat) }
    grouped[cat].push({ descripcion: c.descripcion || "", monto: Number(c.monto) || 0 })
  })

  if (piezas.length > 0) {
    if (!grouped["Pintura"]) { grouped["Pintura"] = []; categoryOrder.push("Pintura") }
    piezas.forEach((p) => {
      grouped["Pintura"].push({ descripcion: p.nombre || "", monto: Number(p.precio) || 0 })
    })
  }

  categoryOrder.forEach((cat) => {
    displayRows.push({ type: "category", label: cat })
    grouped[cat].forEach((item) => displayRows.push({ type: "item", desc: item.descripcion, monto: item.monto }))
  })

  const numRows = Math.max(displayRows.length + 2, 18)

  doc.setLineWidth(0.3)
  doc.rect(ML, tableStartY, CW, numRows * itemRowH)
  doc.line(ML + DESC_W, tableStartY, ML + DESC_W, tableStartY + numRows * itemRowH)

  displayRows.forEach((row, i) => {
    const ry = tableStartY + i * itemRowH
    doc.setDrawColor(0, 0, 0)
    doc.line(ML, ry + itemRowH, MR, ry + itemRowH)
    doc.setFontSize(8)
    if (row.type === "category") {
      bold()
      doc.setFillColor(245, 245, 245)
      doc.rect(ML, ry, CW, itemRowH, "F")
      doc.setFillColor(255, 255, 255)
      doc.text(up(`• ${row.label}`), ML + 1.5, ry + itemRowH - 1.5)
    } else {
      normal()
      doc.text(up(row.desc).substring(0, 72), ML + 5, ry + itemRowH - 1.5)
      if (row.monto > 0) {
        doc.text(fmt(row.monto), MR - 1, ry + itemRowH - 1.5, { align: "right" })
      }
    }
  })

  doc.setDrawColor(180, 180, 180)
  for (let i = displayRows.length; i < numRows; i++) {
    doc.line(ML, tableStartY + i * itemRowH, MR, tableStartY + i * itemRowH)
  }
  doc.setDrawColor(0, 0, 0)

  // ─── TOTALS ───────────────────────────────────────────────────────
  const ty = tableStartY + numRows * itemRowH
  const trh = 6
  const subtotalVal = Number(servicio.monto_total_sin_iva) || 0
  const totalVal = Number(servicio.monto_total) || 0
  const ivaVal = totalVal - subtotalVal
  const labelX = ML + DESC_W
  const labelW = 28
  const valW = MONTO_W - labelW

  // Row SUB-TOTAL
  doc.rect(labelX, ty, labelW, trh)
  doc.rect(labelX + labelW, ty, valW, trh)
  bold(); doc.setFontSize(8)
  doc.text("SUB-TOTAL", labelX + 1, ty + 4)
  normal()
  doc.text(fmt(subtotalVal), labelX + labelW + 1, ty + 4)

  // Row 19% IVA
  doc.rect(labelX, ty + trh, labelW, trh)
  doc.rect(labelX + labelW, ty + trh, valW, trh)
  bold(); doc.setFontSize(8)
  doc.text("19% IVA", labelX + 1, ty + trh + 4)
  normal()
  doc.text(fmt(ivaVal), labelX + labelW + 1, ty + trh + 4)

  // Row TOTAL
  doc.setFillColor(230, 236, 255)
  doc.rect(labelX, ty + trh * 2, labelW, trh, "FD")
  doc.rect(labelX + labelW, ty + trh * 2, valW, trh, "FD")
  doc.setFillColor(255, 255, 255)
  bold(); doc.setFontSize(9)
  doc.text("TOTAL", labelX + 1, ty + trh * 2 + 4)
  doc.text(fmt(totalVal), labelX + labelW + 1, ty + trh * 2 + 4)

  // ─── CONDITION CHECKBOXES ─────────────────────────────────────────
  const checkboxes = servicio.observaciones_checkboxes || []
  const allConditions = [
    "Parabrisas roto", "Antena", "Tapiz rasgado", "Espejo retrovisor",
    "Calefacción", "Radio", "Encendedor", "Alfombras",
    "Rueda de repuesto", "Herramientas", "Extintor", "Gato",
  ]

  const cy = ty + trh * 3 + 2
  const condH = 5
  const condCols = 3
  const condW = CW / condCols

  bold(); doc.setFontSize(7.5)
  doc.text("CONDICIÓN DEL VEHÍCULO AL INGRESO:", ML, cy + 4)

  const condStartY = cy + 6
  const condRows = Math.ceil(allConditions.length / condCols)
  doc.setLineWidth(0.2)

  allConditions.forEach((cond, i) => {
    const col = i % condCols
    const row = Math.floor(i / condCols)
    const cx = ML + col * condW
    const crY = condStartY + row * condH

    const checked = checkboxes.includes(cond)

    // Checkbox square
    doc.setDrawColor(80, 80, 80)
    doc.rect(cx + 1, crY + 0.5, 3.5, 3.5)
    if (checked) {
      bold()
      doc.setTextColor(200, 50, 50)
      doc.setFontSize(8)
      doc.text("✓", cx + 1.3, crY + 3.5)
      setBlack()
    }

    normal(); doc.setFontSize(7)
    doc.setTextColor(checked ? 200 : 60, checked ? 50 : 60, checked ? 50 : 60)
    doc.text(cond, cx + 6, crY + 3.5)
    setBlack()
  })

  // ─── SIGNATURES ───────────────────────────────────────────────────
  const sigY = condStartY + condRows * condH + 4
  const sigW = CW / 2 - 4
  doc.setLineWidth(0.3)

  // Left: Técnico recibe
  doc.rect(ML, sigY, sigW, 16)
  bold(); doc.setFontSize(8)
  doc.text("TÉCNICO RECIBE:", ML + 2, sigY + 4)
  normal()
  doc.line(ML + 2, sigY + 13, ML + sigW - 2, sigY + 13)
  doc.setFontSize(7)
  doc.text("Firma y nombre", ML + sigW / 2, sigY + 15.5, { align: "center" })

  // Right: Cliente autoriza
  const sigRX = ML + sigW + 8
  doc.rect(sigRX, sigY, sigW, 16)
  bold(); doc.setFontSize(8)
  doc.text("CLIENTE AUTORIZA:", sigRX + 2, sigY + 4)
  normal()
  doc.line(sigRX + 2, sigY + 13, sigRX + sigW - 2, sigY + 13)
  doc.setFontSize(7)
  doc.text("Firma y nombre", sigRX + sigW / 2, sigY + 15.5, { align: "center" })

  // ─── NOTES ────────────────────────────────────────────────────────
  const ny = sigY + 18
  doc.rect(ML, ny, CW, 10)
  bold(); doc.setFontSize(7)
  doc.text("NOTA:", ML + 1, ny + 3.5)
  normal()
  doc.text(
    "1.- AUTOMOTORA RS NO SE RESPONSABILIZA POR DAÑOS OCASIONADOS POR INCENDIOS U OTRAS CAUSAS DE FUERZA MAYOR.",
    ML + 12, ny + 3.5,
  )
  doc.text(
    "2.- AUTORIZO PARA MANEJAR EL VEHÍCULO FUERA DE LA AUTOMOTORA PARA PRUEBAS MECÁNICAS.",
    ML + 12, ny + 7.5,
  )

  // ─── SAVE ─────────────────────────────────────────────────────────
  const fileName = `orden-trabajo-${servicio.patente}-${servicio.fecha_ingreso.substring(0, 10)}.pdf`
  doc.save(fileName)
}
