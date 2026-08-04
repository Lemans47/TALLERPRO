-- 15-empleados-fecha-egreso.sql
-- Registra la fecha de egreso de un empleado para que la desactivación no lo borre
-- retroactivamente de los meses pasados en que sí estuvo activo.
--
-- Contexto: los empleados no tenían alcance por mes. El flag `activo` es un estado
-- ACTUAL que se aplicaba a todos los meses, así que desactivar a alguien lo hacía
-- desaparecer también de los meses en que trabajó. El ingreso se deriva de `created_at`;
-- el egreso necesita esta columna.
--
-- Idempotente. Correr manualmente en el SQL Editor de Supabase.

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_egreso timestamptz;

-- Backfill best-effort: para los empleados ya inactivos no conocemos su fecha real de
-- egreso, así que usamos `now()`. Con esto siguen contando como activos en los meses
-- pasados y dejan de devengar de aquí en adelante. Solo toca filas sin fecha para no
-- pisar backfills previos (idempotencia).
UPDATE empleados
SET fecha_egreso = now()
WHERE activo = false
  AND fecha_egreso IS NULL;
