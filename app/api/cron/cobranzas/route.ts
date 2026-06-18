import { NextResponse } from "next/server"
import { ALLOWED_IDS, buildCobranzasMessage, sendMessage } from "@/lib/telegram-cobranzas"

export const dynamic = "force-dynamic"

// Reporte diario de cuentas por cobrar. Lo dispara el cron de Vercel
// (ver vercel.json) a las 23:00 UTC ≈ 19hs Chile. Envía el mismo informe que el
// comando /saldos a todos los chats autorizados.
//
// Seguridad: si está configurada CRON_SECRET, Vercel la envía en el header
// "Authorization: Bearer <CRON_SECRET>". Exigimos que coincida para que nadie
// más pueda disparar el envío llamando la URL.
export async function GET(request: Request) {
  // Fallar-cerrado: sin CRON_SECRET configurada nadie puede disparar el envío.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("Cron cobranzas: CRON_SECRET no configurada — endpoint deshabilitado")
    return NextResponse.json({ ok: false, error: "cron not configured" }, { status: 503 })
  }
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
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
