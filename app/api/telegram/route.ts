import { NextResponse } from "next/server"
import { createGasto } from "@/lib/database"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const ALLOWED_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "").split(",").map((s) => s.trim())

const CATEGORIAS = [
  { id: "Gastos de Pintura", label: "Pintura" },
  { id: "Gastos Misceláneos", label: "Misceláneos" },
  { id: "Gastos Fijos", label: "Fijos" },
  { id: "Sueldos", label: "Sueldos" },
]

async function sendMessage(chatId: number, text: string, replyMarkup?: object) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
      parse_mode: "HTML",
    }),
  })
}

async function answerCallback(callbackQueryId: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  })
}

async function editMessage(chatId: number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
  })
}

function parseMontoDescripcion(text: string): { monto: number; descripcion: string } | null {
  // Acepta: "3500 combustible" o "combustible 3500"
  const match = text.match(/^(\d[\d.,]*)[\s,]+(.+)$/) || text.match(/^(.+?)[\s,]+(\d[\d.,]*)$/)
  if (!match) return null

  let monto: number
  let descripcion: string

  const first = match[1].replace(/\./g, "").replace(",", ".")
  const second = match[2].replace(/\./g, "").replace(",", ".")

  if (!isNaN(Number(first))) {
    monto = Number(first)
    descripcion = match[2].trim()
  } else if (!isNaN(Number(second))) {
    monto = Number(second)
    descripcion = match[1].trim()
  } else {
    return null
  }

  if (monto <= 0) return null
  return { monto, descripcion }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Handle callback query (button press)
    if (body.callback_query) {
      const { id: callbackId, from, message, data } = body.callback_query
      const chatId: number = from.id

      if (!ALLOWED_IDS.includes(String(chatId))) {
        await answerCallback(callbackId)
        return NextResponse.json({ ok: true })
      }

      await answerCallback(callbackId)

      // data format: "cat|monto|descripcion"
      const parts = data.split("|")
      if (parts[0] !== "cat" || parts.length < 3) {
        return NextResponse.json({ ok: true })
      }

      const categoria = parts[1]
      const monto = Number(parts[2])
      const descripcion = parts.slice(3).join("|")
      const fecha = new Date().toISOString().split("T")[0]

      await createGasto({ fecha, categoria, descripcion, monto })

      await editMessage(
        chatId,
        message.message_id,
        `✅ <b>Gasto registrado</b>\n💰 $${monto.toLocaleString("es-CL")}\n📝 ${descripcion}\n🏷 ${categoria}`
      )

      return NextResponse.json({ ok: true })
    }

    // Handle regular message
    const message = body.message
    if (!message || !message.text) return NextResponse.json({ ok: true })

    const chatId: number = message.chat.id
    const text: string = message.text.trim()

    if (!ALLOWED_IDS.includes(String(chatId))) {
      await sendMessage(chatId, "⛔ No tenés acceso a este bot.")
      return NextResponse.json({ ok: true })
    }

    // Help command
    if (text === "/start" || text === "/ayuda") {
      await sendMessage(
        chatId,
        `👋 <b>Bot de Gastos - TallerPro</b>\n\nEnviá un mensaje con el monto y descripción:\n\n<code>3500 combustible</code>\n<code>15000 pintura base</code>\n<code>repuesto disco 8900</code>\n\nLuego elegís la categoría con los botones.`
      )
      return NextResponse.json({ ok: true })
    }

    const parsed = parseMontoDescripcion(text)
    if (!parsed) {
      await sendMessage(
        chatId,
        `❌ No entendí el mensaje. Enviá el monto y descripción, por ejemplo:\n<code>3500 combustible</code>`
      )
      return NextResponse.json({ ok: true })
    }

    const { monto, descripcion } = parsed

    // Show category buttons
    const buttons = CATEGORIAS.map((cat) => ({
      text: cat.label,
      callback_data: `cat|${cat.id}|${monto}|${descripcion}`,
    }))

    await sendMessage(
      chatId,
      `💰 <b>$${monto.toLocaleString("es-CL")}</b> — ${descripcion}\n\n¿En qué categoría lo registro?`,
      {
        inline_keyboard: [buttons],
      }
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}
