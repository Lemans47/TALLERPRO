-- Agrega `fecha_entregado` a servicios para medir antigüedad de cuentas por
-- cobrar desde el momento del cambio de estado a "por_cobrar"/"cerrado"
-- (no desde fecha_ingreso del vehículo al taller).
--
-- COMO CORRERLO:
--   Pegar este archivo en Supabase SQL Editor y ejecutar. Es idempotente.

ALTER TABLE servicios ADD COLUMN IF NOT EXISTS fecha_entregado DATE NULL;

CREATE INDEX IF NOT EXISTS idx_servicios_fecha_entregado ON servicios(fecha_entregado);

-- Backfill: para servicios que ya están en estado por_cobrar/cerrado y no tienen
-- fecha_entregado, usar `updated_at` como mejor estimación disponible (es lo más
-- cercano que tenemos al momento del cambio de estado).
UPDATE servicios s
SET fecha_entregado = s.updated_at::date
WHERE fecha_entregado IS NULL
  AND s.estado IN (SELECT nombre FROM estados_servicio WHERE tipo IN ('por_cobrar', 'cerrado'));
