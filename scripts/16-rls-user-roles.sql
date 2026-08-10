-- ─────────────────────────────────────────────────────────────────────────────
-- RLS y policies de lectura para user_roles.
--
-- Por qué importa (y por qué SOLO esta tabla): la data de negocio se accede por
-- conexión directa a Postgres con la service role, que BYPASSA RLS — por eso las
-- policies de servicios/gastos/etc. no hacen falta en el repo. En cambio
-- `user_roles` se lee desde el cliente Supabase (PostgREST) en `lib/auth-context.tsx`
-- y `lib/auth-server.ts`, así que sus policies sí determinan qué puede leer el
-- navegador. Estas policies vivían solo en prod (creadas a mano); acá se capturan.
--
-- COMO CORRERLO:
--   Supabase Dashboard -> SQL Editor -> pegar y ejecutar. Idempotente
--   (DROP POLICY IF EXISTS + CREATE POLICY). Requiere que user_roles exista
--   (la crea 00-tablas-base-faltantes.sql).
--
-- Refleja el estado real de prod (project ypoytphbshzvfuhhznjd) al 2026-08-10.
--
-- ⚠ Nota de seguridad: la policy "Service can read all roles" usa USING (true),
--   por lo que cualquier cliente con la anon key puede leer TODA la tabla de roles
--   vía PostgREST. Se replica tal cual está en producción. Endurecerla (p. ej.
--   restringirla a service_role) sería un cambio de comportamiento aparte, fuera
--   del alcance de este script (que solo busca reproducir el estado actual).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede leer su propia fila de rol.
DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
CREATE POLICY "Users can read own role" ON user_roles
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Lectura amplia (ver nota de seguridad arriba). Las escrituras las hace
-- /api/usuarios con la service role key, que bypassa RLS: por eso no hay
-- policies de INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "Service can read all roles" ON user_roles;
CREATE POLICY "Service can read all roles" ON user_roles
  FOR SELECT USING (true);
