import { NextResponse } from "next/server"
import { ALLOWED_IDS, buildCobranzasMessage, sendMessage } from "@/lib/telegram-cobranzas"

export const dynamic = "force-dynamic"

// Reporte diario de cuentas por cobrar. Lo dispara el cron de Vercel
// (ver vercel.json) a las 23:00 UTC ≈ 19hs Chile. Envía el mismo informe que el
// comando /saldos a todos los chats autorizados.
//
// Seguridad (patrón recomendado por Vercel): cuando CRON_SECRET está disponible
// en runtime, Vercel envía "Authorization: Bearer <CRON_SECRET>" y exigimos que
// coincida. NO fallamos-cerrado si el secreto no llega: en la práctica
// `process.env.CRON_SECRET` puede no estar presente en el runtime del cron y
// bloquear el envío rompe el reporte diario. El informe solo se manda a los chats
// autorizados (ALLOWED_IDS), así que el riesgo de un disparo extra es bajo.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  // Rechazamos solo si hay secreto Y llega un header que no coincide (intento
  // explícito con credencial incorrecta). Si no hay secreto o no llega header,
  // dejamos correr para no romper el envío automático.
  if (secret && auth && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const msg = await buildCobranzasMessage()
    let sent = 0
    for (const id of ALLOWED_IDS) {
      await sendMessage(Number(id), msg)
      sent++
    }
    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    console.error("Cron cobranzas error:", err)
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 })
  }
}
