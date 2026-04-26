-- Tabla de estados de servicio configurables
-- Cada estado tiene un "tipo" que conserva el rol semántico aunque el usuario
-- renombre el "nombre" desde la UI:
--   activo      = el servicio sigue en taller (aparece en la vista de Servicios)
--   por_cobrar  = dispara la alerta de cobros pendientes
--   cerrado     = servicio terminado/pagado, no cuenta como activo
CREATE TABLE IF NOT EXISTS estados_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('activo', 'por_cobrar', 'cerrado')),
  orden INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS estados_servicio_orden_idx ON estados_servicio(orden);

-- Seed de los 9 estados actuales (idempotente: solo inserta si faltan)
INSERT INTO estados_servicio (nombre, tipo, orden) VALUES
  ('En Cola',             'activo',     1),
  ('En Proceso',          'activo',     2),
  ('Esperando Repuestos', 'activo',     3),
  ('En Reparación',       'activo',     4),
  ('Control de Calidad',  'activo',     5),
  ('Listo para Entrega',  'activo',     6),
  ('Entregado',           'por_cobrar', 7),
  ('Por Cobrar',          'por_cobrar', 8),
  ('Cerrado/Pagado',      'cerrado',    9)
ON CONFLICT (nombre) DO NOTHING;
