-- Create precios_pintura table if it doesn't exist
CREATE TABLE IF NOT EXISTS precios_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precio_por_pieza NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create piezas_pintura table if it doesn't exist
CREATE TABLE IF NOT EXISTS piezas_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL UNIQUE,
  cantidad_piezas NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default price if table is empty
INSERT INTO precios_pintura (precio_por_pieza)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM precios_pintura);
