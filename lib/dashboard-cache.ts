// Caché en memoria del dashboard, guardada en una variable global del proceso
// para sobrevivir el hot-reload de Next en dev. Se extrae aquí (en vez de vivir
// dentro de la ruta /api/dashboard) para poder INVALIDARLA desde las rutas de
// mutación (servicios, gastos, empleados, abonos), y que el dashboard no muestre
// cifras viejas durante hasta 30s después de crear/editar/borrar.
declare global {
  // eslint-disable-next-line no-var
  var _dashboardCache: Map<string, { value: unknown; expires: number; inFlight?: Promise<unknown> }> | undefined
}

export function getDashboardCache() {
  if (!global._dashboardCache) global._dashboardCache = new Map()
  return global._dashboardCache
}

/** Vacía la caché del dashboard. Llamar tras cualquier mutación que afecte sus KPIs. */
export function invalidateDashboardCache() {
  global._dashboardCache?.clear()
}
