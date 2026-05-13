-- Permite guardar fotos en los presupuestos (en particular para las solicitudes
-- enviadas desde el formulario público). Al convertir a servicio se copian
-- automáticamente al campo fotos_ingreso del servicio.

ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS fotos_ingreso JSONB NOT NULL DEFAULT '[]'::jsonb;
