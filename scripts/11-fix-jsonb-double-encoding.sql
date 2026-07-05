-- ============================================================================
-- 11 - Backfill: repara campos JSONB guardados con doble codificación
-- ============================================================================
--
-- BUG: safeJson() (lib/database.ts) pre-stringificaba los valores antes de
-- pasarlos como parámetro a postgres.js. El driver, con prepare:false, hace
-- describe-first: el servidor le informa que el parámetro es jsonb y el driver
-- vuelve a aplicar JSON.stringify al hacer Bind. Resultado: las columnas jsonb
-- quedaron guardadas como STRING JSON ('"[{\"...\"}]"') en vez de array nativo
-- (jsonb_typeof = 'string' en vez de 'array').
--
-- Este script desenvuelve esas filas: costos = (costos #>> '{}')::jsonb, en
-- loop para cubrir doble Y triple codificación, con guard IS JSON (PG16+;
-- producción es PG 17) para no abortar si algún string no fuese JSON válido.
--
-- *** ORDEN CRÍTICO ***
-- 1. Deployar primero el fix de escritura (safeJson devuelve el valor JS crudo,
--    ya no un string). Si se corre este backfill con la app vieja, la próxima
--    edición de cada fila la vuelve a corromper.
-- 2. Verificar el fix: crear/editar un servicio de prueba desde la app y
--    confirmar con la query de la Sección A que esa fila queda 'array'.
-- 3. Recién entonces correr este script completo en el SQL Editor de Supabase.
--
-- Idempotente: se puede correr N veces; cuando no queda nada que reparar,
-- reporta 0 filas por columna. No toca updated_at (es reparación de datos,
-- no una edición de negocio).
--
-- Post-backfill (follow-ups, NO incluidos aquí):
--   - Simplificar los CASE defensivos de lectura (getServiciosConCostosPendientes
--     en lib/database.ts, app/api/chart/route.ts, app/api/pintura-historico) a
--     usar la columna directa, y evaluar índice GIN + prefiltro @> sobre costos.
--   - parseJsonbArray() (lib/reportes/kpis.ts) se CONSERVA como red de seguridad.
-- ============================================================================

-- ─── Sección A: diagnóstico ANTES (informativa) ────────────────────────────
-- Distribución de jsonb_typeof por tabla/columna. Tras el backfill (Sección D,
-- misma query) todo debe quedar 'array'.
SELECT 'servicios' AS tabla, c.col, COALESCE(jsonb_typeof(c.val), 'NULL') AS tipo, count(*) AS filas
FROM servicios s
CROSS JOIN LATERAL (VALUES
  ('cobros', s.cobros), ('costos', s.costos), ('piezas_pintura', s.piezas_pintura),
  ('abonos', s.abonos), ('observaciones_checkboxes', s.observaciones_checkboxes),
  ('fotos_ingreso', s.fotos_ingreso), ('fotos_entrega', s.fotos_entrega)
) AS c(col, val)
GROUP BY 1, 2, 3
UNION ALL
SELECT 'presupuestos', c.col, COALESCE(jsonb_typeof(c.val), 'NULL'), count(*)
FROM presupuestos p
CROSS JOIN LATERAL (VALUES
  ('cobros', p.cobros), ('costos', p.costos), ('piezas_pintura', p.piezas_pintura),
  ('observaciones_checkboxes', p.observaciones_checkboxes), ('fotos_ingreso', p.fotos_ingreso)
) AS c(col, val)
GROUP BY 1, 2, 3
UNION ALL
SELECT 'plantillas_servicio', c.col, COALESCE(jsonb_typeof(c.val), 'NULL'), count(*)
FROM plantillas_servicio pl
CROSS JOIN LATERAL (VALUES ('cobros', pl.cobros), ('costos', pl.costos)) AS c(col, val)
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- ─── Secciones B y C: reparación (transaccional) ───────────────────────────
BEGIN;

DO $$
DECLARE
  par RECORD;
  filas BIGINT;
  total BIGINT;
  pasada INT;
BEGIN
  FOR par IN
    SELECT * FROM (VALUES
      ('servicios',           'cobros'),
      ('servicios',           'costos'),
      ('servicios',           'piezas_pintura'),
      ('servicios',           'abonos'),
      ('servicios',           'observaciones_checkboxes'),
      ('servicios',           'fotos_ingreso'),
      ('servicios',           'fotos_entrega'),
      ('presupuestos',        'cobros'),
      ('presupuestos',        'costos'),
      ('presupuestos',        'piezas_pintura'),
      ('presupuestos',        'observaciones_checkboxes'),
      ('presupuestos',        'fotos_ingreso'),
      ('plantillas_servicio', 'cobros'),
      ('plantillas_servicio', 'costos')
    ) AS t(tabla, col)
  LOOP
    -- Sección B: desenvolver strings sobre-codificados. Cada pasada quita UN
    -- nivel de codificación; el loop repite hasta converger (cubre doble,
    -- triple, etc.). El guard IS JSON deja intacto cualquier string que no
    -- sea JSON válido en vez de abortar la transacción.
    total := 0;
    pasada := 0;
    LOOP
      EXECUTE format(
        'UPDATE %I SET %I = (%I #>> ''{}'')::jsonb
          WHERE jsonb_typeof(%I) = ''string'' AND (%I #>> ''{}'') IS JSON',
        par.tabla, par.col, par.col, par.col, par.col
      );
      GET DIAGNOSTICS filas = ROW_COUNT;
      total := total + filas;
      pasada := pasada + 1;
      EXIT WHEN filas = 0 OR pasada >= 10;  -- 10 = tope de seguridad
    END LOOP;

    -- Sección C: normalizar residuos escalares. Todas estas columnas son
    -- arrays para la app; NULL o jsonb null romperían jsonb_array_elements
    -- en consumidores SQL. (Hoy producción no tiene ninguno, es preventivo.)
    EXECUTE format(
      'UPDATE %I SET %I = ''[]''::jsonb
        WHERE %I IS NULL OR jsonb_typeof(%I) = ''null''',
      par.tabla, par.col, par.col, par.col
    );
    GET DIAGNOSTICS filas = ROW_COUNT;

    RAISE NOTICE '%.%: % desenvueltas, % normalizadas a []', par.tabla, par.col, total, filas;
  END LOOP;
END $$;

COMMIT;

-- ─── Sección D: verificación DESPUÉS ───────────────────────────────────────
-- Debe devolver únicamente tipo = 'array' en todas las filas.
SELECT 'servicios' AS tabla, c.col, COALESCE(jsonb_typeof(c.val), 'NULL') AS tipo, count(*) AS filas
FROM servicios s
CROSS JOIN LATERAL (VALUES
  ('cobros', s.cobros), ('costos', s.costos), ('piezas_pintura', s.piezas_pintura),
  ('abonos', s.abonos), ('observaciones_checkboxes', s.observaciones_checkboxes),
  ('fotos_ingreso', s.fotos_ingreso), ('fotos_entrega', s.fotos_entrega)
) AS c(col, val)
GROUP BY 1, 2, 3
UNION ALL
SELECT 'presupuestos', c.col, COALESCE(jsonb_typeof(c.val), 'NULL'), count(*)
FROM presupuestos p
CROSS JOIN LATERAL (VALUES
  ('cobros', p.cobros), ('costos', p.costos), ('piezas_pintura', p.piezas_pintura),
  ('observaciones_checkboxes', p.observaciones_checkboxes), ('fotos_ingreso', p.fotos_ingreso)
) AS c(col, val)
GROUP BY 1, 2, 3
UNION ALL
SELECT 'plantillas_servicio', c.col, COALESCE(jsonb_typeof(c.val), 'NULL'), count(*)
FROM plantillas_servicio pl
CROSS JOIN LATERAL (VALUES ('cobros', pl.cobros), ('costos', pl.costos)) AS c(col, val)
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
