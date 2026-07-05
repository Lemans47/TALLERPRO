-- Índice GIN para la alerta de "Costos Taller Pendientes" del dashboard.
-- Acelera el prefiltro `costos @> '[{"pagado": false}]'` de
-- getServiciosConCostosPendientes() (lib/database.ts).
-- OPCIONAL: con pocos miles de servicios la query funciona bien sin índice.
-- Ejecutar manualmente en el SQL Editor de Supabase. Idempotente.

CREATE INDEX IF NOT EXISTS idx_servicios_costos_gin
  ON servicios USING GIN (costos jsonb_path_ops);
