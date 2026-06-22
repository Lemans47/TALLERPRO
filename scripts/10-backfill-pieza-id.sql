-- Backfill de `pieza_id` en los snapshots de piezas de pintura + normalización de la
-- doble-codificación JSONB de la columna `piezas_pintura`.
--
-- POR QUÉ:
--   El formulario casaba las piezas guardadas en cada servicio/presupuesto contra el
--   catálogo `piezas_pintura` por NOMBRE exacto. Al renombrar piezas en Configuración
--   (commit cf9223d) el catálogo cambió pero los snapshots históricos quedaron con el
--   nombre viejo, así que dejaron de calzar y "desaparecían" del total al editar.
--   La solución estable es guardar el `id` del catálogo dentro del snapshot (`pieza_id`)
--   y casar por ese id. Este script lo agrega a los registros ya existentes.
--
--   Además, varias columnas JSONB están "doble-codificadas" (guardadas como string JSON
--   en vez de array). Como de todos modos reescribimos `piezas_pintura`, la dejamos como
--   array JSONB real. (cobros/costos quedan como están — fuera de alcance.)
--
-- SEGURIDAD (por qué no rompe nada):
--   * Solo AGREGA `pieza_id` a cada elemento (elem || {pieza_id}); preserva nombre,
--     cantidad, precio_unitario, precio y el orden. No borra ni recalcula nada.
--   * NO toca monto_total / monto_total_sin_iva / anticipo / saldo_pendiente: los totales
--     guardados (que están correctos) no cambian.
--   * Solo procesa filas cuyo contenido resuelve limpiamente a un ARRAY JSON; cualquier
--     fila anómala (escalar, anidamiento raro, NULL) se deja INTACTA (no se corrompe).
--   * Piezas sin match en el catálogo se conservan sin cambios (no se pierden).
--   * Idempotente: respeta los `pieza_id` ya presentes y solo escribe si hubo cambio.
--   * Todos los lectores (parseArr/parseJsonbArray/parseCobros y los CASE en SQL) ya
--     manejan tanto array como string, por lo que normalizar el formato es seguro.
--
-- CÓMO CORRERLO (Supabase SQL Editor). Idempotente: se puede correr varias veces.
--   Ejecutar los pasos EN ORDEN. Revisar el PASO 2 antes de seguir al PASO 3.

-- ===========================================================================
-- PASO 0 — Respaldo (red de seguridad, restaurable). Correr UNA sola vez,
--          ANTES del PASO 2/3 (si se corre después, respaldaría datos ya
--          modificados).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS servicios_backup_20260622    AS TABLE servicios;
CREATE TABLE IF NOT EXISTS presupuestos_backup_20260622 AS TABLE presupuestos;
-- Restaurar un registro:  UPDATE servicios s SET piezas_pintura = b.piezas_pintura
--   FROM servicios_backup_20260622 b WHERE s.id = b.id;
-- Restaurar TODO:         UPDATE servicios s SET piezas_pintura = b.piezas_pintura
--   FROM servicios_backup_20260622 b WHERE s.id = b.id;
-- Borrar los backups cuando todo esté verificado:  DROP TABLE servicios_backup_20260622;

-- ===========================================================================
-- PASO 1 — Vista previa (no modifica nada): qué piezas recibirán pieza_id y
--          cuáles quedarán como "huérfanas" (sin match en el catálogo).
-- ===========================================================================
WITH src AS (
  SELECT s.numero_ot,
         CASE jsonb_typeof(s.piezas_pintura)
           WHEN 'array'  THEN s.piezas_pintura
           WHEN 'string' THEN (s.piezas_pintura #>> '{}')::jsonb
           ELSE NULL
         END AS arr
  FROM servicios s
)
SELECT src.numero_ot,
       elem->>'nombre'                       AS pieza_nombre,
       (elem->>'pieza_id')                   AS pieza_id_actual,
       (SELECT c.id::text FROM piezas_pintura c
          WHERE lower(btrim(c.nombre)) = lower(btrim(elem->>'nombre'))
          ORDER BY c.created_at, c.id LIMIT 1) AS pieza_id_a_asignar
FROM src
CROSS JOIN LATERAL jsonb_array_elements(src.arr) AS elem
WHERE jsonb_typeof(src.arr) = 'array'
  AND (elem->>'pieza_id') IS NULL
ORDER BY src.numero_ot;

-- ===========================================================================
-- PASO 2 — PRUEBA en un solo registro (OT-75). Correr y luego revisar el
--          resultado (PASO 4) y/o el servicio en la app antes de seguir.
-- ===========================================================================
WITH src AS (
  SELECT s.id,
         CASE jsonb_typeof(s.piezas_pintura)
           WHEN 'array'  THEN s.piezas_pintura
           WHEN 'string' THEN (s.piezas_pintura #>> '{}')::jsonb
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
  WHERE jsonb_typeof(src.arr) = 'array'
  GROUP BY src.id
)
UPDATE servicios s
SET piezas_pintura = rebuilt.new_arr
FROM rebuilt
WHERE s.id = rebuilt.id
  AND s.piezas_pintura IS DISTINCT FROM rebuilt.new_arr;

-- ===========================================================================
-- PASO 3 — Aplicación completa (servicios + presupuestos).
--          Correr SOLO después de validar el PASO 2.
--          (Opcional: envolver 3a+3b en BEGIN; ... COMMIT; para atomicidad.)
-- ===========================================================================

-- 3a. servicios
WITH src AS (
  SELECT s.id,
         CASE jsonb_typeof(s.piezas_pintura)
           WHEN 'array'  THEN s.piezas_pintura
           WHEN 'string' THEN (s.piezas_pintura #>> '{}')::jsonb
           ELSE NULL
         END AS arr
  FROM servicios s
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
  WHERE jsonb_typeof(src.arr) = 'array'
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
         CASE jsonb_typeof(p.piezas_pintura)
           WHEN 'array'  THEN p.piezas_pintura
           WHEN 'string' THEN (p.piezas_pintura #>> '{}')::jsonb
           ELSE NULL
         END AS arr
  FROM presupuestos p
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
  WHERE jsonb_typeof(src.arr) = 'array'
  GROUP BY src.id
)
UPDATE presupuestos p
SET piezas_pintura = rebuilt.new_arr
FROM rebuilt
WHERE p.id = rebuilt.id
  AND p.piezas_pintura IS DISTINCT FROM rebuilt.new_arr;

-- ===========================================================================
-- PASO 4 — Verificación. Debe devolver 0 filas con estado 'REVISAR'. Las
--          'huérfana legítima' son piezas eliminadas del catálogo (ej. los
--          espejos de OT-6) y son esperables; el formulario igual las conserva.
-- ===========================================================================
SELECT s.numero_ot,
       elem->>'nombre' AS pieza_sin_pieza_id,
       CASE WHEN EXISTS (
         SELECT 1 FROM piezas_pintura c
         WHERE lower(btrim(c.nombre)) = lower(btrim(elem->>'nombre'))
       ) THEN 'REVISAR: existe en catálogo' ELSE 'huérfana legítima' END AS estado
FROM servicios s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE jsonb_typeof(s.piezas_pintura)
    WHEN 'array' THEN s.piezas_pintura ELSE '[]'::jsonb END
) AS elem
WHERE (elem->>'pieza_id') IS NULL
ORDER BY estado, s.numero_ot;
