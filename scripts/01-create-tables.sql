-- Esquema de base de datos para gestión de taller automotriz
-- Base de datos: Neon PostgreSQL

-- Eliminar tablas existentes si existen
DROP TABLE IF EXISTS servicios CASCADE;
DROP TABLE IF EXISTS presupuestos CASCADE;
DROP TABLE IF EXISTS gastos CASCADE;
DROP TABLE IF EXISTS trabajadores CASCADE;

-- Tabla de Servicios
CREATE TABLE servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  patente TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  telefono TEXT NOT NULL,
  observaciones TEXT,
  mano_obra_pintura DECIMAL(12, 0) DEFAULT 0,
  cobros JSONB DEFAULT '[]'::jsonb,
  costos JSONB DEFAULT '[]'::jsonb,
  piezas_pintura JSONB DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'En Cola',
  iva TEXT DEFAULT 'sin',
  anticipo DECIMAL(12, 0) DEFAULT 0,
  saldo_pendiente DECIMAL(12, 0) DEFAULT 0,
  monto_total DECIMAL(12, 0) DEFAULT 0,
  monto_total_sin_iva DECIMAL(12, 0) DEFAULT 0,
  observaciones_checkboxes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Presupuestos
CREATE TABLE presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  patente TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  telefono TEXT NOT NULL,
  observaciones TEXT,
  mano_obra_pintura DECIMAL(12, 0) DEFAULT 0,
  cobros JSONB DEFAULT '[]'::jsonb,
  costos JSONB DEFAULT '[]'::jsonb,
  piezas_pintura JSONB DEFAULT '[]'::jsonb,
  iva TEXT DEFAULT 'sin',
  monto_total DECIMAL(12, 0) DEFAULT 0,
  monto_total_sin_iva DECIMAL(12, 0) DEFAULT 0,
  observaciones_checkboxes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Gastos
CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  monto DECIMAL(12, 0) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Trabajadores
CREATE TABLE trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  sueldo_base DECIMAL(12, 0) NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_servicios_patente ON servicios(patente);
CREATE INDEX IF NOT EXISTS idx_servicios_fecha ON servicios(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_servicios_estado ON servicios(estado);
CREATE INDEX IF NOT EXISTS idx_presupuestos_patente ON presupuestos(patente);
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha ON presupuestos(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria);
