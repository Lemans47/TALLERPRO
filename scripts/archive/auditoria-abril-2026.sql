-- ─────────────────────────────────────────────────────────────────────────────
-- AUDITORÍA DE DATOS — ABRIL 2026
-- Ejecutar en Supabase SQL Editor (https://app.supabase.com → tu proyecto → SQL Editor)
-- Recomendación: ejecutar bloque por bloque (no todo junto) y revisar cada resultado.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── BLOQUE 1 — Valores reales del campo iva (B6) ────────────────────────────
-- ¿Qué buscar?
--   Confirmar qué valores literal existen en BD: "con", "sin", "incluido",
--   "no incluido", NULL u otros. El nuevo helper `tieneIva()` reconoce "con"
--   y "incluido"; cualquier otro valor que represente "tiene IVA" se debe
--   añadir al helper.
SELECT iva, COUNT(*) AS n
FROM servicios
GROUP BY iva
ORDER BY n DESC;


-- ─── BLOQUE 2 — Coherencia monto_total vs monto_total_sin_iva ─────────────────
-- ¿Qué buscar?
--   Servicios marcados con IVA donde monto_total no es ≈ monto_total_sin_iva * 1.19.
--   Diferencias > $1 indican datos mal guardados (alguien cambió uno sin
--   recalcular el otro). Si hay muchos, hay que decidir cuál fuente es la verdad.
SELECT id, numero_ot, patente, iva,
       monto_total, monto_total_sin_iva,
       ROUND(monto_total_sin_iva * 1.19) AS esperado_con_iva,
       (monto_total - monto_total_sin_iva * 1.19) AS diferencia
FROM servicios
WHERE iva IN ('con', 'incluido')
  AND ABS(monto_total - monto_total_sin_iva * 1.19) > 1
ORDER BY ABS(monto_total - monto_total_sin_iva * 1.19) DESC
LIMIT 50;


-- ─── BLOQUE 3 — Servicios de abril por estado ────────────────────────────────
-- ¿Qué buscar?
--   Distribución de estados en abril. Útil para saber cuánto del facturado
--   ya cerró vs cuánto está por cobrar. Idealmente la mayoría está
--   "cerrado" o "por cobrar"; si hay muchos en "en proceso" con monto
--   significa que abril aún no termina de liquidarse.
SELECT estado,
       COUNT(*) AS servicios,
       SUM(monto_total_sin_iva) AS facturado_sin_iva,
       SUM(CASE WHEN monto_total_sin_iva > 0 THEN 1 ELSE 0 END) AS con_monto
FROM servicios
WHERE fecha_ingreso >= '2026-04-01' AND fecha_ingreso <= '2026-04-30'
GROUP BY estado
ORDER BY facturado_sin_iva DESC NULLS LAST;


-- ─── BLOQUE 4 — Comparar fecha_ingreso vs fecha_facturacion ──────────────────
-- ¿Qué buscar?
--   Servicios con fecha_ingreso en abril pero fecha_facturacion en otro mes
--   (o sin fecha de facturación). Estos son los que el reporte de IVA SII
--   sacará/meterá según el criterio. También los facturados en abril pero
--   ingresados antes (criterio SII los pone en abril).
SELECT
  CASE
    WHEN fecha_facturacion IS NULL THEN 'Sin fecha factura'
    WHEN fecha_facturacion >= '2026-04-01' AND fecha_facturacion <= '2026-04-30' THEN 'Facturado en abril'
    WHEN fecha_facturacion < '2026-04-01' THEN 'Facturado antes de abril'
    WHEN fecha_facturacion > '2026-04-30' THEN 'Facturado después de abril'
  END AS clasificacion,
  COUNT(*) AS n,
  SUM(monto_total_sin_iva) AS neto,
  SUM(monto_total - monto_total_sin_iva) AS iva_emitido
FROM servicios
WHERE fecha_ingreso >= '2026-04-01' AND fecha_ingreso <= '2026-04-30'
  AND iva IN ('con', 'incluido')
GROUP BY 1
ORDER BY n DESC;


-- ─── BLOQUE 5 — IVA débito real de abril (criterio SII) ──────────────────────
-- ¿Qué buscar?
--   El número que debe coincidir con la card "IVA Débito" del nuevo reporte.
SELECT
  COUNT(*) AS facturas_abril,
  SUM(monto_total_sin_iva) AS neto_total,
  SUM(monto_total - monto_total_sin_iva) AS iva_debito
FROM servicios
WHERE iva IN ('con', 'incluido')
  AND fecha_facturacion >= '2026-04-01'
  AND fecha_facturacion <= '2026-04-30';


-- ─── BLOQUE 6 — IVA crédito real de abril ────────────────────────────────────
-- ¿Qué buscar?
--   Suma del IVA contenido en gastos+costos con tipo_documento='factura' del mes.
--   Debe coincidir con la card "IVA Crédito" del nuevo reporte.
WITH gastos_abril AS (
  SELECT 'gasto'::text AS origen, descripcion, monto
  FROM gastos
  WHERE tipo_documento = 'factura'
    AND fecha >= '2026-04-01' AND fecha <= '2026-04-30'
),
costos_abril AS (
  SELECT 'costo_servicio'::text AS origen,
         COALESCE(item->>'descripcion', '') AS descripcion,
         COALESCE((item->>'monto')::numeric, 0) AS monto
  FROM servicios s,
       LATERAL jsonb_array_elements(
         CASE
           WHEN jsonb_typeof(s.costos) = 'array' THEN s.costos
           WHEN jsonb_typeof(s.costos) = 'string' THEN (s.costos #>> '{}')::jsonb
           ELSE '[]'::jsonb
         END
       ) AS item
  WHERE s.fecha_ingreso >= '2026-04-01' AND s.fecha_ingreso <= '2026-04-30'
    AND COALESCE(item->>'tipo_documento', '') = 'factura'
)
SELECT origen,
       COUNT(*) AS items,
       SUM(monto) AS bruto,
       ROUND(SUM(monto * 0.19 / 1.19)) AS iva_credito_estimado
FROM (SELECT * FROM gastos_abril UNION ALL SELECT * FROM costos_abril) u
GROUP BY origen;


-- ─── BLOQUE 7 — Costos directos: distribución isAuto ─────────────────────────
-- ¿Qué buscar?
--   Items en costos[] con isAuto=true son auto-calculados (mano de obra
--   pintura, etc.) — el nuevo `isCostoRealItem` los excluye para no
--   contarlos dos veces. Si hay servicios con muchos isAuto y montos altos,
--   confirma que no están en el cálculo de costos directos.
SELECT
  CASE COALESCE(item->>'isAuto', 'false')
    WHEN 'true' THEN 'isAuto (excluido)'
    ELSE 'real (incluido)'
  END AS tipo,
  COUNT(*) AS items,
  SUM(COALESCE((item->>'monto')::numeric, 0)) AS monto_total,
  COUNT(DISTINCT s.id) AS servicios_distintos
FROM servicios s,
     LATERAL jsonb_array_elements(
       CASE
         WHEN jsonb_typeof(s.costos) = 'array' THEN s.costos
         WHEN jsonb_typeof(s.costos) = 'string' THEN (s.costos #>> '{}')::jsonb
         ELSE '[]'::jsonb
       END
     ) AS item
WHERE s.fecha_ingreso >= '2026-04-01' AND s.fecha_ingreso <= '2026-04-30'
GROUP BY 1;


-- ─── BLOQUE 8 — Distribución de checkboxes (para reporte por tipo) ───────────
-- ¿Qué buscar?
--   El reporte "Por Tipo" usa observaciones_checkboxes. Si la mayoría de
--   servicios no tiene ningún checkbox, todos caerán en "Otros" y el
--   reporte será inútil hasta que se completen los checkboxes.
-- Maneja casos donde observaciones_checkboxes está guardado como string en vez de array.
WITH normalizados AS (
  SELECT
    CASE
      WHEN observaciones_checkboxes IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof(observaciones_checkboxes) = 'array' THEN observaciones_checkboxes
      WHEN jsonb_typeof(observaciones_checkboxes) = 'string' THEN
        CASE
          WHEN (observaciones_checkboxes #>> '{}') ~ '^\[' THEN (observaciones_checkboxes #>> '{}')::jsonb
          ELSE '[]'::jsonb
        END
      ELSE '[]'::jsonb
    END AS checks,
    monto_total_sin_iva
  FROM servicios
  WHERE fecha_ingreso >= '2026-04-01' AND fecha_ingreso <= '2026-04-30'
)
SELECT
  CASE
    WHEN jsonb_array_length(checks) = 0 THEN 'Sin checkbox'
    ELSE array_to_string(ARRAY(SELECT jsonb_array_elements_text(checks)), ' + ')
  END AS combinacion,
  COUNT(*) AS n,
  SUM(monto_total_sin_iva) AS facturado
FROM normalizados
GROUP BY 1
ORDER BY n DESC;


-- ─── BLOQUE 9 — Sueldos: abonos pagados vs sueldo_base devengado ──────────────
-- ¿Qué buscar?
--   Diferencia entre sueldos pagados (cash) y sueldos devengados (contable).
--   Si abonos << devengados significa que tiene deuda con empleados.
SELECT
  (SELECT COALESCE(SUM(monto), 0)
   FROM abonos_empleados
   WHERE fecha >= '2026-04-01' AND fecha <= '2026-04-30') AS sueldos_pagados_abril,
  (SELECT COALESCE(SUM(sueldo_base), 0) FROM empleados WHERE activo = TRUE) AS sueldos_devengados,
  (SELECT COUNT(*) FROM empleados WHERE activo = TRUE) AS empleados_activos;


-- ─── BLOQUE 10 — Cuentas por cobrar globales (independiente de mes) ──────────
-- ¿Qué buscar?
--   Total y antigüedad de los servicios con saldo pendiente.
--   Debe coincidir con la pestaña "Por Cobrar" del reporte.
SELECT
  CASE
    WHEN CURRENT_DATE - fecha_ingreso::date > 30 THEN '>30 días'
    WHEN CURRENT_DATE - fecha_ingreso::date > 15 THEN '16-30 días'
    ELSE '≤15 días'
  END AS bucket,
  COUNT(*) AS servicios,
  SUM(saldo_pendiente) AS saldo_total
FROM servicios
WHERE saldo_pendiente > 0
  AND estado IN (SELECT nombre FROM estados_servicio WHERE tipo = 'por_cobrar')
GROUP BY 1
ORDER BY MIN(CURRENT_DATE - fecha_ingreso::date) DESC;


-- ─── BLOQUE 11 — Resumen ejecutivo abril 2026 (snapshot único) ───────────────
-- ¿Qué buscar?
--   Snapshot que comparas contra los KPIs del nuevo reporte. Si los números
--   no coinciden hay un bug; si coinciden, el rework está validado.
WITH cerrados AS (
  SELECT nombre FROM estados_servicio WHERE tipo = 'cerrado'
)
SELECT
  -- Ingresos
  (SELECT COALESCE(SUM(monto_total_sin_iva), 0)
     FROM servicios
     WHERE fecha_ingreso >= '2026-04-01' AND fecha_ingreso <= '2026-04-30'
       AND estado IN (SELECT nombre FROM cerrados)) AS ingreso_cobrado,
  (SELECT COALESCE(SUM(monto_total_sin_iva), 0)
     FROM servicios
     WHERE fecha_ingreso >= '2026-04-01' AND fecha_ingreso <= '2026-04-30'
       AND monto_total_sin_iva > 0) AS ingreso_facturado,
  -- Costos directos (criterio canónico de isCostoRealItem en lib/reportes/kpis.ts):
  --   - Excluye SIEMPRE "materiales pintura" (los reales se contabilizan en gastos
  --     categoría "Gastos de Pintura"; los isAuto son solo referenciales).
  --   - INCLUYE mano de obra pintura aunque sea isAuto (es lo que se paga al
  --     pintor a trato — costo real no cubierto por sueldos devengados).
  (SELECT COALESCE(SUM(COALESCE((item->>'monto')::numeric, 0)), 0)
     FROM servicios s,
          LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(s.costos) = 'array' THEN s.costos
              WHEN jsonb_typeof(s.costos) = 'string' THEN (s.costos #>> '{}')::jsonb
              ELSE '[]'::jsonb
            END
          ) AS item
     WHERE s.fecha_ingreso >= '2026-04-01' AND s.fecha_ingreso <= '2026-04-30'
       AND s.monto_total_sin_iva > 0
       AND LOWER(COALESCE(item->>'descripcion', '')) NOT LIKE '%materiales pintura%'
  ) AS costos_directos,
  -- Gastos sin sueldos
  (SELECT COALESCE(SUM(monto), 0) FROM gastos
     WHERE fecha >= '2026-04-01' AND fecha <= '2026-04-30'
       AND categoria IS DISTINCT FROM 'Sueldos') AS gastos_tabla,
  -- Sueldos devengados
  (SELECT COALESCE(SUM(sueldo_base), 0) FROM empleados WHERE activo = TRUE) AS sueldos_devengados,
  -- Sueldos pagados
  (SELECT COALESCE(SUM(monto), 0) FROM abonos_empleados
     WHERE fecha >= '2026-04-01' AND fecha <= '2026-04-30') AS sueldos_pagados,
  -- IVA débito SII
  (SELECT COALESCE(SUM(monto_total - monto_total_sin_iva), 0)
     FROM servicios
     WHERE iva IN ('con', 'incluido')
       AND fecha_facturacion >= '2026-04-01'
       AND fecha_facturacion <= '2026-04-30') AS iva_debito;
