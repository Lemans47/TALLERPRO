-- Insertar piezas de pintura por defecto
INSERT INTO piezas_pintura (nombre, cantidad_piezas, created_at, updated_at)
VALUES 
  ('Capot', 1, NOW(), NOW()),
  ('Maletero', 2, NOW(), NOW()),
  ('Puerta Frontal Izquierda', 1, NOW(), NOW()),
  ('Puerta Frontal Derecha', 1, NOW(), NOW()),
  ('Puerta Trasera Izquierda', 1, NOW(), NOW()),
  ('Puerta Trasera Derecha', 1, NOW(), NOW()),
  ('Techo', 1, NOW(), NOW()),
  ('Piso', 1, NOW(), NOW()),
  ('Espejo', 0.5, NOW(), NOW()),
  ('Guardafangos Izquierdo', 1, NOW(), NOW()),
  ('Guardafangos Derecho', 1, NOW(), NOW()),
  ('Parachoques Delantero', 1, NOW(), NOW()),
  ('Parachoques Trasero', 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insertar precio inicial si no existe
INSERT INTO precios_pintura (precio_por_pieza, created_at, updated_at)
VALUES (90000, NOW(), NOW())
ON CONFLICT DO NOTHING;
