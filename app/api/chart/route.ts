import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export const dynamic = "force-dynamic"

// Devuelve 6 meses de agregados pre-calculados en SQL para RevenueChart y AverageTicketChart.
// Antes traía TODOS los servicios/gastos/empleados y los charts hacían el cálculo en el cliente.
export async function GET() {
  try {
    const db = getSQL()

    const rows = await db`
      WITH meses AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        )::date AS mes_start
      ),
      servicios_mes AS (
        SELECT
          date_trunc('month', fecha_ingreso)::date AS mes,
          COALESCE(SUM(CASE WHEN monto_total_sin_iva > 0 THEN monto_total_sin_iva ELSE 0 END), 0) AS facturado,
          COALESCE(SUM(
            CASE WHEN estado = 'Cerrado/Pagado' THEN monto_total_sin_iva
                 ELSE COALESCE(anticipo, 0) END
          ), 0) AS cobrado,
          COALESCE(SUM(
            CASE WHEN monto_total_sin_iva > 0 AND jsonb_typeof(costos) = 'array' THEN (
              SELECT COALESCE(SUM(
                CASE
                  WHEN (item->>'monto') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN (item->>'monto')::numeric
                  ELSE 0
                END
              ), 0)
              FROM jsonb_array_elements(costos) AS item
              WHERE LOWER(COALESCE(item->>'descripcion', '')) NOT LIKE '%materiales pintura%'
            ) ELSE 0 END
          ), 0) AS costos_internos,
          COUNT(*) FILTER (WHERE monto_total_sin_iva > 0) AS count_servicios
        FROM servicios
        WHERE fecha_ingreso >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
        GROUP BY 1
      ),
      gastos_mes AS (
        SELECT
          date_trunc('month', fecha)::date AS mes,
          COALESCE(SUM(monto), 0) AS total
        FROM gastos
        WHERE categoria IS DISTINCT FROM 'Sueldos'
          AND fecha >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
        GROUP BY 1
      ),
      sueldos AS (
        SELECT COALESCE(SUM(sueldo_base), 0) AS total
        FROM empleados
        WHERE activo = TRUE
      )
      SELECT
        TO_CHAR(m.mes_start, 'YYYY-MM') AS mes,
        COALESCE(s.facturado, 0)::float AS facturado,
        COALESCE(s.cobrado, 0)::float AS cobrado,
        COALESCE(s.costos_internos, 0)::float AS costos_internos,
        COALESCE(g.total, 0)::float AS gastos_operativos,
        sueldos.total::float AS sueldos_comprometidos,
        COALESCE(s.count_servicios, 0)::int AS count_servicios
      FROM meses m
      LEFT JOIN servicios_mes s ON s.mes = m.mes_start
      LEFT JOIN gastos_mes g ON g.mes = m.mes_start
      CROSS JOIN sueldos
      ORDER BY m.mes_start ASC
    `

    return NextResponse.json({ monthlyData: rows })
  } catch (error) {
    const err = error as { message?: string; code?: string; detail?: string }
    console.error("Chart API error:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    })
    return NextResponse.json(
      { error: "Error loading chart data", detail: err?.message ?? String(error) },
      { status: 500 },
    )
  }
}
