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

const ML = 10
const MR = 200
const CW = MR - ML
const PAGE_H = 297
const BOTTOM_MARGIN = 20 // space reserved at bottom for notes/signatures on last page

export async function generarOrdenTrabajo(servicio: Servicio) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })

  const logoBase64 = await loadImageAsBase64("/car-logo.png")

  const bold = () => doc.setFont("helvetica", "bold")
  const normal = () => doc.setFont("helvetica", "normal")
  const black = () => doc.setTextColor(0, 0, 0)
  const up = (s: string) => (s || "").toUpperCase()

  // ─── DRAW PAGE HEADER (called for each new page) ───────────────────
  function drawPageHeader(pageNum: number): number {
    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", ML, 10, 45, 28)
    } else {
      doc.setDrawColor(180, 180, 180)
      doc.setFillColor(240, 240, 240)
      doc.roundedRect(ML, 10, 45, 28, 2, 2, "FD")
      doc.setFontSize(7); doc.setTextColor(150, 150, 150)
      doc.text("Automotora RS", ML + 8, 26)
      doc.setDrawColor(0, 0, 0)
    }
    black(); bold(); doc.setFontSize(7)
    doc.text("AUTOMOTORA - SERVICIO INTEGRAL", ML, 43)

    doc.setTextColor(30, 80, 180); doc.setFontSize(22); bold()
    doc.text("Automotora RS", MR, 19, { align: "right" })
    black(); normal(); doc.setFontSize(8)
    doc.text("AUTOMOTORA RS SPA", MR, 25, { align: "right" })
    doc.text("RUT 76.858.081-2", MR, 30, { align: "right" })
    doc.text("mail: automotora.rs@gmail.com", MR, 36, { align: "right" })
    doc.text("FRANKLIN 605 - FONO +569 91390267", MR, 41, { align: "right" })

    // Title
    black(); bold(); doc.setFontSize(16)
    doc.text("ORDEN DE TRABAJO", 105, 50, { align: "center" })
    if (pageNum > 1) {
      normal(); doc.setFontSize(9)
      doc.text(`(continuacion pagina ${pageNum})`, 105, 56, { align: "center" })
    }

    // OT number + date (only page 1)
    if (pageNum === 1) {
      const otNum = (servicio as any).numero_ot
        ? String((servicio as any).numero_ot).padStart(4, "0")
        : servicio.id.substring(0, 8).toUpperCase()
      const fechaStr = (() => {
        const raw = servicio.fecha_ingreso?.substring(0, 10) || ""
        const [y, m, d] = raw.split("-")
        return (!y || !m || !d) ? raw : `${d}-${m}-${y}`
      })()
      const dX = MR - 55; const dY = 53
      doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)
      doc.rect(dX, dY, 22, 6); doc.rect(dX + 22, dY, 33, 6)
      bold(); doc.setFontSize(8); doc.text("N\xB0 OT", dX + 2, dY + 4)
      normal(); doc.text(`#${otNum}`, dX + 24, dY + 4)
      doc.rect(dX, dY + 7, 22, 6); doc.rect(dX + 22, dY + 7, 33, 6)
      bold(); doc.text("FECHA", dX + 2, dY + 11)
      normal(); doc.text(fechaStr, dX + 24, dY + 11)
    }

    return pageNum === 1 ? 62 : 60 // returns Y where content starts
  }

  // ─── PAGE 1 HEADER ────────────────────────────────────────────────
  let y = drawPageHeader(1)
  let pageNum = 1

  function checkPageBreak(neededH: number): void {
    const limit = PAGE_H - BOTTOM_MARGIN
    if (y + neededH > limit) {
      doc.addPage()
      pageNum++
      y = drawPageHeader(pageNum)
    }
  }

  // ─── CLIENT INFO ──────────────────────────────────────────────────
  const rh = 6
  const MID = ML + CW * 0.57
  doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)
  doc.rect(ML, y, CW, rh * 3)
  for (let i = 1; i < 3; i++) doc.line(ML, y + rh * i, MR, y + rh * i)
  doc.line(MID, y + rh, MID, y + rh * 2)

  black(); bold(); doc.setFontSize(8)
  doc.text("CLIENTE:", ML + 1, y + 4)
  doc.text("TELEFONO:", ML + 1, y + rh + 4)
  doc.text("ESTADO:", MID + 2, y + rh + 4)
  doc.text("OBSERV.:", ML + 1, y + rh * 2 + 4)
  normal()
  doc.text(up(servicio.cliente), ML + 22, y + 4)
  doc.text(up(servicio.telefono || ""), ML + 22, y + rh + 4)
  doc.text(up(servicio.estado || "En Cola"), MID + 20, y + rh + 4)
  if (servicio.observaciones) {
    const obs = doc.splitTextToSize(up(servicio.observaciones), CW - 22)
    doc.text(obs[0] || "", ML + 22, y + rh * 2 + 4)
  }
  y += rh * 3 + 2

  // ─── VEHICLE TABLE ────────────────────────────────────────────────
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
    doc.rect(vx, y, col.w, vehicleH)
    bold(); doc.setFontSize(7); doc.text(col.h, vx + 1, y + 4)
    normal(); doc.setFontSize(8)
    doc.text(up(String(col.v)).substring(0, Math.floor(col.w / 2.2)), vx + 1, y + 9)
    vx += col.w
  })
  y += vehicleH + 1

  // ─── WORK ITEMS TABLE ─────────────────────────────────────────────
  // Build rows
  type DisplayRow =
    | { type: "category"; label: string }
    | { type: "item"; desc: string }

  const cobros = servicio.cobros || []
  const piezas = servicio.piezas_pintura || []
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

  const displayRows: DisplayRow[] = []
  categoryOrder.forEach((cat) => {
    displayRows.push({ type: "category", label: cat })
    grouped[cat].forEach((desc) => displayRows.push({ type: "item", desc }))
  })

  const CAT_H = 7    // category header row height
  const ITEM_H = 5.5 // item row height
  const MIN_BLANK = 6 // minimum blank rows to leave at the end

  function getRowH(row: DisplayRow) {
    return row.type === "category" ? CAT_H : ITEM_H
  }

  // Table header
  checkPageBreak(8)
  doc.setFillColor(220, 230, 255)
  doc.rect(ML, y, CW, 7, "FD")
  doc.setDrawColor(0, 0, 0)
  black(); bold(); doc.setFontSize(8)
  doc.text("DESCRIPCION DEL TRABAJO A REALIZAR", ML + 2, y + 5)
  y += 7

  // Draw rows with page-break support
  const drawnSegments: { startY: number; endY: number; page: number }[] = []
  let segStart = y
  let segPage = pageNum

  function closeSeg() {
    drawnSegments.push({ startY: segStart, endY: y, page: segPage })
  }

  displayRows.forEach((row) => {
    const rHeight = getRowH(row)
    checkPageBreak(rHeight)

    if (pageNum !== segPage) {
      closeSeg()
      segStart = y
      segPage = pageNum
    }

    const ry = y

    // Background for category
    if (row.type === "category") {
      doc.setFillColor(240, 240, 240)
      doc.rect(ML, ry, CW, rHeight, "F")
    }

    // Separator line at bottom of row
    doc.setDrawColor(180, 180, 180)
    doc.line(ML, ry + rHeight, MR, ry + rHeight)

    // Text (drawn last so nothing covers it)
    black()
    if (row.type === "category") {
      bold(); doc.setFontSize(8)
      doc.text(`[ ${up(row.label)} ]`, ML + 2, ry + rHeight - 2)
    } else {
      normal(); doc.setFontSize(8)
      doc.text(up(row.desc).substring(0, 90), ML + 6, ry + rHeight - 1.5)
    }

    y += rHeight
  })

  // Blank rows at end
  for (let i = 0; i < MIN_BLANK; i++) {
    checkPageBreak(ITEM_H)
    if (pageNum !== segPage) { closeSeg(); segStart = y; segPage = pageNum }
    doc.setDrawColor(200, 200, 200)
    doc.line(ML, y + ITEM_H, MR, y + ITEM_H)
    y += ITEM_H
  }

  closeSeg()

  // Draw outer borders per segment
  drawnSegments.forEach((seg) => {
    const savedPage = doc.getCurrentPageInfo().pageNumber
    doc.setPage(seg.page)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.4)
    doc.rect(ML, seg.startY, CW, seg.endY - seg.startY)
    doc.setLineWidth(0.3)
    doc.setPage(savedPage)
  })

  y += 3

  // ─── CONDITION CHECKBOXES ─────────────────────────────────────────
  const allConditions = [
    "Parabrisas roto", "Antena", "Tapiz rasgado", "Espejo retrovisor",
    "Calefaccion", "Radio", "Encendedor", "Alfombras",
    "Rueda de repuesto", "Herramientas", "Extintor", "Gato",
  ]
  const checkboxes = servicio.observaciones_checkboxes || []
  const condCols = 3
  const condW = CW / condCols
  const condH = 5
  const condRows = Math.ceil(allConditions.length / condCols)

  checkPageBreak(8 + condRows * condH)
  black(); bold(); doc.setFontSize(7.5)
  doc.text("CONDICION DEL VEHICULO AL INGRESO:", ML, y + 4)
  y += 7

  allConditions.forEach((cond, i) => {
    const col = i % condCols
    const row = Math.floor(i / condCols)
    const cx = ML + col * condW
    const crY = y + row * condH
    const checked = checkboxes.includes(cond)

    doc.setLineWidth(0.2); doc.setDrawColor(80, 80, 80)
    doc.rect(cx + 1, crY + 0.5, 3.5, 3.5)
    if (checked) {
      bold(); doc.setTextColor(200, 50, 50); doc.setFontSize(8)
      doc.text("X", cx + 1.5, crY + 3.5)
      black()
    }
    normal(); doc.setFontSize(7)
    doc.setTextColor(checked ? 200 : 60, checked ? 50 : 60, checked ? 50 : 60)
    doc.text(cond, cx + 6, crY + 3.5)
    black()
  })
  y += condRows * condH + 4

  // ─── SIGNATURES ───────────────────────────────────────────────────
  checkPageBreak(20)
  const sigW = CW / 2 - 4
  doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)

  doc.rect(ML, y, sigW, 16)
  bold(); doc.setFontSize(8); doc.text("TECNICO RECIBE:", ML + 2, y + 5)
  normal(); doc.line(ML + 2, y + 13, ML + sigW - 2, y + 13)
  doc.setFontSize(7); doc.text("Firma y nombre", ML + sigW / 2, y + 15.5, { align: "center" })

  const sigRX = ML + sigW + 8
  doc.rect(sigRX, y, sigW, 16)
  bold(); doc.setFontSize(8); doc.text("CLIENTE AUTORIZA:", sigRX + 2, y + 5)
  normal(); doc.line(sigRX + 2, y + 13, sigRX + sigW - 2, y + 13)
  doc.setFontSize(7); doc.text("Firma y nombre", sigRX + sigW / 2, y + 15.5, { align: "center" })
  y += 18

  // ─── NOTES ────────────────────────────────────────────────────────
  checkPageBreak(12)
  doc.rect(ML, y, CW, 10)
  bold(); doc.setFontSize(7); doc.text("NOTA:", ML + 1, y + 3.5)
  normal()
  doc.text(
    "1.- AUTOMOTORA RS NO SE RESPONSABILIZA POR DANOS OCASIONADOS POR INCENDIOS U OTRAS CAUSAS DE FUERZA MAYOR.",
    ML + 12, y + 3.5,
  )
  doc.text(
    "2.- AUTORIZO PARA MANEJAR EL VEHICULO FUERA DE LA AUTOMOTORA PARA PRUEBAS MECANICAS.",
    ML + 12, y + 7.5,
  )

  const fechaFile = servicio.fecha_ingreso?.substring(0, 10) || "sin-fecha"
  doc.save(`orden-trabajo-${servicio.patente}-${fechaFile}.pdf`)
}
