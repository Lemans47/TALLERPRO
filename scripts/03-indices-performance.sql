-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES DE PERFORMANCE
-- Ejecutar UNA VEZ en Supabase SQL Editor (https://app.supabase.com → SQL Editor).
--
-- Todos los índices usan IF NOT EXISTS, así que es seguro re-ejecutar el script.
-- Cada bloque tiene un comentario con la query que acelera y el motivo del diseño.
-- Después de ejecutar, las queries lentas (10-30s en cold cache) deberían bajar a 1-3s.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── A. SERVICIOS por fecha_ingreso ───────────────────────────────────────────
-- Acelera: getServiciosByMonth, getGastosByMonth (filtros BETWEEN startDate AND endDate)
-- Sin este índice, Postgres hace seq scan sobre toda la tabla cada mes.
CREATE INDEX IF NOT EXISTS idx_servicios_fecha_ingreso
  ON servicios (fecha_ingreso DESC);


-- ─── B. SERVICIOS por fecha_facturacion (criterio SII) ────────────────────────
-- Acelera: getServiciosFacturadosByMes (IVA débito por mes según fecha_facturacion).
-- Índice parcial: solo facturas con IVA. Reduce tamaño del índice y lo hace más eficiente.
CREATE INDEX IF NOT EXISTS idx_servicios_fecha_facturacion
  ON servicios (fecha_facturacion DESC)
  WHERE iva = 'con' AND fecha_facturacion IS NOT NULL;


-- ─── C. SERVICIOS facturas pendientes de emitir ───────────────────────────────
-- Acelera: getFacturasPendientesEmitir (iva='con' + sin fecha_facturacion + estados finalizados)
-- Índice parcial sobre la condición que dispara la alerta.
CREATE INDEX IF NOT EXISTS idx_servicios_facturas_pendientes
  ON servicios (estado, fecha_ingreso DESC)
  WHERE iva = 'con' AND fecha_facturacion IS NULL;


-- ─── D. SERVICIOS por saldo pendiente (cuentas por cobrar) ────────────────────
-- Acelera: getServiciosPendientesCobro (saldo_pendiente > 0 + estado = por_cobrar).
-- Índice parcial: solo registros con deuda pendiente.
CREATE INDEX IF NOT EXISTS idx_servicios_saldo_pendiente
  ON servicios (estado, fecha_ingreso ASC)
  WHERE saldo_pendiente > 0;


-- ─── E. SERVICIOS por estado + updated_at (entregados del mes) ────────────────
-- Acelera: getEntregadosByMonth (estado IN cerrado/por_cobrar + updated_at BETWEEN ?)
CREATE INDEX IF NOT EXISTS idx_servicios_estado_updated
  ON servicios (estado, updated_at DESC);


-- ─── F. SERVICIOS por estado (lista activos / filtros generales) ──────────────
-- Acelera: getActiveServicios, getServiciosActivosParaLista (estado IN ...).
-- Si ya existe se mantiene, IF NOT EXISTS evita duplicar.
CREATE INDEX IF NOT EXISTS idx_servicios_estado
  ON servicios (estado);


-- ─── G. GASTOS por categoría + fecha (chart histórico, desglose por mes) ──────
-- Acelera: chart route (suma agrupada por mes excluyendo Sueldos), getGastosByMonth.
CREATE INDEX IF NOT EXISTS idx_gastos_categoria_fecha
  ON gastos (categoria, fecha DESC);


-- ─── H. GASTOS pendientes de pago ─────────────────────────────────────────────
-- Acelera: getGastosPendientesPago (pagado = false). Índice parcial.
CREATE INDEX IF NOT EXISTS idx_gastos_pagado_falso
  ON gastos (fecha ASC)
  WHERE pagado = false;


-- ─── I. GASTOS por fecha (filtro mensual) ─────────────────────────────────────
-- Acelera: getGastosByMonth.
CREATE INDEX IF NOT EXISTS idx_gastos_fecha
  ON gastos (fecha DESC);


-- ─── J. ABONOS_EMPLEADOS por fecha (sueldos pagados del mes) ──────────────────
-- Acelera: getAbonosByMonth (BETWEEN startDate AND endDate por fecha).
CREATE INDEX IF NOT EXISTS idx_abonos_empleados_fecha
  ON abonos_empleados (fecha DESC);


-- ─── K. ABONOS_EMPLEADOS por empleado_id (deuda por empleado) ─────────────────
-- Acelera: alerts de sueldos atrasados (suma por empleado_id) y reportes históricos.
CREATE INDEX IF NOT EXISTS idx_abonos_empleados_empleado
  ON abonos_empleados (empleado_id, fecha DESC);


-- ─── L. ESTADOS_SERVICIO por tipo (lookup configurable) ───────────────────────
-- Acelera: getNombresEstadosByTipoMap (tipo IN cerrado/por_cobrar).
CREATE INDEX IF NOT EXISTS idx_estados_servicio_tipo
  ON estados_servicio (tipo);


-- ─── VERIFICAR que se crearon ─────────────────────────────────────────────────
-- Lista todos los índices creados en este script.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_servicios_%'
   OR indexname LIKE 'idx_gastos_%'
   OR indexname LIKE 'idx_abonos_empleados_%'
   OR indexname LIKE 'idx_estados_servicio_%'
ORDER BY tablename, indexname;


-- ─── ANALIZAR TABLAS (importante después de crear índices) ────────────────────
-- Refresca las estadísticas del planificador para que use los índices nuevos.
ANALYZE servicios;
ANALYZE gastos;
ANALYZE abonos_empleados;
ANALYZE estados_servicio;
