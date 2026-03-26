-- Create precios_pintura table if it doesn't exist
CREATE TABLE IF NOT EXISTS precios_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precio_por_pieza DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure there's one row
INSERT INTO precios_pintura (precio_por_pieza)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM precios_pintura);

-- Create piezas_pintura table if it doesn't exist
CREATE TABLE IF NOT EXISTS piezas_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL UNIQUE,
  cantidad_piezas DECIMAL(5, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add column to servicios if it doesn't exist
ALTER TABLE IF EXISTS servicios ADD COLUMN IF NOT EXISTS color VARCHAR(100);

-- Add column to presupuestos if it doesn't exist  
ALTER TABLE IF EXISTS presupuestos ADD COLUMN IF NOT EXISTS color VARCHAR(100);

-- Verify tables exist
SELECT 'precios_pintura' as table_name, COUNT(*) as row_count FROM precios_pintura
UNION ALL
SELECT 'piezas_pintura' as table_name, COUNT(*) as row_count FROM piezas_pintura;
