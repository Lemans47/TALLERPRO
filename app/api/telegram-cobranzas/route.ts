import { NextResponse } from "next/server"
import { getServiciosPorCobrar } from "@/lib/database"

// Bot de Telegram independiente para consultar cuentas por cobrar.
// Usa su propio token (TELEGRAM_COBRANZAS_BOT_TOKEN) y, opcionalmente, su propia
// lista de chats autorizados (TELEGRAM_COBRANZAS_ALLOWED_CHAT_IDS). Si esta última
// no está configurada, reutiliza la del bot de gastos (TELEGRAM_ALLOWED_CHAT_IDS).
const BOT_TOKEN = process.env.TELEGRAM_COBRANZAS_BOT_TOKEN || ""
const ALLOWED_IDS = (
  process.env.TELEGRAM_COBRANZAS_ALLOWED_CHAT_IDS ||
  process.env.TELEGRAM_ALLOWED_CHAT_IDS ||
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
}

function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL")
}

function diasDesde(fecha?: string | null): number | null {
  if (!fecha) return null
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return null
  const ms = Date.now() - d.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

async function buildCobranzasMessage(): Promise<string> {
  const servicios = await getServiciosPorCobrar()
  if (!servicios.length) {
    return "✅ <b>No hay saldos pendientes.</b>\nTodos los servicios están al día. 🎉"
  }

  const total = servicios.reduce((acc, s) => acc + (Number(s.saldo_pendiente) || 0), 0)
  const header = `💰 <b>Cuentas por cobrar</b>\nTotal pendiente: <b>${fmtCLP(total)}</b>\n${servicios.length} servicio(s) con deuda\n`

  // Telegram limita a ~4096 caracteres: mostramos las más antiguas primero y
  // cortamos si la lista es muy larga.
  const MAX = 30
  const lineas = servicios.slice(0, MAX).map((s) => {
    const dias = diasDesde(s.fecha_entregado ?? s.fecha_ingreso)
    const antig = dias !== null ? ` · ${dias}d` : ""
    const ot = s.numero_ot ? `OT ${s.numero_ot} · ` : ""
    return `• <b>${fmtCLP(Number(s.saldo_pendiente))}</b> — ${s.cliente} (${s.patente})\n   ${ot}${s.estado}${antig}`
  })

  let msg = header + "\n" + lineas.join("\n")
  if (servicios.length > MAX) {
    msg += `\n\n… y ${servicios.length - MAX} más. Revisá el panel para el detalle completo.`
  }
  return msg
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const message = body.message
    if (!message || !message.text) return NextResponse.json({ ok: true })

    const chatId: number = message.chat.id
    const text: string = message.text.trim()

    if (!ALLOWED_IDS.includes(String(chatId))) {
      await sendMessage(chatId, "⛔ No tenés acceso a este bot.")
      return NextResponse.json({ ok: true })
    }

    if (text === "/start" || text === "/ayuda") {
      await sendMessage(
        chatId,
        `👋 <b>Bot de Cobranzas - TallerPro</b>\n\nComandos:\n/saldos — ver las cuentas por cobrar (quién debe, cuánto y desde hace cuántos días)`
      )
      return NextResponse.json({ ok: true })
    }

    if (text === "/saldos" || text === "/cobranzas" || text === "/cobrar") {
      const msg = await buildCobranzasMessage()
      await sendMessage(chatId, msg)
      return NextResponse.json({ ok: true })
    }

    await sendMessage(
      chatId,
      `No entendí. Usá /saldos para ver las cuentas por cobrar.`
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram cobranzas webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}
