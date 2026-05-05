import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

export const dynamic = "force-dynamic"

// Devuelve 6 meses de comparativa Pintura: piezas, MO estimada (piezas × tarifa
// del servicio), MO real (items isAuto MO pintura en costos[]), materiales
// estimados (items isAuto materiales pintura) y materiales reales (categoría
// "Gastos de Pintura" del mes). Útil para detectar tendencias del pintor a trato.
const TARIFA_DEFAULT = 24000

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
      piezas_por_servicio AS (
        SELECT
          s.id,
          date_trunc('month', s.fecha_ingreso::date)::date AS mes,
          COALESCE(NULLIF(s.mano_obra_pintura, 0), ${TARIFA_DEFAULT}) AS tarifa,
          COALESCE((
            SELECT SUM(
              CASE
                WHEN (p->>'cantidad') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  THEN (p->>'cantidad')::numeric
                ELSE 1
              END
            )
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(s.piezas_pintura) = 'array' THEN s.piezas_pintura
                WHEN jsonb_typeof(s.piezas_pintura) = 'string' THEN (s.piezas_pintura #>> '{}')::jsonb
                ELSE '[]'::jsonb
              END
            ) p
          ), 0) AS piezas,
          COALESCE((
            SELECT SUM(
              CASE
                WHEN (c->>'monto') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  THEN (c->>'monto')::numeric
                ELSE 0
              END
            )
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(s.costos) = 'array' THEN s.costos
                WHEN jsonb_typeof(s.costos) = 'string' THEN (s.costos #>> '{}')::jsonb
                ELSE '[]'::jsonb
              END
            ) c
            WHERE COALESCE(c->>'isAuto','false') = 'true'
              AND LOWER(COALESCE(c->>'descripcion','')) LIKE '%mano de obra pintura%'
          ), 0) AS mo_real,
          COALESCE((
            SELECT SUM(
              CASE
                WHEN (c->>'monto') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  THEN (c->>'monto')::numeric
                ELSE 0
              END
            )
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(s.costos) = 'array' THEN s.costos
                WHEN jsonb_typeof(s.costos) = 'string' THEN (s.costos #>> '{}')::jsonb
                ELSE '[]'::jsonb
              END
            ) c
            WHERE COALESCE(c->>'isAuto','false') = 'true'
              AND LOWER(COALESCE(c->>'descripcion','')) LIKE '%materiales pintura%'
          ), 0) AS mat_estimado
        FROM servicios s
        WHERE s.fecha_ingreso >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
      ),
      servicios_mes AS (
        SELECT
          mes,
          SUM(piezas) AS piezas,
          SUM(piezas * tarifa) AS mo_estimada,
          SUM(mo_real) AS mo_real,
          SUM(mat_estimado) AS mat_estimado
        FROM piezas_por_servicio
        GROUP BY mes
      ),
      gastos_pintura_mes AS (
        SELECT
          date_trunc('month', fecha::date)::date AS mes,
          SUM(monto) AS mat_real
        FROM gastos
        WHERE categoria = 'Gastos de Pintura'
          AND fecha >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
        GROUP BY 1
      )
      SELECT
        TO_CHAR(m.mes_start, 'YYYY-MM') AS mes,
        COALESCE(s.piezas, 0)::float AS piezas,
        COALESCE(s.mo_estimada, 0)::float AS mo_estimada,
        COALESCE(s.mo_real, 0)::float AS mo_real,
        COALESCE(s.mat_estimado, 0)::float AS mat_estimado,
        COALESCE(g.mat_real, 0)::float AS mat_real
      FROM meses m
      LEFT JOIN servicios_mes s ON s.mes = m.mes_start
      LEFT JOIN gastos_pintura_mes g ON g.mes = m.mes_start
      ORDER BY m.mes_start ASC
    `

    return NextResponse.json({ historico: rows })
  } catch (error) {
    const err = error as { message?: string; code?: string }
    console.error("Pintura histórico API error:", err)
    return NextResponse.json(
      { error: "Error loading pintura histórico", detail: err?.message ?? String(error) },
      { status: 500 },
    )
  }
}
