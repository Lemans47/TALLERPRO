-- Agrega columna `abonos` JSONB a servicios para historial de pagos parciales.
-- `anticipo` y `saldo_pendiente` siguen siendo DECIMAL y se recalculan
-- como sum(abonos[].monto) antes de cada INSERT/UPDATE desde la app.
--
-- COMO CORRERLO:
--   Pegar este archivo en Supabase SQL Editor y ejecutar. Es idempotente.
--   DEBE ejecutarse ANTES de deployar el código que usa abonos.

-- 1. Agregar columna abonos si no existe
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS abonos JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill: para servicios existentes con anticipo > 0 y abonos vacíos,
--    crear un abono sintético con fecha=fecha_ingreso y monto=anticipo.
UPDATE servicios
SET abonos = jsonb_build_array(
    jsonb_build_object(
      'fecha', fecha_ingreso::text,
      'monto', anticipo::int
    )
  )
WHERE (abonos IS NULL OR abonos = '[]'::jsonb)
  AND anticipo > 0;

-- 3. Índice GIN para búsquedas sobre el array de abonos
CREATE INDEX IF NOT EXISTS idx_servicios_abonos ON servicios USING GIN(abonos);
