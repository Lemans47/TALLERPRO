import type { Servicio, Presupuesto, Gasto, PrecioPintura, PiezaPintura, FotoServicio } from "./database"

// Dashboard
export async function fetchDashboardData(
  year: number,
  month: number,
): Promise<{ servicios: Servicio[]; gastos: Gasto[] }> {
  const res = await fetch(`/api/dashboard?year=${year}&month=${month}`)
  if (!res.ok) throw new Error("Error fetching dashboard data")
  return res.json()
}

// Chart data
export async function fetchChartData(): Promise<{ servicios: Servicio[]; gastos: Gasto[] }> {
  const res = await fetch("/api/chart")
  if (!res.ok) throw new Error("Error fetching chart data")
  return res.json()
}

// Servicios
export async function fetchServicios(year?: number, month?: number): Promise<Servicio[]> {
  const params = year && month ? `?year=${year}&month=${month}` : ""
  const res = await fetch(`/api/servicios${params}`)
  if (!res.ok) throw new Error("Error fetching servicios")
  return res.json()
}

export async function createServicioApi(data: Partial<Servicio>): Promise<Servicio> {
  const res = await fetch("/api/servicios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Error creating servicio")
  return res.json()
}

export async function updateServicioApi(id: string, data: Partial<Servicio>): Promise<Servicio> {
  const res = await fetch("/api/servicios", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error("Error updating servicio")
  return res.json()
}

export async function deleteServicioApi(id: string): Promise<void> {
  const res = await fetch(`/api/servicios?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting servicio")
}

// Presupuestos
export async function fetchPresupuestos(year?: number, month?: number): Promise<Presupuesto[]> {
  const params = year && month ? `?year=${year}&month=${month}` : ""
  const res = await fetch(`/api/presupuestos${params}`)
  if (!res.ok) throw new Error("Error fetching presupuestos")
  return res.json()
}

export async function createPresupuestoApi(data: Partial<Presupuesto>): Promise<Presupuesto> {
  const res = await fetch("/api/presupuestos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Error creating presupuesto")
  return res.json()
}

export async function updatePresupuestoApi(id: string, data: Partial<Presupuesto>): Promise<Presupuesto> {
  const res = await fetch("/api/presupuestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error("Error updating presupuesto")
  return res.json()
}

export async function deletePresupuestoApi(id: string): Promise<void> {
  const res = await fetch(`/api/presupuestos?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting presupuesto")
}

export async function convertToServicioApi(id: string): Promise<any> {
  const res = await fetch(`/api/presupuestos?action=convert&id=${id}`)
  if (!res.ok) throw new Error("Error converting presupuesto")
  return res.json()
}

// Gastos
export async function fetchGastos(year?: number, month?: number): Promise<Gasto[]> {
  const params = year && month ? `?year=${year}&month=${month}` : ""
  const res = await fetch(`/api/gastos${params}`)
  if (!res.ok) throw new Error("Error fetching gastos")
  return res.json()
}

export async function createGastoApi(data: Partial<Gasto>): Promise<Gasto> {
  const res = await fetch("/api/gastos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Error creating gasto")
  return res.json()
}

export async function updateGastoApi(id: string, data: Partial<Gasto>): Promise<Gasto> {
  const res = await fetch("/api/gastos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  if (!res.ok) throw new Error("Error updating gasto")
  return res.json()
}

export async function deleteGastoApi(id: string): Promise<void> {
  const res = await fetch(`/api/gastos?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting gasto")
}

// Precios Pintura - Solo el precio global
export async function fetchPrecioPintura(): Promise<PrecioPintura | null> {
  const res = await fetch("/api/precios-pintura")
  if (!res.ok) throw new Error("Error fetching precio pintura")
  return res.json()
}

export async function updatePrecioPinturaApi(precio_por_pieza: number): Promise<PrecioPintura> {
  const res = await fetch("/api/precios-pintura", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ precio_por_pieza }),
  })
  if (!res.ok) throw new Error("Error updating precio pintura")
  return res.json()
}

// Piezas Pintura - Lista de piezas
export async function fetchPiezasPintura(): Promise<PiezaPintura[]> {
  const res = await fetch("/api/piezas-pintura")
  if (!res.ok) throw new Error("Error fetching piezas pintura")
  return res.json()
}

export async function createPiezaPinturaApi(nombre: string, cantidad_piezas?: number): Promise<PiezaPintura> {
  const res = await fetch("/api/piezas-pintura", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, cantidad_piezas: cantidad_piezas || 1 }),
  })
  if (!res.ok) throw new Error("Error creating pieza pintura")
  return res.json()
}

export async function updatePiezaPinturaApi(id: string, cantidad_piezas: number): Promise<PiezaPintura> {
  const res = await fetch("/api/piezas-pintura", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, cantidad_piezas }),
  })
  if (!res.ok) throw new Error("Error updating pieza pintura")
  return res.json()
}

export async function deletePiezaPinturaApi(id: string): Promise<void> {
  const res = await fetch(`/api/piezas-pintura?id=${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error deleting pieza pintura")
}

export type { Servicio, Presupuesto, Gasto, PrecioPintura, PiezaPintura, FotoServicio }

export const api = {
  dashboard: {
    getData: fetchDashboardData,
  },
  chart: {
    getData: fetchChartData,
  },
  servicios: {
    getAll: fetchServicios,
    getByMonth: fetchServicios,
    create: createServicioApi,
    update: updateServicioApi,
    delete: deleteServicioApi,
  },
  presupuestos: {
    getAll: fetchPresupuestos,
    getByMonth: fetchPresupuestos,
    create: createPresupuestoApi,
    update: updatePresupuestoApi,
    delete: deletePresupuestoApi,
    convertToServicio: convertToServicioApi,
  },
  gastos: {
    getAll: fetchGastos,
    getByMonth: fetchGastos,
    create: createGastoApi,
    update: updateGastoApi,
    delete: deleteGastoApi,
  },
  precioPintura: {
    get: fetchPrecioPintura,
    update: updatePrecioPinturaApi,
  },
  piezasPintura: {
    getAll: fetchPiezasPintura,
    create: createPiezaPinturaApi,
    update: updatePiezaPinturaApi,
    delete: deletePiezaPinturaApi,
  },
}
