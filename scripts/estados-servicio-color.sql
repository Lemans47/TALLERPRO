-- Agrega columna `color` a estados_servicio (hex string).
-- Default neutral; los 9 estados sembrados originalmente reciben los colores
-- legacy que se usaban en el código (badges + pie chart + pipeline).
-- Idempotente: se puede correr varias veces sin romper nada.

ALTER TABLE estados_servicio
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#6b7280';

-- Asignar los colores legacy a los 9 estados originales.
-- Solo los actualiza si todavía tienen el default (no pisa cambios manuales del usuario).
UPDATE estados_servicio SET color = '#64748b' WHERE nombre = 'En Cola'             AND color = '#6b7280';
UPDATE estados_servicio SET color = '#3b82f6' WHERE nombre = 'En Proceso'          AND color = '#6b7280';
UPDATE estados_servicio SET color = '#eab308' WHERE nombre = 'Esperando Repuestos' AND color = '#6b7280';
UPDATE estados_servicio SET color = '#a855f7' WHERE nombre = 'En Reparación'       AND color = '#6b7280';
UPDATE estados_servicio SET color = '#6366f1' WHERE nombre = 'Control de Calidad'  AND color = '#6b7280';
UPDATE estados_servicio SET color = '#06b6d4' WHERE nombre = 'Listo para Entrega'  AND color = '#6b7280';
UPDATE estados_servicio SET color = '#10b981' WHERE nombre = 'Entregado'           AND color = '#6b7280';
UPDATE estados_servicio SET color = '#f97316' WHERE nombre = 'Por Cobrar'          AND color = '#6b7280';
UPDATE estados_servicio SET color = '#22c55e' WHERE nombre = 'Cerrado/Pagado'      AND color = '#6b7280';
