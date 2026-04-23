-- Migracion one-shot: consolida todas las DDL que antes corrian en runtime
-- (funciones ensure* en lib/database.ts) y las indexaciones de P2.
--
-- COMO CORRERLO:
--   1. Abrir Supabase Dashboard -> SQL Editor
--   2. Pegar este archivo completo y ejecutar
--   3. Es idempotente: se puede correr varias veces sin romper nada
--
-- Por que: tener ALTER TABLE / CREATE INDEX dentro del path de queries
-- dispara invalidacion del schema cache de PostgREST y, bajo carga, causa
-- el bucle infinito de reload + statement_timeout (57014) que colapso la DB.
-- Mover todo a una migracion que se corre manualmente una vez elimina ese
-- vector de fallo.

-- ── servicios.numero_ot + secuencia ──────────────────────────────────────────
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS numero_ot INTEGER;
CREATE SEQUENCE IF NOT EXISTS servicios_numero_ot_seq;

-- Sincronizar la secuencia con el max actual (idempotente).
SELECT setval(
  'servicios_numero_ot_seq',
  GREATEST(
    (SELECT COALESCE(MAX(numero_ot), 0)::int FROM servicios),
    (SELECT last_value::int FROM servicios_numero_ot_seq)
  )
);

-- ── patente_norm (columnas generadas + indices) ──────────────────────────────
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS patente_norm TEXT
  GENERATED ALWAYS AS (UPPER(REGEXP_REPLACE(patente, '[^A-Za-z0-9]', '', 'g'))) STORED;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS patente_norm TEXT
  GENERATED ALWAYS AS (UPPER(REGEXP_REPLACE(patente, '[^A-Za-z0-9]', '', 'g'))) STORED;

CREATE INDEX IF NOT EXISTS idx_vehiculos_patente_norm ON vehiculos(patente_norm);
CREATE INDEX IF NOT EXISTS idx_servicios_patente_norm ON servicios(patente_norm);
CREATE INDEX IF NOT EXISTS idx_servicios_fecha_ingreso ON servicios(fecha_ingreso DESC);

-- ── servicios.fecha_facturacion (IVA debito por fecha de emision real) ───────
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS fecha_facturacion DATE NULL;
CREATE INDEX IF NOT EXISTS idx_servicios_fecha_facturacion ON servicios(fecha_facturacion);

-- ── gastos.tipo_documento (boleta | factura) ─────────────────────────────────
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'boleta';

-- ── plantillas de gastos fijos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos_fijos_plantillas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descripcion TEXT NOT NULL,
  monto_estimado INTEGER NOT NULL DEFAULT 0,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO gastos_fijos_plantillas (descripcion, monto_estimado, orden)
SELECT * FROM (VALUES
  ('Luz', 0, 1),
  ('Agua', 0, 2),
  ('Convenio Contribuciones', 0, 3),
  ('Boleta Electrónica', 0, 4)
) AS seed(descripcion, monto_estimado, orden)
WHERE NOT EXISTS (SELECT 1 FROM gastos_fijos_plantillas);

-- ── plantillas de servicio ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plantillas_servicio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cobros JSONB DEFAULT '[]',
  costos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indices nuevos de P2 ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gastos_categoria_fecha ON gastos(categoria, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_servicios_estado_fecha ON servicios(estado, fecha_ingreso DESC);
