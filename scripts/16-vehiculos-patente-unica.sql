-- ===========================================================================
-- 16 — Índice único sobre vehiculos.patente_norm
-- ===========================================================================
-- Correr manualmente en el SQL Editor de Supabase. Es idempotente.
--
-- Por qué: `vehiculos` solo tenía índices NO únicos (patente_norm, cliente_id)
-- además de la PK sobre `id`. /api/lookup-patente cacheaba el resultado del
-- registro vehicular con `INSERT ... ON CONFLICT (patente)`, que sin un índice
-- único sobre esa columna falla con 42P10 ("no unique or exclusion constraint
-- matching the ON CONFLICT specification"). El error caía en un catch que solo
-- lo logueaba, así que el VIN que devolvía la API nunca quedaba guardado.
--
-- El código ya no usa ON CONFLICT (hace UPDATE y, si no tocó filas, INSERT),
-- así que esto no es un requisito para que el VIN se guarde. Lo que agrega es
-- impedir que dos consultas simultáneas sobre la misma patente creen filas
-- duplicadas: ese duplicado es justamente lo que /api/backfill-revision-tecnica
-- tiene que ir a consolidar después.
--
-- PASO 1 — Verificar que no haya duplicados (lo esperado es 0 filas).
--          Si aparece alguna patente, consolidar esas filas a mano antes del
--          PASO 2; si no, la creación del índice va a fallar.
SELECT patente_norm, COUNT(*) AS filas, STRING_AGG(id::text, ', ') AS ids
FROM vehiculos
WHERE patente_norm IS NOT NULL
GROUP BY patente_norm
HAVING COUNT(*) > 1
ORDER BY filas DESC;

-- PASO 2 — Crear el índice único.
--          patente_norm es la columna generada (UPPER + sin guiones/espacios),
--          que es como el resto del código busca una patente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehiculos_patente_norm_unique
  ON vehiculos (patente_norm);

-- El índice no único anterior (idx_vehiculos_patente_norm) queda redundante,
-- pero no se borra: scripts/02-runtime-migration.sql lo vuelve a crear, así que
-- borrarlo acá solo lo haría reaparecer en la próxima corrida de ese script.

-- PASO 3 — Verificación.
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'vehiculos';
