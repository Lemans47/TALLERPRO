import jsPDF from "jspdf"
import type { Servicio } from "@/lib/database"
import { formatFechaDMA } from "@/lib/utils"

export async function generarOrdenTrabajo(servicio: Servicio) {
  const doc = new jsPDF({ unit: "mm", format: [210, 297], orientation: "portrait" })

  const ML = 10
  const MR = 200
  const CW = MR - ML
  const PAGE_H = 297
  const MARGIN_BOTTOM = 25

  const bold   = () => doc.setFont("helvetica", "bold")
  const normal = () => doc.setFont("helvetica", "normal")
  const black  = () => doc.setTextColor(0, 0, 0)
  const up     = (s: string) => (s || "").toUpperCase()

  function drawLogo(logoBase64: string) {
    const lx = ML, ly = 6, lw = CW, lh = 34

    doc.setFillColor(235, 235, 235)
    doc.roundedRect(lx, ly, lw, lh, 2, 2, "F")

    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", lx + 2, ly + 2, 30, 30)
    }

    const rx = lx + lw - 2
    doc.setTextColor(80, 80, 80)
    doc.setFont("helvetica", "bold"); doc.setFontSize(7)
    doc.text("automotora.rs@gmail.com", rx, ly + 10, { align: "right" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5)
    doc.text("FRANKLIN 605", rx, ly + 17, { align: "right" })
    doc.text("FONO +569 91390267", rx, ly + 23, { align: "right" })
    doc.setTextColor(20, 20, 20); doc.setFontSize(6)
    doc.text("RUT 76.858.081-2", rx, ly + 30, { align: "right" })

    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0); doc.setLineWidth(0.3)
  }

  // ── Load logo ───────────────────────────────────────────────────
  const logoBase64 = await new Promise<string>((resolve) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext("2d")!.drawImage(img, 0, 0)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => resolve("")
    img.src = "https://res.cloudinary.com/dzjtujwor/image/upload/v1775100136/LOGO_AUTOMOTORA_RS_narpoz.png"
  })

  // ── Page counter and Y tracker ──────────────────────────────────
  let y = 0
  let currentPage = 1

  function newPage() {
    doc.addPage()
    currentPage++
    y = drawHeader(currentPage, logoBase64)
  }

  function need(h: number) {
    if (y + h > PAGE_H - MARGIN_BOTTOM) newPage()
  }

  // ── Header ──────────────────────────────────────────────────────
  function drawHeader(pg: number, logo: string): number {
    drawLogo(logo)

    black(); bold(); doc.setFontSize(16)
    if (pg === 1) {
      doc.text("ORDEN DE TRABAJO", 105, 50, { align: "center" })
    } else {
      doc.text("ORDEN DE TRABAJO", 105, 50, { align: "center" })
      normal(); doc.setFontSize(9)
      doc.text(`(pagina ${pg})`, 105, 57, { align: "center" })
    }

    // OT + date (page 1 only)
    if (pg === 1) {
      const otNum = (servicio as any).numero_ot
        ? String((servicio as any).numero_ot).padStart(4, "0")
        : servicio.id.substring(0, 8).toUpperCase()
      const fechaStr = formatFechaDMA(servicio.fecha_ingreso)

      const dX = MR - 55; const dY = 53
      doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)
      doc.rect(dX, dY, 22, 6); doc.rect(dX + 22, dY, 33, 6)
      bold(); doc.setFontSize(8); doc.text("N\xB0 OT", dX + 2, dY + 4)
      normal(); doc.text(`#${otNum}`, dX + 24, dY + 4)
      doc.rect(dX, dY + 7, 22, 6); doc.rect(dX + 22, dY + 7, 33, 6)
      bold(); doc.text("FECHA", dX + 2, dY + 11)
      normal(); doc.text(fechaStr, dX + 24, dY + 11)
    }

    return pg === 1 ? 66 : 62
  }

  // ── Start page 1 ────────────────────────────────────────────────
  y = drawHeader(1, logoBase64)

  // ── Client info ─────────────────────────────────────────────────
  const RH = 6
  const MID = ML + CW * 0.57
  doc.setLineWidth(0.3); doc.setDrawColor(0, 0, 0)
  doc.rect(ML, y, CW, RH * 3)
  doc.line(ML, y + RH, MR, y + RH)
  doc.line(ML, y + RH * 2, MR, y + RH * 2)
  doc.line(MID, y + RH, MID, y + RH * 2)

  black(); bold(); doc.setFontSize(8)
  doc.text("CLIENTE:", ML + 1, y + 4)
  doc.text("TELEFONO:", ML + 1, y + RH + 4)
  doc.text("ESTADO:", MID + 2, y + RH + 4)
  doc.text("OBSERV.:", ML + 1, y + RH * 2 + 4)
  normal()
  doc.text(up(servicio.cliente), ML + 22, y + 4)
  doc.text(up(servicio.telefono || ""), ML + 22, y + RH + 4)
  doc.text(up(servicio.estado || ""), MID + 20, y + RH + 4)
  if (servicio.observaciones) {
    const obs = doc.splitTextToSize(up(servicio.observaciones), CW - 22)
    doc.text(obs[0] || "", ML + 22, y + RH * 2 + 4)
  }
  y += RH * 3 + 2

  // ── Vehicle table ────────────────────────────────────────────────
  const vcols = [
    { h: "PATENTE", w: 28, v: servicio.patente || "" },
    { h: "MARCA", w: 28, v: servicio.marca || "" },
    { h: "MODELO", w: 32, v: servicio.modelo || "" },
    { h: "COLOR", w: 22, v: servicio.color || "" },
    { h: "A\xD1O", w: 18, v: servicio.año?.toString() || "" },
    { h: "KILOMETRAJE", w: 30, v: servicio.kilometraje?.toString() || "" },
    { h: "N\xB0 MOTOR", w: CW - 158, v: "" },
  ]
  let vx = ML
  vcols.forEach((col) => {
    doc.rect(vx, y, col.w, 12)
    bold(); doc.setFontSize(7); doc.text(col.h, vx + 1, y + 4)
    normal(); doc.setFontSize(8)
    doc.text(up(String(col.v)).substring(0, Math.floor(col.w / 2.2)), vx + 1, y + 9)
    vx += col.w
  })
  y += 13

  // ── Build work rows ──────────────────────────────────────────────
  type Row = { type: "category"; label: string } | { type: "item"; desc: string }
  const rows: Row[] = []
  const grouped: Record<string, string[]> = {}
  const order: string[] = []

  const parseArr = (v: any): any[] => {
    let val = v
    while (typeof val === "string" && val) { try { val = JSON.parse(val) } catch { return [] } }
    if (Array.isArray(val)) return val
    if (val && typeof val === "object") return Object.entries(val).flatMap(([cat, items]: [string, any]) => Array.isArray(items) ? items.map((i: any) => ({ ...i, categoria: cat })) : [])
    return []
  }
  const cobrosOT = parseArr(servicio.cobros)
  const piezasOT = parseArr(servicio.piezas_pintura)

  const CAT_LABELS_OT: Record<string, string> = {
    desmontar: "Desmontar y Montar",
    desabolladura: "Desabolladura",
    reparar: "Reparar",
    pintura: "Pintura",
    mecanica: "Mecánica",
    repuestos: "Repuestos",
    otros: "Otros",
  }
  const CAT_ORDER_OT = ["Desmontar y Montar", "Desabolladura", "Reparar", "Pintura", "Mecánica", "Repuestos", "Otros"]
  if (piezasOT.length > 0) {
    if (!grouped["Pintura"]) { grouped["Pintura"] = [] }
    piezasOT.forEach((p: any) => grouped["Pintura"].push(p.nombre || ""))
  }
  cobrosOT.forEach((c: any) => {
    const cat = CAT_LABELS_OT[c.categoria?.toLowerCase().trim()] || c.categoria || "Sin categoria"
    if (!grouped[cat]) { grouped[cat] = [] }
    grouped[cat].push(c.descripcion || "")
  })
  const orderedCatsOT = [...CAT_ORDER_OT.filter((c) => grouped[c]), ...Object.keys(grouped).filter((c) => !CAT_ORDER_OT.includes(c))]
  orderedCatsOT.forEach((cat) => {
    rows.push({ type: "category", label: cat })
    grouped[cat].forEach((desc) => rows.push({ type: "item", desc }))
  })

  const CAT_H = 8   // tall enough to never touch adjacent rows
  const ITEM_H = 7  // same — generous spacing

  // ── Table header ─────────────────────────────────────────────────
  need(CAT_H + 8)
  doc.setFillColor(220, 230, 255); doc.setDrawColor(0, 0, 0)
  doc.rect(ML, y, CW, 8, "FD")
  black(); bold(); doc.setFontSize(8)
  doc.text("DESCRIPCION DEL TRABAJO A REALIZAR", ML + 2, y + 5.5)
  y += 8

  // Track table boundaries per page for outer border
  const tableSegs: { top: number; pg: number }[] = [{ top: y, pg: currentPage }]
  let lastSeg = tableSegs[0]

  function closeAndOpenSeg() {
    // close current segment border
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5)
    doc.rect(ML, lastSeg.top, CW, y - lastSeg.top)
    doc.setLineWidth(0.3)
    // new page
    newPage()
    // new table header
    need(8)
    doc.setFillColor(220, 230, 255); doc.setDrawColor(0, 0, 0)
    doc.rect(ML, y, CW, 8, "FD")
    black(); bold(); doc.setFontSize(8)
    doc.text("DESCRIPCION DEL TRABAJO A REALIZAR (cont.)", ML + 2, y + 5.5)
    y += 8
    lastSeg = { top: y, pg: currentPage }
    tableSegs.push(lastSeg)
  }

  // ── Draw each row sequentially ───────────────────────────────────
  rows.forEach((row) => {
    const rh = row.type === "category" ? CAT_H : ITEM_H
    if (y + rh > PAGE_H - MARGIN_BOTTOM) closeAndOpenSeg()

    const ry = y

    if (row.type === "category") {
      // Thick dark separator — visually separates from previous row, no fill
      doc.setDrawColor(30, 30, 30); doc.setLineWidth(0.8)
      doc.line(ML, ry, MR, ry)
      doc.setLineWidth(0.3)
      // Bottom separator
      doc.setDrawColor(30, 30, 30)
      doc.line(ML, ry + rh, MR, ry + rh)
      // Text
      black(); bold(); doc.setFontSize(9)
      doc.text(up(row.label), ML + 3, ry + rh - 3)
    } else {
      // Light bottom separator
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2)
      doc.line(ML, ry + rh, MR, ry + rh)
      doc.setLineWidth(0.3)
      // Text
      black(); normal(); doc.setFontSize(8)
      doc.text(up(row.desc).substring(0, 90), ML + 6, ry + rh - 3)
    }

    y += rh
  })

  // Blank rows
  const blanks = Math.min(6, Math.floor((PAGE_H - MARGIN_BOTTOM - y) / ITEM_H))
  for (let i = 0; i < blanks; i++) {
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2)
    doc.line(ML, y + ITEM_H, MR, y + ITEM_H)
    doc.setLineWidth(0.3)
    y += ITEM_H
  }

  // Close last segment border
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5)
  doc.rect(ML, lastSeg.top, CW, y - lastSeg.top)
  doc.setLineWidth(0.3)
  y += 5

  // ── Signatures ───────────────────────────────────────────────────
  need(36)
  const sigW = CW / 2 - 4
  doc.setDrawColor(0, 0, 0)
  doc.rect(ML, y, sigW, 18)
  black(); bold(); doc.setFontSize(8); doc.text("TECNICO RECIBE:", ML + 2, y + 6)
  normal(); doc.line(ML + 2, y + 15, ML + sigW - 2, y + 15)
  doc.setFontSize(7); doc.text("Firma y nombre", ML + sigW / 2, y + 17.5, { align: "center" })

  const sigRX = ML + sigW + 8
  doc.rect(sigRX, y, sigW, 18)
  bold(); doc.setFontSize(8); doc.text("CLIENTE AUTORIZA:", sigRX + 2, y + 6)
  normal(); doc.line(sigRX + 2, y + 15, sigRX + sigW - 2, y + 15)
  doc.setFontSize(7); doc.text("Firma y nombre", sigRX + sigW / 2, y + 17.5, { align: "center" })
  y += 20

  // ── Notes ────────────────────────────────────────────────────────
  need(12)
  doc.rect(ML, y, CW, 11)
  bold(); doc.setFontSize(7); doc.text("NOTA:", ML + 1, y + 4)
  normal()
  doc.text(
    "1.- AUTOMOTORA RS NO SE RESPONSABILIZA POR DANOS OCASIONADOS POR INCENDIOS U OTRAS CAUSAS DE FUERZA MAYOR.",
    ML + 12, y + 4,
  )
  doc.text(
    "2.- AUTORIZO PARA MANEJAR EL VEHICULO FUERA DE LA AUTOMOTORA PARA PRUEBAS MECANICAS.",
    ML + 12, y + 8,
  )

  const fechaFile = servicio.fecha_ingreso?.substring(0, 10) || "sin-fecha"
  doc.save(`orden-trabajo-${servicio.patente}-${fechaFile}.pdf`)
}
