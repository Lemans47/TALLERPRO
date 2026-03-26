-- Agregar columna color a la tabla servicios
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS color VARCHAR(255);

-- Agregar columna color a la tabla presupuestos
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS color VARCHAR(255);
