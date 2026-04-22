ALTER TABLE servicios
ADD COLUMN IF NOT EXISTS detalle_pendiente BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_servicios_detalle_pendiente
ON servicios (detalle_pendiente) WHERE detalle_pendiente = true;
