-- ─────────────────────────────────────────────────────────────────────────────
-- Columnas de las tablas core (servicios / presupuestos / gastos) que existen en
-- producción pero que ningún script del repo creaba.
--
-- Contexto: `01-create-tables.sql` creó una versión temprana de estas tablas y las
-- migraciones incrementales (02, 04, 06-09, ...) fueron agregando columnas, pero
-- algunas se añadieron a mano en prod (vía v0/dashboard) sin capturarse. Este
-- script cierra ese hueco para que el esquema desde cero coincida con producción.
--
-- COMO CORRERLO:
--   Supabase Dashboard -> SQL Editor -> pegar y ejecutar. Idempotente y NO
--   destructivo (ADD COLUMN IF NOT EXISTS). Sobre un proyecto que ya las tenga es
--   un no-op y no toca datos. DEBE correr DESPUÉS de 01-create-tables.sql.
--
-- Tipos/defaults verificados contra prod (project ypoytphbshzvfuhhznjd, 2026-08-10).
--
-- Fuera de alcance (drift cosmético, se documenta pero NO se corrige): las columnas
-- de montos que 01 creó como DECIMAL(12,0) figuran en prod como `numeric` sin
-- precisión, y el default de `iva` es 'sin' en 01 vs 'sin_iva' en prod. No afecta
-- el comportamiento (los montos se redondean server-side; el `iva` lo escribe el
-- código como 'con'/'sin'). Cambiar tipos/defaults de columnas existentes queda
-- para otra tarea.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── servicios ────────────────────────────────────────────────────────────────
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS color             TEXT,
  ADD COLUMN IF NOT EXISTS kilometraje       NUMERIC,
  ADD COLUMN IF NOT EXISTS "año"             INTEGER,
  ADD COLUMN IF NOT EXISTS fotos_ingreso     JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fotos_entrega     JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS detalle_pendiente BOOLEAN NOT NULL DEFAULT FALSE;

-- ── presupuestos ─────────────────────────────────────────────────────────────
ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS color       TEXT,
  ADD COLUMN IF NOT EXISTS kilometraje NUMERIC,
  ADD COLUMN IF NOT EXISTS "año"       INTEGER;

-- ── gastos ───────────────────────────────────────────────────────────────────
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT TRUE;
