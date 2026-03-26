-- Crear tablas de piezas_pintura y precios_pintura
CREATE TABLE IF NOT EXISTS piezas_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  cantidad_piezas DECIMAL(5,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS precios_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precio_por_pieza DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar precio inicial solo si no existe
INSERT INTO precios_pintura (precio_por_pieza) 
SELECT 90000 
WHERE NOT EXISTS (SELECT 1 FROM precios_pintura LIMIT 1);

-- Insertar piezas iniciales solo si no existen
INSERT INTO piezas_pintura (nombre, cantidad_piezas)
SELECT * FROM (VALUES
  ('Capot', 1),
  ('Maletero', 2),
  ('Espejos', 0.5),
  ('Puerta Delantera Izquierda', 1.5),
  ('Puerta Delantera Derecha', 1.5),
  ('Puerta Trasera Izquierda', 1.5),
  ('Puerta Trasera Derecha', 1.5),
  ('Parabrisas', 1),
  ('Parachoques Delantero', 1),
  ('Parachoques Trasero', 1)
) AS v(nombre, cantidad_piezas)
WHERE NOT EXISTS (
  SELECT 1 FROM piezas_pintura WHERE piezas_pintura.nombre = v.nombre
);
