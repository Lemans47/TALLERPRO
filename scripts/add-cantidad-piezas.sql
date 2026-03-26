-- Agregar columna cantidad_piezas a la tabla precios_pintura
ALTER TABLE precios_pintura ADD COLUMN cantidad_piezas DECIMAL(5,2) DEFAULT 1;

-- Actualizar todas las piezas existentes a 1 como valor por defecto
UPDATE precios_pintura SET cantidad_piezas = 1 WHERE cantidad_piezas IS NULL;

-- Hacer la columna NOT NULL después de establecer valores
ALTER TABLE precios_pintura ALTER COLUMN cantidad_piezas SET NOT NULL;
