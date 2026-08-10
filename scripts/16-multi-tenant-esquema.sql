-- ============================================================================
-- 16-multi-tenant-esquema.sql — Camino B: convertir TallerPro en multi-taller
-- ============================================================================
--
-- QUÉ HACE
--   Agrega el concepto de "taller" (tenant) a la base: una tabla `talleres`,
--   un mapeo usuario→taller (`taller_usuarios`) y una columna `taller_id` en
--   cada tabla de negocio, para que una sola base sirva a muchos talleres,
--   cada uno viendo únicamente sus datos.
--
-- CÓMO CORRERLO
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y ejecutar el PASO 1 (es idempotente: se puede correr varias veces).
--   3. El PASO 2 (NOT NULL + FK) se corre DESPUÉS de desplegar la app ya
--      "scopeada" — cuando toda escritura ya setea taller_id. Antes rompería.
--   4. El PASO 3 (RLS) es opcional y solo aplica si se usa un rol de BD que
--      respete RLS. Leer la nota antes de activarlo.
--
-- IMPORTANTE: este script es ADITIVO. Con taller_id NULLABLE y el backfill al
-- taller principal, la app actual sigue funcionando igual mientras se migra
-- el código consulta por consulta. Ver docs/camino-b-multi-tenant.md.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 1 · Aditivo (no rompe nada)
-- ─────────────────────────────────────────────────────────────────────────

-- 1.1 Registro de talleres (tenants) ---------------------------------------
CREATE TABLE IF NOT EXISTS talleres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE,                          -- para subdominio/URL futura (opcional)

  -- Branding que hoy está fijo en el código (PDFs: orden, presupuesto, recibo)
  logo_url TEXT,
  rut TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,

  -- Config regional que hoy está hardcodeada (IVA 19% y timezone Chile)
  iva_porcentaje INTEGER NOT NULL DEFAULT 19,
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',

  -- Suscripción / cobro
  plan TEXT NOT NULL DEFAULT 'pro',          -- basico | pro | grande
  suscripcion_estado TEXT NOT NULL DEFAULT 'activa',  -- activa | prueba | vencida | suspendida
  suscripcion_vence DATE,

  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Mapeo usuario → taller (extiende user_roles) -------------------------
-- Un usuario pertenece a un taller y tiene un rol dentro de él. De momento un
-- usuario = un taller (PK sobre user_id). Si en el futuro alguien administra
-- varios talleres, esto pasa a PK compuesta (user_id, taller_id).
CREATE TABLE IF NOT EXISTS taller_usuarios (
  user_id   UUID PRIMARY KEY,                -- auth.users.id (Supabase Auth)
  taller_id UUID NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  rol       TEXT NOT NULL DEFAULT 'operador',-- admin | supervisor | operador
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_taller_usuarios_taller ON taller_usuarios(taller_id);

-- 1.3 Columna taller_id en cada tabla de negocio (NULLABLE por ahora) -------
ALTER TABLE servicios               ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE presupuestos            ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE gastos                  ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE empleados               ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE abonos_empleados        ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE estados_servicio        ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE precios_pintura         ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE piezas_pintura          ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE clientes                ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE vehiculos               ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE proveedores             ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE gastos_fijos_plantillas ADD COLUMN IF NOT EXISTS taller_id UUID;
ALTER TABLE plantillas_servicio     ADD COLUMN IF NOT EXISTS taller_id UUID;
-- Si existen estas tablas en tu instancia, descomenta:
-- ALTER TABLE solicitudes          ADD COLUMN IF NOT EXISTS taller_id UUID;

-- 1.4 Índices compuestos (taller_id primero) para las rutas calientes ------
-- El filtro por taller_id va a estar en CASI todas las consultas, así que
-- debe ser la primera columna del índice.
CREATE INDEX IF NOT EXISTS idx_servicios_taller_fecha   ON servicios(taller_id, fecha_ingreso DESC);
CREATE INDEX IF NOT EXISTS idx_servicios_taller_estado  ON servicios(taller_id, estado);
CREATE INDEX IF NOT EXISTS idx_servicios_taller_patente ON servicios(taller_id, patente_norm);
CREATE INDEX IF NOT EXISTS idx_presupuestos_taller      ON presupuestos(taller_id, fecha_ingreso DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_taller_fecha      ON gastos(taller_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_taller          ON clientes(taller_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_taller_patente ON vehiculos(taller_id, patente_norm);
CREATE INDEX IF NOT EXISTS idx_empleados_taller         ON empleados(taller_id);
CREATE INDEX IF NOT EXISTS idx_estados_servicio_taller  ON estados_servicio(taller_id);

-- 1.5 Sembrar el taller principal y asignarle TODO lo existente ------------
-- Tu taller actual pasa a ser el primer registro. Todas las filas actuales
-- (sin taller_id) se le asignan.
INSERT INTO talleres (nombre, slug)
SELECT 'Taller principal', 'principal'
WHERE NOT EXISTS (SELECT 1 FROM talleres);

DO $$
DECLARE
  v_taller UUID := (SELECT id FROM talleres ORDER BY created_at LIMIT 1);
BEGIN
  UPDATE servicios               SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE presupuestos            SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE gastos                  SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE empleados               SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE abonos_empleados        SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE estados_servicio        SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE precios_pintura         SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE piezas_pintura          SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE clientes                SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE vehiculos               SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE proveedores             SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE gastos_fijos_plantillas SET taller_id = v_taller WHERE taller_id IS NULL;
  UPDATE plantillas_servicio     SET taller_id = v_taller WHERE taller_id IS NULL;

  -- Migrar los roles actuales al nuevo mapeo, asignándolos al taller principal.
  INSERT INTO taller_usuarios (user_id, taller_id, rol)
  SELECT ur.user_id, v_taller, ur.role
  FROM user_roles ur
  ON CONFLICT (user_id) DO NOTHING;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 2 · Endurecer (correr DESPUÉS de desplegar la app scopeada)
-- ─────────────────────────────────────────────────────────────────────────
-- Cuando toda escritura ya setea taller_id, hacer la columna obligatoria y
-- añadir la clave foránea. Esto es la garantía a nivel de BD de que ninguna
-- fila queda "huérfana" sin dueño. Correr una tabla a la vez, verificando.
--
-- ALTER TABLE servicios        ALTER COLUMN taller_id SET NOT NULL;
-- ALTER TABLE servicios        ADD CONSTRAINT fk_servicios_taller
--   FOREIGN KEY (taller_id) REFERENCES talleres(id) ON DELETE CASCADE;
-- ...(repetir para cada tabla)...
--
-- Además, los índices/constraints UNIQUE que hoy son globales deben pasar a
-- ser únicos POR TALLER. Ejemplos a revisar:
--   • estados_servicio: nombre único → UNIQUE (taller_id, nombre)
--   • piezas_pintura   (scripts/05): UNIQUE → incluir taller_id
--   • user_roles       : reemplazado por taller_usuarios
-- Recrear cada uno como UNIQUE (taller_id, <columna>).


-- ─────────────────────────────────────────────────────────────────────────
-- PASO 3 · RLS como segunda barrera (OPCIONAL — leer con atención)
-- ─────────────────────────────────────────────────────────────────────────
-- OJO: la app se conecta con postgres.js usando un rol privilegiado a través
-- del pooler. Ese rol IGNORA las políticas RLS (bypass), así que una RLS
-- basada en auth.uid() NO protege nada en esta arquitectura. Por eso la
-- barrera PRINCIPAL es el filtro por taller_id en la capa de aplicación
-- (ver el helper `withTaller` en el diseño), aplicado sin excepción.
--
-- Si más adelante se quiere RLS como red de seguridad real, hay que:
--   1. Conectar con un rol que NO haga bypass de RLS.
--   2. Al inicio de cada transacción, fijar el taller de la sesión:
--        SET LOCAL app.current_taller = '<uuid>';
--   3. Definir políticas que lean esa variable:
--
--   ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY taller_aislamiento ON servicios
--     USING (taller_id = current_setting('app.current_taller', true)::uuid);
--
-- Mientras tanto, el aislamiento vive 100% en la aplicación. Es imprescindible
-- auditarlo (ver checklist de verificación en el documento de diseño).
-- ============================================================================
