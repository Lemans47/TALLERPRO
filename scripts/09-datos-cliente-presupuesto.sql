-- Campos de cliente que existen en el formato de presupuesto (PDF) pero que
-- hasta ahora no se capturaban en el formulario de ingreso de servicio /
-- presupuesto: atención, R.U.T., domicilio y comuna.
--
-- Se guardan denormalizados en servicios y presupuestos (igual que cliente y
-- telefono) para que el PDF de presupuesto pueda imprimirlos.
--
-- Idempotente: se puede correr varias veces sin romper nada.

ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS atencion  TEXT,
  ADD COLUMN IF NOT EXISTS rut       TEXT,
  ADD COLUMN IF NOT EXISTS domicilio TEXT,
  ADD COLUMN IF NOT EXISTS comuna    TEXT;

ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS atencion  TEXT,
  ADD COLUMN IF NOT EXISTS rut       TEXT,
  ADD COLUMN IF NOT EXISTS domicilio TEXT,
  ADD COLUMN IF NOT EXISTS comuna    TEXT;
