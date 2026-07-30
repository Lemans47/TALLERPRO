import { NextResponse } from "next/server"
import { getSQL, getNombresEstadosPorTipo } from "@/lib/database"
import { requireRole } from "@/lib/auth-server"

export const dynamic = "force-dynamic"

// Devuelve 6 meses de agregados pre-calculados en SQL para RevenueChart y AverageTicketChart.
// Antes traía TODOS los servicios/gastos/empleados y los charts hacían el cálculo en el cliente.
export async function GET() {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const db = getSQL()
    // Resolver nombres de estados "cerrado" dinámicamente para que el rename desde
    // configuración no haga que el cobrado quede en 0.
    const nombresCerrado = await getNombresEstadosPorTipo(["cerrado"])

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
          date_trunc('month', fecha_ingreso::date)::date AS mes,
          COALESCE(SUM(CASE WHEN monto_total_sin_iva > 0 THEN monto_total_sin_iva ELSE 0 END), 0) AS facturado,
          COALESCE(SUM(
            CASE WHEN estado = ANY(${nombresCerrado}::text[]) THEN monto_total_sin_iva
                 ELSE COALESCE(anticipo, 0) END
          ), 0) AS cobrado,
          COALESCE(SUM(
            COALESCE((
              SELECT SUM(
                CASE
                  WHEN (item->>'monto') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN (item->>'monto')::numeric
                  ELSE 0
                END
              )
              FROM jsonb_array_elements(costos) AS item
              -- Mismo filtro que isCostoRealItem en lib/reportes/kpis.ts:
              -- excluye SOLO "materiales pintura" (ya está en Gastos de Pintura).
              -- La MO de pintura SÍ cuenta porque el pintor es a trato (no empleado).
              WHERE LOWER(COALESCE(item->>'descripcion', '')) NOT LIKE '%materiales pintura%'
            ), 0)
          ), 0) AS costos_internos,
          COUNT(*) FILTER (WHERE monto_total_sin_iva > 0) AS count_servicios
        FROM servicios
        WHERE fecha_ingreso::date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
        GROUP BY 1
      ),
      gastos_mes AS (
        SELECT
          date_trunc('month', fecha::date)::date AS mes,
          -- Gastos fijos de la tabla (Luz, Agua, etc.)
          COALESCE(SUM(monto) FILTER (WHERE categoria = 'Gastos Fijos'), 0) AS fijos,
          -- Resto de gastos (misceláneos, pintura, sin categoría): todo lo que no es
          -- Sueldos ni Gastos Fijos cae en operativos, incluso categorías futuras.
          COALESCE(SUM(monto) FILTER (
            WHERE categoria IS DISTINCT FROM 'Sueldos'
              AND categoria IS DISTINCT FROM 'Gastos Fijos'
          ), 0) AS operativos
        FROM gastos
        WHERE categoria IS DISTINCT FROM 'Sueldos'
          AND fecha::date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
        GROUP BY 1
      ),
      -- Sueldos POR MES, replicando calcularSueldosMes() de lib/reportes/kpis.ts:
      -- max(sueldo_base, abonado) por empleado activo, o solo lo abonado si ya está
      -- desactivado (finiquito). Antes esto era un SUM(sueldo_base) global con CROSS
      -- JOIN, o sea la planilla de hoy proyectada sobre los 6 meses.
      -- El filtro usa las columnas año/mes, no la fecha: un pago de julio hecho en
      -- agosto se imputa a julio (mismo criterio que getAbonosByMonth).
      sueldos_mes AS (
        SELECT
          m.mes_start AS mes,
          COALESCE(SUM(
            CASE WHEN e.activo THEN GREATEST(e.sueldo_base, COALESCE(ab.abonado, 0))
                 ELSE COALESCE(ab.abonado, 0) END
          ), 0) AS total
        FROM meses m
        CROSS JOIN empleados e
        LEFT JOIN LATERAL (
          SELECT SUM(a.monto) AS abonado
          FROM abonos_empleados a
          WHERE a.empleado_id = e.id
            AND a.año = EXTRACT(YEAR  FROM m.mes_start)
            AND a.mes = EXTRACT(MONTH FROM m.mes_start)
        ) ab ON TRUE
        WHERE e.activo OR ab.abonado IS NOT NULL
        GROUP BY m.mes_start
      )
      SELECT
        TO_CHAR(m.mes_start, 'YYYY-MM') AS mes,
        COALESCE(s.facturado, 0)::float AS facturado,
        COALESCE(s.cobrado, 0)::float AS cobrado,
        COALESCE(s.costos_internos, 0)::float AS costos_internos,
        COALESCE(g.fijos, 0)::float AS gastos_fijos_tabla,
        COALESCE(g.operativos, 0)::float AS gastos_operativos_tabla,
        COALESCE(sm.total, 0)::float AS sueldos_comprometidos,
        COALESCE(s.count_servicios, 0)::int AS count_servicios
      FROM meses m
      LEFT JOIN servicios_mes s ON s.mes = m.mes_start
      LEFT JOIN gastos_mes g ON g.mes = m.mes_start
      LEFT JOIN sueldos_mes sm ON sm.mes = m.mes_start
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
