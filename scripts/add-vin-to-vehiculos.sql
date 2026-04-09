-- Agrega el campo VIN (número de chasis) a la tabla vehiculos
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS vin TEXT;
