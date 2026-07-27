-- ============================================================================
-- 14 · Guard rails de los campos de pago de `servicios`
-- ============================================================================
--
-- *** ORDEN CRÍTICO ***
-- Correr DESPUÉS de:
--   1. desplegar el código que deriva anticipo/saldo en el servidor
--      (lib/pagos.ts + lib/database.ts), y
--   2. scripts/13-reconciliar-abonos-anticipo.sql.
-- Con `servicios_saldo_derivado` activa, cualquier camino que escriba
-- `monto_total` sin recalcular el saldo falla con SQLSTATE 23514. Los tres
-- caminos de escritura (createServicio, updateServicio,
-- convertPresupuestoToServicio) quedan correctos recién con (1).
--
-- POR QUÉ CONSTRAINTS Y NO UN TRIGGER
-- Un trigger que recalculara las columnas haría la invariante irrompible incluso
-- desde psql, pero duplicaría la lógica de negocio en otro lenguaje y
-- sobrescribiría en silencio lo que manda la app — el mismo modo de falla
-- (corrupción silenciosa) que este trabajo vino a eliminar. Una CHECK falla
-- ruidosamente, que es lo que se quiere.
--
-- POR QUÉ NO UNA COLUMNA GENERADA PARA `anticipo`
-- `anticipo GENERATED ALWAYS AS (servicios_abonos_total(abonos)) STORED` sería
-- la garantía más fuerte, pero rompe cualquier INSERT/UPDATE que nombre la
-- columna. Vale la pena reconsiderarlo cuando la app lleve tiempo escribiendo
-- valores consistentes.
--
-- POR QUÉ NO SE CONSTRAINEA "estado cerrado ⇒ saldo 0"
-- Con `servicios_saldo_derivado` el saldo es derivado, así que esa regla se
-- reduce a "los abonos deben cubrir el total", que la app garantiza al escribir
-- (lib/pagos.ts). Como constraint rechazaría una operación legítima — subirle el
-- monto a un servicio ya cerrado — con un error opaco. Para eso están la query
-- de auditoría de scripts/13 y el badge "Revisar pagos" del listado.
--
-- Idempotente: los ALTER usan IF EXISTS / chequeo en pg_constraint.
-- ============================================================================


-- ─── PASO 1 · Tipos de columna ──────────────────────────────────────────────
-- Las columnas en producción son `numeric` SIN precisión, aunque
-- scripts/01-create-tables.sql las declara DECIMAL(12,0). Por eso Postgres no
-- redondea al escribir y un residuo de punto flotante (0.9999999) sobrevive, se
-- muestra como "$1", mantiene el servicio en toda query de `saldo_pendiente > 0`
-- para siempre y bloquea el auto-cierre por `saldo <= 0`.
--
-- ⚠ Reescribe la tabla bajo ACCESS EXCLUSIVE (segundos con este volumen) y
--   REDONDEA en silencio cualquier fracción existente: correr antes la query A2
--   de scripts/13. numeric(12,0) tope 999.999.999.999 CLP, muy por encima de
--   cualquier monto real.
ALTER TABLE servicios
  ALTER COLUMN monto_total         TYPE numeric(12, 0),
  ALTER COLUMN monto_total_sin_iva TYPE numeric(12, 0),
  ALTER COLUMN anticipo            TYPE numeric(12, 0),
  ALTER COLUMN saldo_pendiente     TYPE numeric(12, 0),
  ALTER COLUMN mano_obra_pintura   TYPE numeric(12, 0);


-- ─── PASO 2 · Helper inmutable ──────────────────────────────────────────────
-- Una CHECK no admite subconsultas y jsonb_array_elements retorna un conjunto:
-- encapsularlo en una función IMMUTABLE es el rodeo. NO se declara STRICT: con
-- entrada NULL devolvería NULL y la CHECK pasaría en silencio.
-- El round() interno permite convivir con un abono fraccionario insertado a mano.
--
-- ⚠ Si esta función se reemplaza, hay que re-VALIDATE las constraints: Postgres
--   no revalida las filas existentes ante un CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION servicios_abonos_total(j jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT round(COALESCE((
    SELECT SUM((a->>'monto')::numeric)
    FROM jsonb_array_elements(COALESCE(j, '[]'::jsonb)) a
    WHERE jsonb_typeof(a->'monto') = 'number'
  ), 0))
$$;


-- ─── PASO 3 · Constraints ───────────────────────────────────────────────────
-- Se agregan NOT VALID (barato, SHARE UPDATE EXCLUSIVE) y se validan aparte, así
-- una falla se ve sin bloquear la tabla.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'servicios'::regclass AND conname = 'servicios_abonos_es_array') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_abonos_es_array
      CHECK (abonos IS NULL OR jsonb_typeof(abonos) = 'array') NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'servicios'::regclass AND conname = 'servicios_montos_no_negativos') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_montos_no_negativos
      CHECK (COALESCE(monto_total, 0) >= 0
         AND COALESCE(monto_total_sin_iva, 0) >= 0
         AND COALESCE(anticipo, 0) >= 0
         AND COALESCE(saldo_pendiente, 0) >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'servicios'::regclass AND conname = 'servicios_anticipo_es_suma_abonos') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_anticipo_es_suma_abonos
      CHECK (COALESCE(anticipo, 0) = servicios_abonos_total(abonos)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'servicios'::regclass AND conname = 'servicios_saldo_derivado') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_saldo_derivado
      CHECK (COALESCE(saldo_pendiente, 0)
             = GREATEST(0, COALESCE(monto_total, 0) - COALESCE(anticipo, 0))) NOT VALID;
  END IF;
END $$;

ALTER TABLE servicios VALIDATE CONSTRAINT servicios_abonos_es_array;
ALTER TABLE servicios VALIDATE CONSTRAINT servicios_montos_no_negativos;
ALTER TABLE servicios VALIDATE CONSTRAINT servicios_anticipo_es_suma_abonos;
ALTER TABLE servicios VALIDATE CONSTRAINT servicios_saldo_derivado;


-- ─── Verificación ───────────────────────────────────────────────────────────
-- Las cuatro deben aparecer con convalidated = true.
SELECT conname, convalidated
FROM pg_constraint
WHERE conrelid = 'servicios'::regclass AND contype = 'c'
ORDER BY conname;

-- Tipos: precision 12, scale 0 en las cinco columnas.
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'servicios'
  AND column_name IN ('monto_total', 'monto_total_sin_iva', 'anticipo',
                      'saldo_pendiente', 'mano_obra_pintura')
ORDER BY column_name;
