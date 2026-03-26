-- Restruuctuar tabla precios_pintura para tener solo un valor global
-- y una tabla separada para piezas con cantidad

-- 1. Crear tabla de piezas si no existe
CREATE TABLE IF NOT EXISTS piezas_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL UNIQUE,
  cantidad_piezas DECIMAL(5, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Simplificar tabla precios_pintura para solo tener precio global
-- Primero, backup de datos
CREATE TABLE precios_pintura_backup AS SELECT * FROM precios_pintura;

-- Eliminar tabla anterior
DROP TABLE IF EXISTS precios_pintura;

-- Crear nueva tabla simplificada
CREATE TABLE precios_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precio_por_pieza DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar valor por defecto (solo una fila)
INSERT INTO precios_pintura (precio_por_pieza) VALUES (0);

-- 3. Migrar datos de piezas si existen en el backup
INSERT INTO piezas_pintura (nombre, cantidad_piezas)
SELECT DISTINCT nombre, cantidad_piezas FROM precios_pintura_backup
ON CONFLICT (nombre) DO UPDATE SET cantidad_piezas = EXCLUDED.cantidad_piezas;
