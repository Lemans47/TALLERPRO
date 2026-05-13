-- Permite distinguir solicitudes enviadas desde el formulario público
-- (/solicitar-presupuesto) de las creadas manualmente desde el panel,
-- y marcarlas como "no leídas" hasta que el operador las abra.

ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS leida BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_presupuestos_source_leida
  ON presupuestos(source, leida) WHERE leida = FALSE;
