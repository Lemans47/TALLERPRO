-- ─────────────────────────────────────────────────────────────────────────────
-- Tablas base que el resto del repo asumía existentes pero ningún script creaba.
--
-- Contexto: el proyecto se armó originalmente en la plataforma v0 / el dashboard
-- de Supabase, y varias tablas quedaron creadas "a mano" sin capturarse como
-- migración. Como consecuencia, `02-runtime-migration.sql` referencia `vehiculos`
-- (ALTER TABLE) sin que ningún script la cree. Este archivo cierra ese hueco para
-- poder levantar el esquema desde cero de forma reproducible.
--
-- COMO CORRERLO:
--   1. Supabase Dashboard -> SQL Editor
--   2. Pegar este archivo completo y ejecutar
--   3. Es idempotente (CREATE TABLE IF NOT EXISTS + guards): correrlo sobre un
--      proyecto ya existente no rompe nada y no toca datos.
--
-- ORDEN RECOMENDADO en una base VACÍA:
--   00-tablas-base-faltantes.sql   <- este (tablas base + servicios/presupuestos/gastos)
--   02-runtime-migration.sql       <- columnas, secuencias, índices, plantillas
--   estados-servicio.sql + estados-servicio-color.sql
--   03..15 según corresponda
--
-- El esquema aquí refleja el estado real de producción (project ypoytphbshzvfuhhznjd)
-- al 2026-08-10. NO incluye RLS ni policies: la data de negocio se accede por
-- conexión directa a Postgres (service role), no vía PostgREST.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── user_roles (rol por usuario; leída vía Supabase, FK a auth.users) ────────
CREATE TABLE IF NOT EXISTS user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  role       TEXT NOT NULL CHECK (role = ANY (ARRAY['admin', 'supervisor', 'operador'])),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UNIQUE(user_id): necesario para el upsert con onConflict:"user_id" de /api/usuarios
-- (equivale a scripts/03-user-roles-unique.sql).
DO $$ BEGIN
  ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- FK a auth.users. Se envuelve en guard porque el esquema auth siempre existe en
-- Supabase, pero en otras instalaciones podría no estarlo.
DO $$ BEGIN
  ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL;
END $$;

-- ── clientes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  telefono   TEXT,
  email      TEXT,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── vehiculos (FK a clientes; patente_norm generada para lookups indexados) ──
CREATE TABLE IF NOT EXISTS vehiculos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patente               TEXT,
  marca                 TEXT,
  modelo                TEXT,
  color                 TEXT,
  "año"                 INTEGER,
  cliente_id            UUID,
  vin                   TEXT,
  mes_revision_tecnica  TEXT,
  patente_norm          TEXT GENERATED ALWAYS AS
    (UPPER(REGEXP_REPLACE(patente, '[^A-Za-z0-9]', '', 'g'))) STORED,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE vehiculos
    ADD CONSTRAINT vehiculos_cliente_id_fkey FOREIGN KEY (cliente_id)
    REFERENCES clientes (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehiculos_cliente_id   ON vehiculos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_patente_norm ON vehiculos(patente_norm);

-- ── empleados ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empleados (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  rut          TEXT,
  cargo        TEXT,
  sueldo_base  NUMERIC DEFAULT 0,
  activo       BOOLEAN DEFAULT TRUE,
  fecha_egreso TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── abonos_empleados (adelantos de sueldo; FK a empleados) ───────────────────
CREATE TABLE IF NOT EXISTS abonos_empleados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id     UUID,
  empleado_nombre TEXT,
  empleado_cargo  TEXT,
  mes             INTEGER,
  "año"           INTEGER,
  monto           NUMERIC DEFAULT 0,
  fecha           TEXT,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE abonos_empleados
    ADD CONSTRAINT abonos_empleados_empleado_id_fkey FOREIGN KEY (empleado_id)
    REFERENCES empleados (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_abonos_empleados_empleado_id ON abonos_empleados(empleado_id);

-- ── proveedores ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  rut        VARCHAR,
  telefono   VARCHAR,
  email      VARCHAR,
  categoria  TEXT,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── precios_pintura (config de precios de pintura; fila única de parámetros) ─
CREATE TABLE IF NOT EXISTS precios_pintura (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precio_por_pieza  NUMERIC DEFAULT 0,
  mano_obra_default NUMERIC NOT NULL DEFAULT 0,
  materiales_default NUMERIC NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── piezas_pintura (catálogo de piezas; nombre único) ────────────────────────
CREATE TABLE IF NOT EXISTS piezas_pintura (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  cantidad_piezas NUMERIC DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE piezas_pintura ADD CONSTRAINT piezas_pintura_nombre_key UNIQUE (nombre);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
