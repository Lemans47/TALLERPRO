import { NextResponse } from "next/server"
import { ALLOWED_IDS, buildCobranzasMessage, sendMessage } from "@/lib/telegram-cobranzas"

// Webhook del bot de cobranzas. La configuración (token, chats autorizados) y el
// formato del mensaje viven en lib/telegram-cobranzas para compartirlos con el
// cron del reporte diario (app/api/cron/cobranzas).
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
        `👋 <b>Bot de Cobranzas - TallerPro</b>\n\nComandos:\n/saldos — ver las cuentas por cobrar (quién debe, cuánto y desde hace cuántos días)\n\n📅 Además recibís este reporte automáticamente todos los días a las 19hs.`
      )
      return NextResponse.json({ ok: true })
    }

    if (text === "/saldos" || text === "/cobranzas" || text === "/cobrar") {
      try {
        const msg = await buildCobranzasMessage()
        await sendMessage(chatId, msg)
      } catch (err) {
        console.error("Telegram cobranzas /saldos error:", err)
        await sendMessage(chatId, "⚠️ No pude consultar las cuentas por cobrar. Intentá de nuevo en un momento.")
      }
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
