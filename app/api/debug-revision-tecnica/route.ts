import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export async function GET(request: Request) {
  const db = getSQL()
  const { searchParams } = new URL(request.url)
  const testPatente = searchParams.get("test")

  try {
    const [counts]: any[] = await db`
      SELECT
        (SELECT COUNT(*) FROM servicios)::int AS total_servicios,
        (SELECT COUNT(*) FROM vehiculos)::int AS total_vehiculos,
        (SELECT COUNT(*) FROM vehiculos WHERE mes_revision_tecnica IS NOT NULL)::int AS vehiculos_con_mes,
        (SELECT COUNT(*) FROM vehiculos WHERE mes_revision_tecnica IS NULL)::int AS vehiculos_sin_mes
    `

    const vehiculosSample: any[] = await db`
      SELECT patente, marca, modelo, mes_revision_tecnica
      FROM vehiculos
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 10
    `

    const serviciosSample: any[] = await db`
      SELECT DISTINCT patente FROM servicios LIMIT 10
    `

    const matches: any[] = await db`
      SELECT
        s.patente AS servicio_patente,
        v.patente AS vehiculo_patente,
        v.mes_revision_tecnica
      FROM (SELECT DISTINCT patente FROM servicios) s
      LEFT JOIN vehiculos v
        ON UPPER(REGEXP_REPLACE(v.patente, '[^A-Za-z0-9]', '', 'g'))
         = UPPER(REGEXP_REPLACE(s.patente, '[^A-Za-z0-9]', '', 'g'))
      LIMIT 20
    `

    // Test API con una patente específica si se pasa ?test=XXXX
    let apiTest: any = null
    if (testPatente) {
      const apiKey = process.env.GETAPI_API_KEY
      if (apiKey) {
        const clean = testPatente.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
        try {
          const res = await fetch(`https://chile.getapi.cl/v1/vehicles/plate/${clean}`, {
            headers: { "X-Api-Key": apiKey },
            signal: AbortSignal.timeout(10000),
          })
          const body = await res.json().catch(() => ({}))
          apiTest = {
            patente: clean,
            status: res.status,
            success: body?.success,
            monthRT: body?.data?.monthRT ?? null,
            dataKeys: body?.data ? Object.keys(body.data) : null,
            fullResponse: body,
          }
        } catch (e: any) {
          apiTest = { patente: clean, error: e?.message }
        }
      } else {
        apiTest = { error: "GETAPI_API_KEY no configurada" }
      }
    }

    return NextResponse.json({
      counts,
      vehiculosSample,
      serviciosSample,
      joinMatches: matches,
      apiTest,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 })
  }
}
