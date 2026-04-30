-- Eliminar duplicados existentes (si los hubiera), conservando la fila más reciente por user_id
DELETE FROM user_roles a
USING user_roles b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id;

-- Agregar constraint UNIQUE sobre user_id para que el upsert con onConflict: "user_id" funcione
ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
