-- ============================================================================
-- 12 - Índice GIN sobre servicios.costos para el prefiltro @>
-- ============================================================================
--
-- Requisito: haber corrido antes scripts/11-fix-jsonb-double-encoding.sql
-- (costos 100% array nativo; el operador @> no matchea sobre jsonb string).
-- Corrido el 2026-07-05 en producción.
--
-- getServiciosConCostosPendientes (lib/database.ts) prefiltra con
--   s.costos @> '[{"pagado": false}]'
-- antes del EXISTS. Este índice permite que ese prefiltro use un bitmap scan
-- en vez de seq scan. Con ~100 servicios el beneficio es marginal (es dejar
-- la infraestructura lista para cuando la tabla crezca); el planificador lo
-- ignorará mientras el seq scan sea más barato, y eso está bien.
--
-- jsonb_path_ops: variante compacta del GIN para jsonb que solo soporta @>
-- (justo lo que usamos); ocupa menos y es más rápida que la default jsonb_ops.
--
-- Idempotente (IF NOT EXISTS). Correr a mano en el SQL Editor de Supabase.
-- ============================================================================

-- Precondición: no debe devolver filas (todo costos es array tras el script 11).
SELECT id, numero_ot, jsonb_typeof(costos) AS tipo
FROM servicios
WHERE costos IS NOT NULL AND jsonb_typeof(costos) <> 'array';

CREATE INDEX IF NOT EXISTS idx_servicios_costos_gin
  ON servicios USING GIN (costos jsonb_path_ops);

-- Verificación: el índice existe.
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'servicios' AND indexname = 'idx_servicios_costos_gin';
