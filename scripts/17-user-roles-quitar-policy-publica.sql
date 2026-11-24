-- 17-user-roles-quitar-policy-publica.sql
--
-- La policy "Service can read all roles" (USING true, rol public) permitía que
-- cualquiera con la anon key —incluso sin sesión— leyera TODAS las filas de
-- user_roles (qué usuarios existen y quién es admin).
--
-- Nada depende de ella:
--   - El navegador (lib/auth-context.tsx) solo lee el rol del propio usuario,
--     cubierto por "Users can read own role".
--   - app/api/usuarios usa la service role key, que salta RLS.
--   - requireRole() (lib/auth-server.ts) lee por la conexión directa a Postgres.
--
-- Idempotente. Correr en Supabase SQL Editor.

DROP POLICY IF EXISTS "Service can read all roles" ON public.user_roles;

-- Verificación: debe quedar solo "Users can read own role" para SELECT.
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'user_roles';
