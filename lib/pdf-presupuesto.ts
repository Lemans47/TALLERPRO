import jsPDF from "jspdf"
import type { Servicio } from "@/lib/database"

const ML = 10
const MR = 200
const CW = MR - ML
const MONTO_W = 48
const DESC_W = CW - MONTO_W
const PAGE_H = 297

export async function generarPDFPresupuesto(servicio: Servicio, soloTotales = false) {
  const doc = new jsPDF({ unit: "mm", format: [210, 297], orientation: "portrait" })

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

  // ─── DRAW LOGO (jsPDF primitives, no image needed) ────────────────
  function drawLogo() {
    const lx = ML, ly = 6, lw = CW, lh = 34
    const cx = lx + 15, cy = ly + lh / 2

    // Light gray background
    doc.setFillColor(235, 235, 235)
    doc.roundedRect(lx, ly, lw, lh, 2, 2, "F")

    // Red left border strip only (no right strip)
    doc.setFillColor(200, 0, 0)
    doc.roundedRect(lx, ly, 2.5, lh, 1, 1, "F")

    // ── Circular emblem ──
    const ro = 11.5, rm = 9.5, ri = 8.0

    // Outer ring — now RED
    doc.setFillColor(200, 0, 0)
    doc.circle(cx, cy, ro, "F")
    // Black outer ring stroke
    doc.setDrawColor(20, 20, 20); doc.setLineWidth(1.8)
    doc.circle(cx, cy, ro, "S")
    // Mid ring — darker red
    doc.setFillColor(160, 0, 0)
    doc.circle(cx, cy, rm, "F")
    // Center fill — black
    doc.setFillColor(20, 20, 20)
    doc.circle(cx, cy, ri, "F")
    // Highlight — dark gray
    doc.setFillColor(40, 40, 40)
    doc.circle(cx, cy - 1.5, ri * 0.65, "F")
    // Re-blend — black
    doc.setFillColor(20, 20, 20)
    doc.circle(cx, cy, ri * 0.5, "F")

    // RS text in emblem
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("RS", cx, cy + 3.8, { align: "center" })

    // ── Center: AUTOMOTORA RS branding ──
    const contactW = 60
    const emblemRight = cx + ro + 4
    const contactLeft = lx + lw - contactW
    const tcx = (emblemRight + contactLeft) / 2

    doc.setTextColor(20, 20, 20)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.text("A U T O M O T O R A", tcx, ly + 8, { align: "center" })

    doc.setTextColor(20, 20, 20)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.text("RS", tcx, ly + 21, { align: "center" })

    doc.setTextColor(200, 0, 0)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6)
    doc.text("DESABOLLADURA & PINTURA", tcx, ly + 27, { align: "center" })

    doc.setTextColor(140, 140, 140)
    doc.setFontSize(5)
    doc.text("CALIDAD  \u00B7  PRECISION  \u00B7  CONFIANZA", tcx, ly + 32, { align: "center" })

    // ── Right: contact info inside banner ──
    const rx = lx + lw - 2
    doc.setTextColor(80, 80, 80)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.text("automotora.rs@gmail.com", rx, ly + 10, { align: "right" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.text("FRANKLIN 605", rx, ly + 17, { align: "right" })
    doc.text("FONO +569 91390267", rx, ly + 23, { align: "right" })
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(6)
    doc.text("RUT 76.858.081-2", rx, ly + 30, { align: "right" })

    // Reset colors
    doc.setDrawColor(0, 0, 0)
    doc.setTextColor(0, 0, 0)
    doc.setLineWidth(0.3)
  }

  // ─── DRAW PAGE HEADER ─────────────────────────────────────────────
  function drawPageHeader(pageNum: number): number {
    drawLogo()

    // Red separator line below logo + thin gray line below with small gap
    doc.setDrawColor(200, 0, 0); doc.setLineWidth(1.2)
    doc.line(ML, 42, MR, 42)
    doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.3)
    doc.line(ML, 44.5, MR, 44.5)
    doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)

    black(); bold(); doc.setFontSize(16)
    doc.text("PRESUPUESTO", 105, 52, { align: "center" })
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

  const parseArr = (v: any) => Array.isArray(v) ? v : (typeof v === "string" && v ? JSON.parse(v) : [])
  const cobros = parseArr(servicio.cobros)
  const piezas = parseArr(servicio.piezas_pintura)
  const grouped: Record<string, { descripcion: string; monto: number }[]> = {}
  const categoryOrder: string[] = []

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
  const normalizecat = (cat: string) => CAT_LABELS[cat.toLowerCase().trim()] || cat

  if (piezas.length > 0) {
    const pinturaKey = CAT_LABELS["pintura"]
    if (!grouped[pinturaKey]) { grouped[pinturaKey] = [] }
    piezas.forEach((p) => grouped[pinturaKey].push({ descripcion: p.nombre || "", monto: Number(p.precio) || 0 }))
  }
  cobros.forEach((c) => {
    const cat = normalizecat(c.categoria || "Sin categoria")
    if (!grouped[cat]) { grouped[cat] = [] }
    grouped[cat].push({ descripcion: c.descripcion || "", monto: Number(c.monto) || 0 })
  })

  const displayRows: DisplayRow[] = []
  const orderedCats = [...CAT_ORDER.filter((c) => grouped[c]), ...Object.keys(grouped).filter((c) => !CAT_ORDER.includes(c))]
  orderedCats.forEach((cat) => {
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

  // ─── TABLE HEADER ─────────────────────────────────────────────────
  checkPageBreak(8)
  doc.setFillColor(20, 20, 20)
  doc.rect(ML, y, DESC_W, 7, "F")
  doc.rect(ML + DESC_W, y, MONTO_W, 7, "F")
  doc.setTextColor(255, 255, 255); bold(); doc.setFontSize(8)
  doc.text("DESCRIPCION", ML + 2, y + 5)
  doc.text("VALOR", ML + DESC_W + MONTO_W / 2, y + 5, { align: "center" })
  black(); y += 7

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
      doc.setFillColor(20, 20, 20)
      doc.rect(ML, cy, DESC_W, 7, "F")
      doc.rect(ML + DESC_W, cy, MONTO_W, 7, "F")
      doc.setTextColor(255, 255, 255); bold(); doc.setFontSize(8)
      doc.text("DESCRIPCION (cont.)", ML + 2, cy + 5)
      doc.text("VALOR", ML + DESC_W + MONTO_W / 2, cy + 5, { align: "center" })
      black()
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
  // Fill with blank rows up to bottomAnchor (totals section start)
  const trh1 = 16  // tall signature row
  const trh = 6    // totals rows
  const FIRMA_H = trh1 + trh * 2 + 2 + 10
  const bottomAnchor = PAGE_H - 15 - FIRMA_H
  const spaceLeft = bottomAnchor - 2 - cy  // -2 for the y += 2 after the loop
  if (spaceLeft > 0) {
    const blanksNeeded = Math.floor(spaceLeft / ITEM_H)
    for (let i = 0; i < blanksNeeded; i++) placeRow("blank", ITEM_H)
  }

  y = cy; pageNum = cp

  // ─── PASS 1: fills ────────────────────────────────────────────────
  const savedPg = doc.getCurrentPageInfo().pageNumber
  placed.forEach((r) => {
    doc.setPage(r.pg)
    if (r.type === "category") {
      doc.setFillColor(200, 0, 0)
      doc.rect(ML, r.ry, CW, r.rh, "F")
    } else if (r.type === "subtotal") {
      doc.setFillColor(232, 232, 232)
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
      doc.setTextColor(255, 255, 255); bold(); doc.setFontSize(8)
      doc.text(up(r.label!) + ":", ML + 1.5, r.ry + r.rh - 2)
      black()
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

  // ─── TOTALS + SIGNATURES — anchored to page bottom ───────────────
  if (y > bottomAnchor) {
    doc.addPage(); pageNum++; drawPageHeader(pageNum)
    y = bottomAnchor
  }
  const subtotalVal = Number(servicio.monto_total_sin_iva) || 0
  const totalVal = Number(servicio.monto_total) || 0
  const ivaVal = totalVal - subtotalVal
  const labelX = ML + DESC_W
  const labelW = 28
  const valW = MONTO_W - labelW

  // Row 1 — FIRMA CLIENTE | RECIBI CONFORME / SUB-TOTAL (tall, split)
  const halfDesc = DESC_W / 2
  doc.setDrawColor(0, 0, 0)
  doc.rect(ML, y, halfDesc, trh1)
  doc.rect(ML + halfDesc, y, halfDesc, trh1)
  doc.rect(labelX, y, labelW, trh1)
  doc.rect(labelX + labelW, y, valW, trh1)
  bold(); doc.setFontSize(8)
  doc.text("FIRMA CLIENTE", ML + 2, y + 4)
  doc.text("RECIBI CONFORME", ML + halfDesc + 2, y + 4)
  doc.text("SUB-TOTAL", labelX + 1, y + 4)
  normal(); doc.text(fmt(subtotalVal), MR - 1, y + 4, { align: "right" })
  // Signature lines
  doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.3)
  doc.line(ML + 4, y + trh1 - 3, ML + halfDesc - 4, y + trh1 - 3)
  doc.line(ML + halfDesc + 4, y + trh1 - 3, ML + DESC_W - 4, y + trh1 - 3)
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3)
  y += trh1

  // Row 2 — AUTORIZO / IVA
  doc.rect(ML, y, DESC_W, trh)
  doc.rect(labelX, y, labelW, trh)
  doc.rect(labelX + labelW, y, valW, trh)
  bold(); doc.setFontSize(7)
  doc.text("AUTORIZO LOS TRABAJOS DESCRITOS Y ACEPTO NOTAS", ML + 2, y + 4)
  doc.text("19% IVA", labelX + 1, y + 4)
  normal(); doc.text(fmt(ivaVal), MR - 1, y + 4, { align: "right" })
  y += trh

  // Row 3 — TOTAL
  doc.setFillColor(200, 0, 0)
  doc.rect(labelX, y, labelW, trh, "F")
  doc.rect(labelX + labelW, y, valW, trh, "F")
  doc.setDrawColor(200, 0, 0); doc.rect(labelX, y, labelW + valW, trh)
  doc.setTextColor(255, 255, 255); bold(); doc.setFontSize(9)
  doc.text("TOTAL", labelX + 1, y + 4)
  doc.text(fmt(totalVal), MR - 1, y + 4, { align: "right" })
  black()
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

  const nombreArchivo = [servicio.marca, servicio.modelo, servicio.patente, servicio.cliente]
    .map(s => (s || "").toUpperCase().replace(/\s+/g, "_"))
    .filter(Boolean)
    .join("-")
  doc.save(`${nombreArchivo}.pdf`)
}
