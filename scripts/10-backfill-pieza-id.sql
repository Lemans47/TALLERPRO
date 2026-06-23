-- Backfill de `pieza_id` en los snapshots de piezas de pintura + normalización de la
-- doble-codificación JSONB de la columna `piezas_pintura`.
--
-- POR QUÉ:
--   El formulario casaba las piezas guardadas en cada servicio/presupuesto contra el
--   catálogo `piezas_pintura` por NOMBRE exacto. Al renombrar piezas en Configuración
--   (commit cf9223d) el catálogo cambió pero los snapshots históricos quedaron con el
--   nombre viejo y dejaron de calzar: "desaparecían" del total al editar (ej. OT-75:
--   $1.010.000 en pantalla vs $1.190.000 real). La solución estable es guardar el `id`
--   del catálogo dentro del snapshot (`pieza_id`) y casar por ese id. Este script lo
--   agrega a los registros ya existentes.
--
--   Además, varias filas tienen `piezas_pintura` "doble-codificada" (guardada como string
--   JSON en vez de array). Como de todos modos reescribimos la columna, la dejamos como
--   array JSONB real. (cobros/costos quedan como están — fuera de alcance.)
--
-- SEGURIDAD (por qué NO rompe nada):
--   * Solo AGREGA la clave `pieza_id`; conserva nombre/cantidad/precio_unitario/precio y
--     el orden original de cada pieza. No toca monto_total ni saldos.
--   * Las piezas sin match en el catálogo se conservan intactas (no se pierden).
--   * Todos los lectores del código ya manejan ambos formatos (array y string):
--     parseArr / parseCobros / parseJsonbArray y los CASE en database.ts:989 y
--     pintura-historico. Por eso pasar string->array es seguro.
--   * Solo procesa filas cuyo contenido resuelve LIMPIAMENTE a un array JSON
--     (guardas con `IS JSON ARRAY`). Cualquier fila rara se SALTA (queda intacta),
--     nunca produce error ni corrupción.
--   * Idempotente: re-ejecutarlo no cambia nada (respeta `pieza_id` ya presente y
--     evita reescrituras con `IS DISTINCT FROM`).
--
-- CÓMO CORRERLO (Supabase SQL Editor). Ejecutar los pasos EN ORDEN.
--   Validar el PASO 2 antes de seguir al PASO 3.

-- ===========================================================================
-- PASO 0 — Respaldo (red de seguridad, restaurable). Correr UNA sola vez,
--          ANTES del PASO 3. (IF NOT EXISTS conserva el primer respaldo.)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS servicios_backup_20260622    AS TABLE servicios;
CREATE TABLE IF NOT EXISTS presupuestos_backup_20260622 AS TABLE presupuestos;
-- Restaurar un registro:
--   UPDATE servicios s SET piezas_pintura = b.piezas_pintura
--   FROM servicios_backup_20260622 b WHERE s.id = b.id;
-- Borrar los respaldos cuando todo esté verificado:
--   DROP TABLE servicios_backup_20260622;  DROP TABLE presupuestos_backup_20260622;

-- ===========================================================================
-- PASO 1 — Vista previa (no modifica nada): piezas que recibirán pieza_id y
--          cuáles quedan "huérfanas" (sin match en el catálogo).
-- ===========================================================================
WITH src AS (
  SELECT s.numero_ot,
         CASE
           WHEN jsonb_typeof(s.piezas_pintura) = 'array' THEN s.piezas_pintura
           WHEN jsonb_typeof(s.piezas_pintura) = 'string'
                AND (s.piezas_pintura #>> '{}') IS JSON ARRAY
                THEN (s.piezas_pintura #>> '{}')::jsonb
           ELSE NULL
         END AS arr
  FROM servicios s
)
SELECT src.numero_ot,
       elem->>'nombre'        AS pieza_nombre,
       (elem->>'pieza_id')    AS pieza_id_actual,
       (SELECT c.id::text FROM piezas_pintura c
          WHERE lower(btrim(c.nombre)) = lower(btrim(elem->>'nombre'))
          ORDER BY c.created_at, c.id LIMIT 1) AS pieza_id_a_asignar
FROM src
CROSS JOIN LATERAL jsonb_array_elements(src.arr) AS elem
WHERE src.arr IS NOT NULL
  AND (elem->>'pieza_id') IS NULL
ORDER BY src.numero_ot;

-- PASO 1b — Filas que el backfill SALTARÁ por no resolver a un array limpio.
--           Lo esperado es 0 filas. Si aparece alguna, revisarla a mano antes.
SELECT 'servicios' AS tabla, numero_ot::text AS ref, jsonb_typeof(piezas_pintura) AS tipo
FROM servicios
WHERE piezas_pintura IS NOT NULL
  AND NOT (
    jsonb_typeof(piezas_pintura) = 'array'
    OR (jsonb_typeof(piezas_pintura) = 'string' AND (piezas_pintura #>> '{}') IS JSON ARRAY)
  )
UNION ALL
SELECT 'presupuestos', id::text, jsonb_typeof(piezas_pintura)
FROM presupuestos
WHERE piezas_pintura IS NOT NULL
  AND NOT (
    jsonb_typeof(piezas_pintura) = 'array'
    OR (jsonb_typeof(piezas_pintura) = 'string' AND (piezas_pintura #>> '{}') IS JSON ARRAY)
  );

-- ===========================================================================
-- PASO 2 — PRUEBA en un solo registro (OT-75). Correr y luego revisar el
--          resultado (PASO 4) y/o el servicio en la app antes de seguir.
-- ===========================================================================
WITH src AS (
  SELECT s.id,
         CASE
           WHEN jsonb_typeof(s.piezas_pintura) = 'array' THEN s.piezas_pintura
           WHEN jsonb_typeof(s.piezas_pintura) = 'string'
                AND (s.piezas_pintura #>> '{}') IS JSON ARRAY
                THEN (s.piezas_pintura #>> '{}')::jsonb
           ELSE NULL
         END AS arr
  FROM servicios s
  WHERE s.numero_ot = 75
),
rebuilt AS (
  SELECT src.id,
         jsonb_agg(
           CASE
             WHEN (e.elem->>'pieza_id') IS NOT NULL THEN e.elem
             WHEN cat.cat_id IS NOT NULL THEN e.elem || jsonb_build_object('pieza_id', cat.cat_id)
             ELSE e.elem
           END
           ORDER BY e.ord
         ) AS new_arr
  FROM src
  CROSS JOIN LATERAL jsonb_array_elements(src.arr) WITH ORDINALITY AS e(elem, ord)
  LEFT JOIN LATERAL (
    SELECT c.id::text AS cat_id
    FROM piezas_pintura c
    WHERE lower(btrim(c.nombre)) = lower(btrim(e.elem->>'nombre'))
    ORDER BY c.created_at, c.id LIMIT 1
  ) cat ON TRUE
  WHERE src.arr IS NOT NULL
  GROUP BY src.id
)
UPDATE servicios s
SET piezas_pintura = rebuilt.new_arr
FROM rebuilt
WHERE s.id = rebuilt.id
  AND s.piezas_pintura IS DISTINCT FROM rebuilt.new_arr;

-- ===========================================================================
-- PASO 3 — Aplicación completa. Correr SOLO tras validar el PASO 2.
--          (Opcional: envolver 3a + 3b en  BEGIN; ... COMMIT;  para atomicidad.)
-- ===========================================================================

-- 3a. servicios
WITH src AS (
  SELECT s.id,
         CASE
           WHEN jsonb_typeof(s.piezas_pintura) = 'array' THEN s.piezas_pintura
           WHEN jsonb_typeof(s.piezas_pintura) = 'string'
                AND (s.piezas_pintura #>> '{}') IS JSON ARRAY
                THEN (s.piezas_pintura #>> '{}')::jsonb
           ELSE NULL
         END AS arr
  FROM servicios s
  WHERE s.piezas_pintura IS NOT NULL
),
rebuilt AS (
  SELECT src.id,
         jsonb_agg(
           CASE
             WHEN (e.elem->>'pieza_id') IS NOT NULL THEN e.elem
             WHEN cat.cat_id IS NOT NULL THEN e.elem || jsonb_build_object('pieza_id', cat.cat_id)
             ELSE e.elem
           END
           ORDER BY e.ord
         ) AS new_arr
  FROM src
  CROSS JOIN LATERAL jsonb_array_elements(src.arr) WITH ORDINALITY AS e(elem, ord)
  LEFT JOIN LATERAL (
    SELECT c.id::text AS cat_id
    FROM piezas_pintura c
    WHERE lower(btrim(c.nombre)) = lower(btrim(e.elem->>'nombre'))
    ORDER BY c.created_at, c.id LIMIT 1
  ) cat ON TRUE
  WHERE src.arr IS NOT NULL
  GROUP BY src.id
)
UPDATE servicios s
SET piezas_pintura = rebuilt.new_arr
FROM rebuilt
WHERE s.id = rebuilt.id
  AND s.piezas_pintura IS DISTINCT FROM rebuilt.new_arr;

-- 3b. presupuestos
WITH src AS (
  SELECT p.id,
         CASE
           WHEN jsonb_typeof(p.piezas_pintura) = 'array' THEN p.piezas_pintura
           WHEN jsonb_typeof(p.piezas_pintura) = 'string'
                AND (p.piezas_pintura #>> '{}') IS JSON ARRAY
                THEN (p.piezas_pintura #>> '{}')::jsonb
           ELSE NULL
         END AS arr
  FROM presupuestos p
  WHERE p.piezas_pintura IS NOT NULL
),
rebuilt AS (
  SELECT src.id,
         jsonb_agg(
           CASE
             WHEN (e.elem->>'pieza_id') IS NOT NULL THEN e.elem
             WHEN cat.cat_id IS NOT NULL THEN e.elem || jsonb_build_object('pieza_id', cat.cat_id)
             ELSE e.elem
           END
           ORDER BY e.ord
         ) AS new_arr
  FROM src
  CROSS JOIN LATERAL jsonb_array_elements(src.arr) WITH ORDINALITY AS e(elem, ord)
  LEFT JOIN LATERAL (
    SELECT c.id::text AS cat_id
    FROM piezas_pintura c
    WHERE lower(btrim(c.nombre)) = lower(btrim(e.elem->>'nombre'))
    ORDER BY c.created_at, c.id LIMIT 1
  ) cat ON TRUE
  WHERE src.arr IS NOT NULL
  GROUP BY src.id
)
UPDATE presupuestos p
SET piezas_pintura = rebuilt.new_arr
FROM rebuilt
WHERE p.id = rebuilt.id
  AND p.piezas_pintura IS DISTINCT FROM rebuilt.new_arr;

-- ===========================================================================
-- PASO 4 — Verificación. Debe devolver 0 filas marcadas "REVISAR". Las
--          "huérfana legítima" son piezas eliminadas del catálogo (ej. espejos
--          en OT-6): el formulario igual las conserva.
-- ===========================================================================
SELECT s.numero_ot,
       elem->>'nombre' AS pieza_sin_pieza_id,
       CASE WHEN EXISTS (
         SELECT 1 FROM piezas_pintura c
         WHERE lower(btrim(c.nombre)) = lower(btrim(elem->>'nombre'))
       ) THEN 'REVISAR: existe en catálogo' ELSE 'huérfana legítima' END AS estado
FROM servicios s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.piezas_pintura) = 'array' THEN s.piezas_pintura ELSE '[]'::jsonb END
) AS elem
WHERE (elem->>'pieza_id') IS NULL
ORDER BY estado, s.numero_ot;
