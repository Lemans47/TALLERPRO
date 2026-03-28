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
const MONTO_W = 48
const DESC_W = CW - MONTO_W
const PAGE_H = 297

export async function generarPDFPresupuesto(servicio: Servicio, soloTotales = false) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })

  const logoBase64 = await loadImageAsBase64("/car-logo.png")

  const bold = () => doc.setFont("helvetica", "bold")
  const normal = () => doc.setFont("helvetica", "normal")
  const black = () => doc.setTextColor(0, 0, 0)
  const up = (s: string) => (s || "").toUpperCase()
  const fmt = (n: number) => (n > 0 ? `$${n.toLocaleString("es-CL")}` : "-")

  const fechaStr = (() => {
    const raw = servicio.fecha_ingreso?.substring(0, 10) || ""
    const [yr, m, d] = raw.split("-")
    return (!yr || !m || !d) ? raw : `${d}-${m}-${yr}`
  })()

  // ─── DRAW PAGE HEADER ─────────────────────────────────────────────
  function drawPageHeader(pageNum: number): number {
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

    black(); bold(); doc.setFontSize(16)
    doc.text("PRESUPUESTO", 105, 50, { align: "center" })
    if (pageNum > 1) {
      normal(); doc.setFontSize(9)
      doc.text(`(continuacion pagina ${pageNum})`, 105, 56, { align: "center" })
    }

    // Date box — only page 1
    if (pageNum === 1) {
      const dX = MR - 55; const dY = 53
      doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)
      doc.rect(dX, dY, 22, 6); doc.rect(dX + 22, dY, 33, 6)
      bold(); doc.setFontSize(8); doc.text("FECHA", dX + 2, dY + 4)
      normal(); doc.text(fechaStr, dX + 24, dY + 4)
    }

    return pageNum === 1 ? 62 : 60
  }

  // ─── PAGE 1 ───────────────────────────────────────────────────────
  let y = drawPageHeader(1)
  let pageNum = 1

  function checkPageBreak(needed: number): void {
    if (y + needed > PAGE_H - 15) {
      doc.addPage()
      pageNum++
      y = drawPageHeader(pageNum)
    }
  }

  // ─── CLIENT INFO (page 1 only) ────────────────────────────────────
  const rh = 6
  const MID = ML + CW * 0.57
  doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)
  doc.rect(ML, y, CW, rh * 4)
  for (let i = 1; i < 4; i++) doc.line(ML, y + rh * i, MR, y + rh * i)
  doc.line(MID, y + rh, MID, y + rh * 3)

  black(); bold(); doc.setFontSize(8)
  doc.text("NOMBRE:", ML + 1, y + 4)
  doc.text("Atencion:", ML + 1, y + rh + 4)
  doc.text("R.U.T.", MID + 2, y + rh + 4)
  doc.text("DOMICILIO:", ML + 1, y + rh * 2 + 4)
  doc.text("COMUNA", MID + 2, y + rh * 2 + 4)
  doc.text("OBSERV.", ML + 1, y + rh * 3 + 4)
  normal()
  doc.text(up(servicio.cliente), ML + 22, y + 4)
  doc.text(up(servicio.telefono || ""), ML + 22, y + rh + 4)
  if (servicio.observaciones) {
    const obs = doc.splitTextToSize(up(servicio.observaciones), CW - 22)
    doc.text(obs[0] || "", ML + 22, y + rh * 3 + 4)
  }
  y += rh * 4 + 2

  // ─── VEHICLE TABLE ────────────────────────────────────────────────
  const vehicleH = 12
  const vcols = [
    { h: "MARCA", w: 28, v: servicio.marca || "" },
    { h: "MODELO", w: 30, v: servicio.modelo || "" },
    { h: "COLOR", w: 22, v: servicio.color || "" },
    { h: "PATENTE", w: 25, v: servicio.patente || "" },
    { h: "KILOMETRAJE", w: 28, v: servicio.kilometraje?.toString() || "" },
    { h: "A\xD1O", w: 17, v: servicio.año?.toString() || "" },
    { h: "NUMERO MOTOR", w: CW - 28 - 30 - 22 - 25 - 28 - 17, v: "" },
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

  // ─── BUILD DISPLAY ROWS ───────────────────────────────────────────
  type DisplayRow =
    | { type: "category"; label: string }
    | { type: "item"; desc: string; monto: number }
    | { type: "subtotal"; label: string; monto: number }

  const cobros = servicio.cobros || []
  const piezas = servicio.piezas_pintura || []
  const grouped: Record<string, { descripcion: string; monto: number }[]> = {}
  const categoryOrder: string[] = []

  cobros.forEach((c) => {
    const cat = c.categoria || "Sin categoria"
    if (!grouped[cat]) { grouped[cat] = []; categoryOrder.push(cat) }
    grouped[cat].push({ descripcion: c.descripcion || "", monto: Number(c.monto) || 0 })
  })
  if (piezas.length > 0) {
    if (!grouped["Pintura"]) { grouped["Pintura"] = []; categoryOrder.push("Pintura") }
    piezas.forEach((p) => grouped["Pintura"].push({ descripcion: p.nombre || "", monto: Number(p.precio) || 0 }))
  }

  const displayRows: DisplayRow[] = []
  categoryOrder.forEach((cat) => {
    const total = grouped[cat].reduce((acc, item) => acc + item.monto, 0)
    if (soloTotales) {
      // Category + items, no prices
      displayRows.push({ type: "category", label: cat })
      grouped[cat].forEach((item) => displayRows.push({ type: "item", desc: item.descripcion, monto: 0 }))
    } else {
      displayRows.push({ type: "category", label: cat })
      grouped[cat].forEach((item) => displayRows.push({ type: "item", desc: item.descripcion, monto: item.monto }))
      // Subtotal row after items (only if category has more than 1 item or has a total)
      if (total > 0) {
        displayRows.push({ type: "subtotal", label: cat, monto: total })
      }
    }
  })

  const CAT_H = 7
  const ITEM_H = 5.5
  const MIN_BLANK = 4

  // ─── TABLE HEADER ─────────────────────────────────────────────────
  checkPageBreak(8)
  doc.setFillColor(220, 230, 255)
  doc.rect(ML, y, DESC_W, 7, "FD")
  doc.rect(ML + DESC_W, y, MONTO_W, 7, "FD")
  doc.setDrawColor(0, 0, 0)
  black(); bold(); doc.setFontSize(8)
  doc.text("DESCRIPCION", ML + 2, y + 5)
  doc.text("VALOR", ML + DESC_W + MONTO_W / 2, y + 5, { align: "center" })
  y += 7

  // ─── PRE-CALCULATE all row positions ──────────────────────────────
  const SUBTOTAL_H = 6
  type PlacedRow = {
    type: "category" | "item" | "subtotal" | "blank"
    label?: string
    desc?: string
    monto?: number
    ry: number
    rh: number
    pg: number
  }
  const placed: PlacedRow[] = []
  let cy = y; let cp = pageNum

  function placeRow(type: PlacedRow["type"], rh: number, label?: string, desc?: string, monto?: number) {
    if (cy + rh > PAGE_H - 15) {
      doc.addPage(); cp++; cy = drawPageHeader(cp)
      doc.setFillColor(220, 230, 255)
      doc.rect(ML, cy, DESC_W, 7, "FD")
      doc.rect(ML + DESC_W, cy, MONTO_W, 7, "FD")
      doc.setDrawColor(0, 0, 0)
      black(); bold(); doc.setFontSize(8)
      doc.text("DESCRIPCION (cont.)", ML + 2, cy + 5)
      doc.text("VALOR", ML + DESC_W + MONTO_W / 2, cy + 5, { align: "center" })
      cy += 7
    }
    placed.push({ type, label, desc, monto, ry: cy, rh, pg: cp })
    cy += rh
  }

  displayRows.forEach((row) => {
    if (row.type === "category") {
      placeRow("category", CAT_H, row.label)
    } else if (row.type === "subtotal") {
      placeRow("subtotal", SUBTOTAL_H, row.label, undefined, row.monto)
    } else {
      placeRow("item", ITEM_H, undefined, row.desc, row.monto)
    }
  })
  for (let i = 0; i < MIN_BLANK; i++) placeRow("blank", ITEM_H)

  y = cy; pageNum = cp

  // ─── PASS 1: fills ────────────────────────────────────────────────
  const savedPg = doc.getCurrentPageInfo().pageNumber
  placed.forEach((r) => {
    doc.setPage(r.pg)
    if (r.type === "category") {
      doc.setFillColor(240, 240, 240)
      doc.rect(ML, r.ry, CW, r.rh, "F")
    } else if (r.type === "subtotal") {
      doc.setFillColor(230, 236, 255)
      doc.rect(ML, r.ry, CW, r.rh, "F")
    }
  })

  // ─── PASS 2: lines ────────────────────────────────────────────────
  placed.forEach((r) => {
    doc.setPage(r.pg)
    const isCat = r.type === "category"
    const isSubtotal = r.type === "subtotal"
    const lw = isCat || isSubtotal ? 0.4 : 0.2
    const col = isCat || isSubtotal ? 80 : 200
    doc.setDrawColor(col, col, col)
    doc.setLineWidth(lw)
    doc.line(ML, r.ry, MR, r.ry)
    doc.line(ML, r.ry + r.rh, MR, r.ry + r.rh)
  })

  // ─── PASS 3: text ─────────────────────────────────────────────────
  placed.forEach((r) => {
    if (r.type === "blank") return
    doc.setPage(r.pg)
    black()
    if (r.type === "category") {
      bold(); doc.setFontSize(8)
      doc.text(up(r.label!) + ":", ML + 1.5, r.ry + r.rh - 2)
    } else if (r.type === "subtotal") {
      bold(); doc.setFontSize(8)
      doc.text(fmt(r.monto!), MR - 1, r.ry + r.rh - 1.5, { align: "right" })
    } else {
      normal(); doc.setFontSize(8)
      doc.text(up(r.desc!).substring(0, 72), ML + 5, r.ry + r.rh - 1.5)
      // In detail mode prices are shown only on subtotal rows, not individual items
      if ((r.monto || 0) > 0 && soloTotales) {
        doc.text(fmt(r.monto!), MR - 1, r.ry + r.rh - 1.5, { align: "right" })
      }
    }
  })

  // ─── Outer border + vertical divider per page ─────────────────────
  const pages = [...new Set(placed.map((r) => r.pg))]
  pages.forEach((pg) => {
    doc.setPage(pg)
    const rows = placed.filter((r) => r.pg === pg)
    const top = rows[0].ry
    const bottom = rows[rows.length - 1].ry + rows[rows.length - 1].rh
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4)
    doc.rect(ML, top, CW, bottom - top)
    doc.line(ML + DESC_W, top, ML + DESC_W, bottom)
    doc.setLineWidth(0.3)
  })

  doc.setPage(savedPg)
  y += 2

  // ─── TOTALS + SIGNATURES ──────────────────────────────────────────
  const trh = 6
  const TOTALS_H = 6 * 3 + 12 + 2 + 10 + 4
  checkPageBreak(TOTALS_H)
  const subtotalVal = Number(servicio.monto_total_sin_iva) || 0
  const totalVal = Number(servicio.monto_total) || 0
  const ivaVal = totalVal - subtotalVal
  const labelX = ML + DESC_W
  const labelW = 28
  const valW = MONTO_W - labelW

  // Row 1 — FIRMA CLIENTE / SUB-TOTAL
  doc.setDrawColor(0, 0, 0)
  doc.rect(ML, y, DESC_W, trh)
  doc.rect(labelX, y, labelW, trh)
  doc.rect(labelX + labelW, y, valW, trh)
  bold(); doc.setFontSize(8)
  doc.text("FIRMA CLIENTE", ML + 20, y + 4)
  doc.text("RECIBI CONFORME", ML + DESC_W - 50, y + 4)
  doc.text("SUB-TOTAL", labelX + 1, y + 4)
  normal(); doc.text(fmt(subtotalVal), labelX + labelW + 1, y + 4)
  y += trh

  // Row 2 — AUTORIZO / IVA
  doc.rect(ML, y, DESC_W, trh)
  doc.rect(labelX, y, labelW, trh)
  doc.rect(labelX + labelW, y, valW, trh)
  bold(); doc.setFontSize(7)
  doc.text("AUTORIZO LOS TRABAJOS DESCRITOS Y ACEPTO NOTAS", ML + 2, y + 4)
  doc.text("19% IVA", labelX + 1, y + 4)
  normal(); doc.text(fmt(ivaVal), labelX + labelW + 1, y + 4)
  y += trh

  // Row 3 — TOTAL
  doc.setFillColor(220, 230, 255)
  doc.rect(labelX, y, labelW, trh, "FD")
  doc.rect(labelX + labelW, y, valW, trh, "FD")
  doc.setFillColor(255, 255, 255)
  bold(); doc.setFontSize(9)
  doc.text("TOTAL", labelX + 1, y + 4)
  doc.text(fmt(totalVal), labelX + labelW + 1, y + 4)
  y += trh + 2

  // ─── NOTES ────────────────────────────────────────────────────────
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

  doc.save(`presupuesto-${servicio.patente}-${fechaStr}.pdf`)
}
