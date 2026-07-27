-- ============================================================================
-- 13 · Reconciliar `abonos` con `anticipo` / `saldo_pendiente`
-- ============================================================================
--
-- QUÉ ERA EL BUG
-- La invariante de pagos de un servicio:
--     anticipo        = Σ abonos[].monto
--     saldo_pendiente = max(0, monto_total − anticipo)
--     estado cerrado  ⇒ saldo_pendiente = 0
-- se mantenía SÓLO en el navegador, en dos lugares que divergían:
--   · components/services-table.tsx (dropdown de estado) escribía
--     `anticipo = monto_total, saldo_pendiente = 0` sin tocar `abonos`;
--   · components/service-form.tsx sólo agregaba el abono por la diferencia en la
--     transición no-cerrado → cerrado.
-- Resultado: al reabrir en el formulario un servicio cerrado desde la tabla, el
-- anticipo se recalculaba desde el historial viejo y la deuda revivía, dejando
-- un "Cerrado/Pagado" con saldo > 0 — invisible en la alerta del dashboard, en
-- /reportes → Cuentas por Cobrar y en el bot de Telegram (todos filtraban por
-- estado `por_cobrar`), pero contabilizado como ingreso cobrado.
--
-- *** ORDEN CRÍTICO ***
-- Este script va DESPUÉS de desplegar el código que deriva anticipo/saldo en el
-- servidor (lib/pagos.ts + lib/database.ts). Si se corre antes, el código viejo
-- vuelve a romper las filas en el próximo guardado. Misma lección que scripts/11.
--
-- DECISIÓN DEL DUEÑO (2026-07): los servicios descuadrados están TODOS pagados.
-- El `anticipo` es el dato bueno y lo que faltaba era registrar el abono; por eso
-- la Sección B genera el abono faltante y no revive ninguna deuda. Es además lo
-- mismo que hace el código nuevo si alguien toca una de esas filas antes de que
-- este script corra, así que ambos caminos convergen (de hecho la OT 67 ya se
-- reparó sola por esa vía entre el diagnóstico y este script).
--
-- Idempotente: re-ejecutarlo no cambia nada (la Sección B sólo actúa si
-- anticipo > Σ abonos, y la C usa guards IS DISTINCT FROM).
-- No toca `updated_at`: no hay trigger, la app lo setea explícitamente.
-- ============================================================================


-- ─── SECCIÓN A · Diagnóstico ANTES (guardar el resultado) ───────────────────

-- A1. Filas que violan la invariante. Esperado al 2026-07-27: 7 filas
--     (OT 96, 91, 88, 134, 92, 49, 83), todas `anticipo > Σ abonos`.
SELECT s.numero_ot, s.patente, s.cliente, s.estado,
       s.monto_total, s.anticipo, s.saldo_pendiente,
       ab.suma                                     AS suma_abonos,
       s.anticipo - ab.suma                        AS diff_anticipo,
       s.saldo_pendiente - GREATEST(0, s.monto_total - s.anticipo) AS diff_saldo,
       COALESCE(s.fecha_entregado, s.updated_at::date, s.fecha_ingreso::date) AS fecha_candidata
FROM servicios s
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM((a->>'monto')::numeric), 0) AS suma
  FROM jsonb_array_elements(COALESCE(s.abonos, '[]'::jsonb)) a
  WHERE jsonb_typeof(a->'monto') = 'number'
) ab
WHERE s.anticipo IS DISTINCT FROM ab.suma
   OR s.saldo_pendiente IS DISTINCT FROM GREATEST(0, s.monto_total - s.anticipo)
ORDER BY abs(s.anticipo - ab.suma) DESC;

-- A2. Montos con decimales (la Sección C los va a redondear).
SELECT numero_ot, patente, monto_total, monto_total_sin_iva, anticipo, saldo_pendiente
FROM servicios
WHERE monto_total <> trunc(monto_total)
   OR monto_total_sin_iva <> trunc(monto_total_sin_iva)
   OR anticipo <> trunc(anticipo)
   OR saldo_pendiente <> trunc(saldo_pendiente);

-- A3. Decimales dentro del JSONB (ej. precio = 125999.99999999999 por
--     90000 * 1.4 en punto flotante).
SELECT s.numero_ot, 'PIEZA' AS tipo, p->>'nombre' AS detalle, p->>'precio' AS valor
FROM servicios s, jsonb_array_elements(COALESCE(s.piezas_pintura, '[]'::jsonb)) p
WHERE jsonb_typeof(p->'precio') = 'number'
  AND (p->>'precio')::numeric <> round((p->>'precio')::numeric)
UNION ALL
SELECT s.numero_ot, 'ABONO', a->>'fecha', a->>'monto'
FROM servicios s, jsonb_array_elements(COALESCE(s.abonos, '[]'::jsonb)) a
WHERE jsonb_typeof(a->'monto') = 'number'
  AND (a->>'monto')::numeric <> round((a->>'monto')::numeric);

-- A4. Baseline de los totales de cobranza. La diferencia entre ambos es lo que
--     aparecería en pantalla si se despliega el filtro nuevo antes que este
--     script (getServiciosPendientesCobro ahora incluye `cerrado`).
SELECT 'filtro viejo (solo por_cobrar)' AS filtro, COUNT(*) AS n, COALESCE(SUM(saldo_pendiente), 0) AS total
FROM servicios
WHERE saldo_pendiente > 0
  AND estado IN (SELECT nombre FROM estados_servicio WHERE tipo = 'por_cobrar')
UNION ALL
SELECT 'filtro nuevo (por_cobrar + cerrado)', COUNT(*), COALESCE(SUM(saldo_pendiente), 0)
FROM servicios
WHERE saldo_pendiente > 0
  AND estado IN (SELECT nombre FROM estados_servicio WHERE tipo IN ('por_cobrar', 'cerrado'));


-- ─── SECCIÓN B · Reparación ─────────────────────────────────────────────────
BEGIN;

-- B1. anticipo > Σ abonos  →  el trabajo está pagado y falta el registro del
--     abono. Se agrega uno por la diferencia, fechado en la entrega (o, si falta,
--     en la última modificación / el ingreso), marcado `auto` como los que genera
--     el cierre automático desde la app.
WITH calc AS (
  SELECT s.id,
         s.anticipo,
         COALESCE((
           SELECT SUM((a->>'monto')::numeric)
           FROM jsonb_array_elements(COALESCE(s.abonos, '[]'::jsonb)) a
           WHERE jsonb_typeof(a->'monto') = 'number'
         ), 0) AS suma,
         COALESCE(s.fecha_entregado, s.updated_at::date, s.fecha_ingreso::date) AS fecha_abono
  FROM servicios s
)
UPDATE servicios s
SET abonos = COALESCE(s.abonos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'fecha', c.fecha_abono::text,
      'monto', round(c.anticipo - c.suma),
      'auto',  true))
FROM calc c
WHERE c.id = s.id
  AND round(c.anticipo - c.suma) > 0;

-- B2. anticipo < Σ abonos  →  se registró un abono sin actualizar el anticipo.
--     Siempre gana el historial: no se puede des-recibir plata.
--     (La Sección C recalcula el anticipo desde los abonos, así que esto queda
--     cubierto ahí; se deja documentado para que la regla sea explícita.)

COMMIT;


-- ─── SECCIÓN C · Normalización ──────────────────────────────────────────────
BEGIN;

-- C1. Redondear los montos dentro de `abonos`. El EXISTS evita que jsonb_agg
--     convierta un array vacío en NULL.
UPDATE servicios s
SET abonos = (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(a->'monto') = 'number'
         THEN jsonb_set(a, '{monto}', to_jsonb(round((a->>'monto')::numeric)))
         ELSE a END
  )
  FROM jsonb_array_elements(s.abonos) a
)
WHERE jsonb_typeof(s.abonos) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(s.abonos) a
    WHERE jsonb_typeof(a->'monto') = 'number'
      AND (a->>'monto')::numeric <> round((a->>'monto')::numeric)
  );

-- C2. Redondear `piezas_pintura[].precio`. NO se toca `cantidad`: las medias
--     piezas (0.5, 1.4...) son legítimas del catálogo.
UPDATE servicios s
SET piezas_pintura = (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(p->'precio') = 'number'
         THEN jsonb_set(p, '{precio}', to_jsonb(round((p->>'precio')::numeric)))
         ELSE p END
  )
  FROM jsonb_array_elements(s.piezas_pintura) p
)
WHERE jsonb_typeof(s.piezas_pintura) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(s.piezas_pintura) p
    WHERE jsonb_typeof(p->'precio') = 'number'
      AND (p->>'precio')::numeric <> round((p->>'precio')::numeric)
  );

-- C3. Derivar anticipo y saldo desde el historial ya reparado, y redondear los
--     montos totales.
WITH calc AS (
  SELECT s.id,
         round(COALESCE((
           SELECT SUM((a->>'monto')::numeric)
           FROM jsonb_array_elements(COALESCE(s.abonos, '[]'::jsonb)) a
           WHERE jsonb_typeof(a->'monto') = 'number'
         ), 0)) AS anticipo_nuevo,
         round(s.monto_total) AS total_nuevo
  FROM servicios s
)
UPDATE servicios s
SET anticipo            = c.anticipo_nuevo,
    monto_total         = c.total_nuevo,
    monto_total_sin_iva = round(s.monto_total_sin_iva),
    saldo_pendiente     = GREATEST(0, c.total_nuevo - c.anticipo_nuevo)
FROM calc c
WHERE c.id = s.id
  AND (s.anticipo            IS DISTINCT FROM c.anticipo_nuevo
    OR s.monto_total         IS DISTINCT FROM c.total_nuevo
    OR s.monto_total_sin_iva IS DISTINCT FROM round(s.monto_total_sin_iva)
    OR s.saldo_pendiente     IS DISTINCT FROM GREATEST(0, c.total_nuevo - c.anticipo_nuevo));

COMMIT;


-- ─── SECCIÓN D · Verificación DESPUÉS ───────────────────────────────────────

-- D1. La query A1 debe devolver 0 filas.
SELECT COUNT(*) AS filas_inconsistentes
FROM servicios s
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM((a->>'monto')::numeric), 0) AS suma
  FROM jsonb_array_elements(COALESCE(s.abonos, '[]'::jsonb)) a
  WHERE jsonb_typeof(a->'monto') = 'number'
) ab
WHERE s.anticipo IS DISTINCT FROM ab.suma
   OR s.saldo_pendiente IS DISTINCT FROM GREATEST(0, s.monto_total - s.anticipo);

-- D2. Cerrados con deuda: debe dar 0 filas.
SELECT numero_ot, patente, cliente, estado, monto_total, anticipo, saldo_pendiente
FROM servicios
WHERE saldo_pendiente > 0
  AND estado IN (SELECT nombre FROM estados_servicio WHERE tipo = 'cerrado');

-- D3. Entregados ya pagados que quedaron sin cerrar (no cuentan como ingreso
--     cobrado). El código nuevo los cierra solo al próximo abono; si aparecen
--     acá, cerrarlos desde la app.
SELECT numero_ot, patente, cliente, estado, monto_total, anticipo
FROM servicios
WHERE monto_total > 0 AND saldo_pendiente = 0
  AND estado IN (SELECT nombre FROM estados_servicio WHERE tipo = 'por_cobrar');

-- NOTA: el dashboard cachea resultados 30s (global._dashboardCache).
-- Apretar "Actualizar" o esperar medio minuto antes de revisar las cifras.
