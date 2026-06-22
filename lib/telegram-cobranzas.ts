import { getServiciosActivosCobranza, getServiciosPorCobrar } from "@/lib/database"

// Lógica compartida del bot de cobranzas de Telegram. La usan tanto el webhook
// (app/api/telegram-cobranzas) como el cron del reporte diario
// (app/api/cron/cobranzas), para no duplicar formato ni configuración.
//
// Token propio (TELEGRAM_COBRANZAS_BOT_TOKEN) y lista de chats autorizados
// (TELEGRAM_COBRANZAS_ALLOWED_CHAT_IDS); si esta última no está, reutiliza la del
// bot de gastos (TELEGRAM_ALLOWED_CHAT_IDS).
export const BOT_TOKEN = process.env.TELEGRAM_COBRANZAS_BOT_TOKEN || ""
export const ALLOWED_IDS = (
  process.env.TELEGRAM_COBRANZAS_ALLOWED_CHAT_IDS ||
  process.env.TELEGRAM_ALLOWED_CHAT_IDS ||
  ""
)
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean)

export async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
}

function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL")
}

// Escapa los caracteres que rompen el parseo HTML de Telegram. Sin esto, un
// nombre de cliente con "&", "<" o ">" hace que Telegram rechace el mensaje
// completo (Bad Request: can't parse entities) y el bot no responde nada.
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function diasDesde(fecha?: string | null): number | null {
  if (!fecha) return null
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return null
  const ms = Date.now() - d.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export async function buildCobranzasMessage(): Promise<string> {
  const servicios = await getServiciosPorCobrar()
  if (!servicios.length) {
    return "✅ <b>No hay saldos pendientes.</b>\nTodos los servicios están al día. 🎉"
  }

  const total = servicios.reduce((acc, s) => acc + (Number(s.saldo_pendiente) || 0), 0)
  const header =
    `💰 <b>Cuentas por cobrar</b>\n` +
    `Total: <b>${fmtCLP(total)}</b> · ${servicios.length} servicio(s)\n` +
    `━━━━━━━━━━━━━━`

  // Telegram limita a ~4096 caracteres: mostramos las más antiguas primero y
  // cortamos si la lista es muy larga. Cada servicio es un bloque separado por
  // una línea en blanco para que se lea más aireado.
  const MAX = 30
  const bloques = servicios.slice(0, MAX).map((s) => {
    const dias = diasDesde(s.fecha_entregado ?? s.fecha_ingreso)
    const antig = dias !== null ? ` · ${dias} días` : ""
    const ot = s.numero_ot ? ` · OT ${esc(s.numero_ot)}` : ""
    return (
      `👤 <b>${esc(s.cliente)}</b>\n` +
      `🚗 ${esc(s.patente)}${ot}\n` +
      `💵 ${fmtCLP(Number(s.saldo_pendiente))}${antig}`
    )
  })

  let msg = header + "\n\n" + bloques.join("\n\n")
  if (servicios.length > MAX) {
    msg += `\n\n… y ${servicios.length - MAX} más. Revisá el panel para el detalle completo.`
  }
  return msg
}

// Servicios activos en el taller (todo lo que no está entregado/por cobrar ni
// cerrado), con el total a cobrar de cada uno y lo abonado hasta ahora. Mismo
// formato aireado que buildCobranzasMessage.
export async function buildActivosMessage(): Promise<string> {
  const servicios = await getServiciosActivosCobranza()
  if (!servicios.length) {
    return "🔧 <b>No hay servicios activos en el taller.</b>"
  }

  const totalCobrado = servicios.reduce((acc, s) => acc + (Number(s.monto_total) || 0), 0)
  const totalAbonado = servicios.reduce((acc, s) => acc + (Number(s.anticipo) || 0), 0)
  const totalSaldo = servicios.reduce((acc, s) => acc + (Number(s.saldo_pendiente) || 0), 0)
  const header =
    `🔧 <b>Servicios activos en taller</b>\n` +
    `${servicios.length} servicio(s)\n` +
    `Cobrado: <b>${fmtCLP(totalCobrado)}</b> · Abonado: <b>${fmtCLP(totalAbonado)}</b>\n` +
    `Saldo: <b>${fmtCLP(totalSaldo)}</b>\n` +
    `━━━━━━━━━━━━━━`

  const MAX = 30
  const bloques = servicios.slice(0, MAX).map((s) => {
    const dias = diasDesde(s.fecha_ingreso)
    const antig = dias !== null ? ` · ${dias} días` : ""
    const ot = s.numero_ot ? ` · OT ${esc(s.numero_ot)}` : ""
    return (
      `👤 <b>${esc(s.cliente)}</b>\n` +
      `🚗 ${esc(s.patente)}${ot} · ${esc(s.estado)}\n` +
      `💵 Cobrado: ${fmtCLP(Number(s.monto_total))}  |  Abonado: ${fmtCLP(Number(s.anticipo))}\n` +
      `⏳ Saldo: ${fmtCLP(Number(s.saldo_pendiente))}${antig}`
    )
  })

  let msg = header + "\n\n" + bloques.join("\n\n")
  if (servicios.length > MAX) {
    msg += `\n\n… y ${servicios.length - MAX} más. Revisá el panel para el detalle completo.`
  }
  return msg
}
