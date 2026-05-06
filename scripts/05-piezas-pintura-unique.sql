-- Deduplica piezas_pintura por nombre (case-insensitive trim) y agrega
-- UNIQUE constraint para prevenir futuros duplicados.
--
-- Por qué: la tabla nunca tuvo UNIQUE en `nombre`, así que con el tiempo
-- se acumularon registros con el mismo nombre (ej: "ZOCALO DERECHO" x2).
-- Eso rompía el formulario de servicio (React duplicate-key warning) y
-- podía duplicar selecciones.
--
-- COMO CORRERLO:
--   Pegar este archivo en Supabase SQL Editor y ejecutar. Idempotente.

-- 1. Deduplicar: para cada nombre normalizado (UPPER + TRIM), conservar el
--    registro más antiguo (menor created_at) y borrar los demás.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY UPPER(TRIM(nombre))
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM piezas_pintura
)
DELETE FROM piezas_pintura
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Normalizar los nombres restantes (TRIM solamente, no toco mayúsculas
--    para preservar lo que el usuario tipeó originalmente).
UPDATE piezas_pintura
SET nombre = TRIM(nombre)
WHERE nombre <> TRIM(nombre);

-- 3. Agregar UNIQUE constraint si no existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'piezas_pintura_nombre_unique'
  ) THEN
    ALTER TABLE piezas_pintura
      ADD CONSTRAINT piezas_pintura_nombre_unique UNIQUE (nombre);
  END IF;
END $$;
