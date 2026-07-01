import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"
import { requireRole } from "@/lib/auth-server"
import { hoyChile } from "@/lib/utils"

// Diagnóstico de zona horaria: corre por la conexión real de la app (el pooler
// de Supabase) para verificar que el ajuste `-c timezone=America/Santiago` se
// aplicó. Si `db_timezone` es "America/Santiago" y `db_current_date` coincide con
// `hoy_chile` (sobre todo probándolo de noche en Chile), el arreglo está activo.
export async function GET() {
  const denied = await requireRole()
  if (denied) return denied

  const sql = getSQL()
  const rows = await sql`
    SELECT
      current_setting('TIMEZONE')                                   AS db_timezone,
      current_date::text                                            AS db_current_date,
      (now())::date::text                                           AS db_now_date,
      to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD HH24:MI') AS db_ahora_chile
  `
  const r = rows[0] as Record<string, string>

  return NextResponse.json({
    db_timezone: r.db_timezone,
    db_current_date: r.db_current_date,
    db_now_date: r.db_now_date,
    db_ahora_chile: r.db_ahora_chile,
    // Referencia calculada en el runtime (independiente de la DB): debe coincidir
    // con db_current_date cuando la zona de sesión quedó bien configurada.
    hoy_chile: hoyChile(),
    ok: r.db_timezone === "America/Santiago" && r.db_current_date === hoyChile(),
  })
}
