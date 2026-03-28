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

  const logoBase64 = await loadImageAsBase64("/car-logo.png")

  const bold = () => doc.setFont("helvetica", "bold")
  const normal = () => doc.setFont("helvetica", "normal")
  const setBlack = () => doc.setTextColor(0, 0, 0)
  const up = (s: string) => (s || "").toUpperCase()

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

  const otNum = (servicio as any).numero_ot
    ? String((servicio as any).numero_ot).padStart(4, "0")
    : servicio.id.substring(0, 8).toUpperCase()

  const dX = MR - 55
  const dY = 53
  doc.setLineWidth(0.3)
  doc.setDrawColor(0, 0, 0)
  doc.rect(dX, dY, 22, 6)
  doc.rect(dX + 22, dY, 33, 6)
  bold(); doc.setFontSize(8)
  doc.text("N\xB0 OT", dX + 2, dY + 4)
  normal()
  doc.text(`#${otNum}`, dX + 24, dY + 4)

  const fechaStr = (() => {
    const raw = servicio.fecha_ingreso?.substring(0, 10) || ""
    const [y, m, d] = raw.split("-")
    if (!y || !m || !d) return raw
    return `${d}-${m}-${y}`
  })()
  doc.rect(dX, dY + 7, 22, 6)
  doc.rect(dX + 22, dY + 7, 33, 6)
  bold(); doc.setFontSize(8)
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

  bold(); doc.setFontSize(8)
  doc.text("CLIENTE:", ML + 1, ci.y + 4)
  doc.text("TELEFONO:", ML + 1, ci.y + ci.rh + 4)
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
    { h: "A\xD1O", w: 18, v: servicio.año?.toString() || "" },
    { h: "KILOMETRAJE", w: 30, v: servicio.kilometraje?.toString() || "" },
    { h: "N\xB0 MOTOR", w: CW - 28 - 28 - 32 - 22 - 18 - 30, v: "" },
  ]

  let vx = ML
  vcols.forEach((col) => {
    doc.rect(vx, vy, col.w, vehicleH)
    bold(); doc.setFontSize(7)
    doc.text(col.h, vx + 1, vy + 4)
    normal(); doc.setFontSize(8)
    doc.text(up(String(col.v)).substring(0, Math.floor(col.w / 2.2)), vx + 1, vy + 9)
    vx += col.w
  })

  // ─── WORK ITEMS TABLE (full width, no prices) ──────────────────────
  const wy = vy + vehicleH + 1

  // Header — full width, no price column
  doc.setFillColor(230, 236, 255)
  doc.rect(ML, wy, CW, 6, "FD")
  bold(); doc.setFontSize(8)
  doc.text("DESCRIPCION DEL TRABAJO A REALIZAR", ML + 2, wy + 4)

  const tableStartY = wy + 6
  const cobros = servicio.cobros || []
  const piezas = servicio.piezas_pintura || []
  const itemRowH = 5.5

  type DisplayRow = { type: "category"; label: string } | { type: "item"; desc: string }
  const displayRows: DisplayRow[] = []
  const grouped: Record<string, string[]> = {}
  const categoryOrder: string[] = []

  cobros.forEach((c) => {
    const cat = c.categoria || "Sin categoria"
    if (!grouped[cat]) { grouped[cat] = []; categoryOrder.push(cat) }
    grouped[cat].push(c.descripcion || "")
  })

  if (piezas.length > 0) {
    if (!grouped["Pintura"]) { grouped["Pintura"] = []; categoryOrder.push("Pintura") }
    piezas.forEach((p) => grouped["Pintura"].push(p.nombre || ""))
  }

  categoryOrder.forEach((cat) => {
    displayRows.push({ type: "category", label: cat })
    grouped[cat].forEach((desc) => displayRows.push({ type: "item", desc }))
  })

  const numRows = Math.max(displayRows.length + 2, 20)

  doc.setLineWidth(0.3)
  doc.rect(ML, tableStartY, CW, numRows * itemRowH)

  displayRows.forEach((row, i) => {
    const ry = tableStartY + i * itemRowH
    doc.setDrawColor(0, 0, 0)
    doc.line(ML, ry + itemRowH, MR, ry + itemRowH)
    doc.setFontSize(8)
    if (row.type === "category") {
      doc.setFillColor(240, 240, 240)
      doc.rect(ML, ry, CW, itemRowH, "F")
      bold()
      doc.text(`[ ${up(row.label)} ]`, ML + 2, ry + itemRowH - 1.5)
    } else {
      normal()
      doc.text(up(row.desc).substring(0, 90), ML + 6, ry + itemRowH - 1.5)
    }
  })

  doc.setDrawColor(180, 180, 180)
  for (let i = displayRows.length; i < numRows; i++) {
    doc.line(ML, tableStartY + i * itemRowH, MR, tableStartY + i * itemRowH)
  }
  doc.setDrawColor(0, 0, 0)

  // ─── CONDITION CHECKBOXES ─────────────────────────────────────────
  const ty = tableStartY + numRows * itemRowH
  const checkboxes = servicio.observaciones_checkboxes || []
  const allConditions = [
    "Parabrisas roto", "Antena", "Tapiz rasgado", "Espejo retrovisor",
    "Calefaccion", "Radio", "Encendedor", "Alfombras",
    "Rueda de repuesto", "Herramientas", "Extintor", "Gato",
  ]

  const condCols = 3
  const condW = CW / condCols
  const condH = 5

  bold(); doc.setFontSize(7.5)
  setBlack()
  doc.text("CONDICION DEL VEHICULO AL INGRESO:", ML, ty + 4)

  const condStartY = ty + 6
  const condRows = Math.ceil(allConditions.length / condCols)
  doc.setLineWidth(0.2)

  allConditions.forEach((cond, i) => {
    const col = i % condCols
    const row = Math.floor(i / condCols)
    const cx = ML + col * condW
    const crY = condStartY + row * condH
    const checked = checkboxes.includes(cond)

    doc.setDrawColor(80, 80, 80)
    doc.rect(cx + 1, crY + 0.5, 3.5, 3.5)
    if (checked) {
      bold(); doc.setTextColor(200, 50, 50); doc.setFontSize(8)
      doc.text("X", cx + 1.5, crY + 3.5)
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

  doc.rect(ML, sigY, sigW, 16)
  bold(); doc.setFontSize(8)
  doc.text("TECNICO RECIBE:", ML + 2, sigY + 4)
  normal()
  doc.line(ML + 2, sigY + 13, ML + sigW - 2, sigY + 13)
  doc.setFontSize(7)
  doc.text("Firma y nombre", ML + sigW / 2, sigY + 15.5, { align: "center" })

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
    "1.- AUTOMOTORA RS NO SE RESPONSABILIZA POR DANOS OCASIONADOS POR INCENDIOS U OTRAS CAUSAS DE FUERZA MAYOR.",
    ML + 12, ny + 3.5,
  )
  doc.text(
    "2.- AUTORIZO PARA MANEJAR EL VEHICULO FUERA DE LA AUTOMOTORA PARA PRUEBAS MECANICAS.",
    ML + 12, ny + 7.5,
  )

  // ─── SAVE ─────────────────────────────────────────────────────────
  const fileName = `orden-trabajo-${servicio.patente}-${fechaStr}.pdf`
  doc.save(fileName)
}
