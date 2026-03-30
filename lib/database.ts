import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let sql: NeonQueryFunction<false, false> | null = null

function getSQL() {
  // No cachear la conexión - crear una nueva en cada llamada para evitar problemas de state
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING

  if (!connectionString) {
    throw new Error("Database connection string not found")
  }

  return neon(connectionString)
}

// Types
export interface FotoServicio {
  url: string
  publicId: string
}

export interface Servicio {
  id: string
  fecha_ingreso: string
  patente: string
  marca: string
  modelo: string
  color?: string
  kilometraje?: number
  año?: number
  cliente: string
  telefono: string
  observaciones: string | null
  mano_obra_pintura: number
  cobros: { categoria: string; descripcion: string; monto: number }[]
  costos: { descripcion: string; monto: number }[]
  piezas_pintura: { nombre: string; cantidad: number; precio: number }[]
  estado: string
  iva: string
  anticipo: number
  saldo_pendiente: number
  monto_total: number
  monto_total_sin_iva: number
  observaciones_checkboxes: string[]
  fotos_ingreso: FotoServicio[]
  fotos_entrega: FotoServicio[]
  numero_ot?: number
  created_at: string
  updated_at: string
}

export interface Presupuesto {
  id: string
  fecha_ingreso: string
  patente: string
  marca: string
  modelo: string
  color?: string
  kilometraje?: number
  año?: number
  cliente: string
  telefono: string
  observaciones: string | null
  mano_obra_pintura: number
  cobros: { categoria: string; descripcion: string; monto: number }[]
  costos: { descripcion: string; monto: number }[]
  piezas_pintura: { nombre: string; cantidad: number; precio: number }[]
  iva: string
  monto_total: number
  monto_total_sin_iva: number
  observaciones_checkboxes: string[]
  created_at: string
  updated_at: string
}

export interface Gasto {
  id: string
  fecha: string
  categoria: string
  descripcion: string
  monto: number
  created_at: string
  updated_at: string
}

export interface Trabajador {
  id: string
  nombre: string
  sueldo_base: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface PrecioPintura {
  id: string
  precio_por_pieza: number
  created_at: string
  updated_at: string
}

export interface PiezaPintura {
  id: string
  nombre: string
  cantidad_piezas: number
  created_at: string
  updated_at: string
}

// Servicios
export async function getServicioById(id: string) {
  const db = getSQL()
  const data = await db`SELECT * FROM servicios WHERE id = ${id}`
  return (data[0] as Servicio) || null
}

export async function getServicios() {
  const db = getSQL()
  const data = await db`
    SELECT * FROM servicios 
    ORDER BY fecha_ingreso DESC
  `
  return data as Servicio[]
}

export async function getServiciosByMonth(year: number, month: number) {
  const db = getSQL()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

  const data = await db`
    SELECT * FROM servicios 
    WHERE fecha_ingreso >= ${startDate} 
    AND fecha_ingreso <= ${endDate}
    ORDER BY fecha_ingreso DESC
  `
  return data as Servicio[]
}

export async function createServicio(servicio: Omit<Servicio, "id" | "created_at" | "updated_at">) {
  const db = getSQL()
  const data = await db`
    INSERT INTO servicios (
      fecha_ingreso, patente, marca, modelo, kilometraje, año, cliente, telefono, observaciones,
      mano_obra_pintura, cobros, costos, piezas_pintura, estado, iva,
      anticipo, saldo_pendiente, monto_total, monto_total_sin_iva, observaciones_checkboxes,
      fotos_ingreso, fotos_entrega
    ) VALUES (
      ${servicio.fecha_ingreso}, ${servicio.patente}, ${servicio.marca}, ${servicio.modelo},
      ${servicio.kilometraje || null}, ${servicio.año || null},
      ${servicio.cliente}, ${servicio.telefono}, ${servicio.observaciones},
      ${servicio.mano_obra_pintura}, ${JSON.stringify(servicio.cobros)}, ${JSON.stringify(servicio.costos)},
      ${JSON.stringify(servicio.piezas_pintura)}, ${servicio.estado}, ${servicio.iva},
      ${servicio.anticipo}, ${servicio.saldo_pendiente}, ${servicio.monto_total},
      ${servicio.monto_total_sin_iva}, ${JSON.stringify(servicio.observaciones_checkboxes)},
      ${JSON.stringify(servicio.fotos_ingreso || [])}, ${JSON.stringify(servicio.fotos_entrega || [])}
    ) RETURNING *
  `
  return data[0] as Servicio
}

export async function updateServicio(id: string, servicio: Partial<Servicio>) {
  const db = getSQL()
  const data = await db`
    UPDATE servicios SET
      fecha_ingreso = COALESCE(${servicio.fecha_ingreso}, fecha_ingreso),
      patente = COALESCE(${servicio.patente}, patente),
      marca = COALESCE(${servicio.marca}, marca),
      modelo = COALESCE(${servicio.modelo}, modelo),
      kilometraje = COALESCE(${servicio.kilometraje}, kilometraje),
      año = COALESCE(${servicio.año}, año),
      cliente = COALESCE(${servicio.cliente}, cliente),
      telefono = COALESCE(${servicio.telefono}, telefono),
      observaciones = COALESCE(${servicio.observaciones}, observaciones),
      mano_obra_pintura = COALESCE(${servicio.mano_obra_pintura}, mano_obra_pintura),
      cobros = COALESCE(${servicio.cobros ? JSON.stringify(servicio.cobros) : null}::jsonb, cobros),
      costos = COALESCE(${servicio.costos ? JSON.stringify(servicio.costos) : null}::jsonb, costos),
      piezas_pintura = COALESCE(${servicio.piezas_pintura ? JSON.stringify(servicio.piezas_pintura) : null}::jsonb, piezas_pintura),
      estado = COALESCE(${servicio.estado}, estado),
      iva = COALESCE(${servicio.iva}, iva),
      anticipo = COALESCE(${servicio.anticipo}, anticipo),
      saldo_pendiente = COALESCE(${servicio.saldo_pendiente}, saldo_pendiente),
      monto_total = COALESCE(${servicio.monto_total}, monto_total),
      monto_total_sin_iva = COALESCE(${servicio.monto_total_sin_iva}, monto_total_sin_iva),
      observaciones_checkboxes = COALESCE(${servicio.observaciones_checkboxes ? JSON.stringify(servicio.observaciones_checkboxes) : null}::jsonb, observaciones_checkboxes),
      fotos_ingreso = COALESCE(${servicio.fotos_ingreso ? JSON.stringify(servicio.fotos_ingreso) : null}::jsonb, fotos_ingreso),
      fotos_entrega = COALESCE(${servicio.fotos_entrega ? JSON.stringify(servicio.fotos_entrega) : null}::jsonb, fotos_entrega),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as Servicio
}

export async function deleteServicio(id: string) {
  const db = getSQL()
  await db`DELETE FROM servicios WHERE id = ${id}`
}

// Presupuestos
export async function getPresupuestos() {
  const db = getSQL()
  const data = await db`
    SELECT * FROM presupuestos 
    ORDER BY fecha_ingreso DESC
  `
  return data as Presupuesto[]
}

export async function getPresupuestoById(id: string) {
  const db = getSQL()
  const data = await db`
    SELECT * FROM presupuestos 
    WHERE id = ${id}
  `
  return (data[0] as Presupuesto) || null
}

export async function getPresupuestosByMonth(year: number, month: number) {
  const db = getSQL()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

  const data = await db`
    SELECT * FROM presupuestos 
    WHERE fecha_ingreso >= ${startDate} 
    AND fecha_ingreso <= ${endDate}
    ORDER BY fecha_ingreso DESC
  `
  return data as Presupuesto[]
}

export async function createPresupuesto(presupuesto: Omit<Presupuesto, "id" | "created_at" | "updated_at">) {
  const db = getSQL()
  const data = await db`
    INSERT INTO presupuestos (
      fecha_ingreso, patente, marca, modelo, kilometraje, año, cliente, telefono, observaciones,
      mano_obra_pintura, cobros, costos, piezas_pintura, iva,
      monto_total, monto_total_sin_iva, observaciones_checkboxes
    ) VALUES (
      ${presupuesto.fecha_ingreso}, ${presupuesto.patente}, ${presupuesto.marca}, ${presupuesto.modelo},
      ${presupuesto.kilometraje || null}, ${presupuesto.año || null},
      ${presupuesto.cliente}, ${presupuesto.telefono}, ${presupuesto.observaciones},
      ${presupuesto.mano_obra_pintura}, ${JSON.stringify(presupuesto.cobros)}, ${JSON.stringify(presupuesto.costos)},
      ${JSON.stringify(presupuesto.piezas_pintura)}, ${presupuesto.iva},
      ${presupuesto.monto_total}, ${presupuesto.monto_total_sin_iva}, ${JSON.stringify(presupuesto.observaciones_checkboxes)}
    ) RETURNING *
  `
  return data[0] as Presupuesto
}

export async function updatePresupuesto(id: string, presupuesto: Partial<Presupuesto>) {
  const db = getSQL()
  const data = await db`
    UPDATE presupuestos SET
      fecha_ingreso = COALESCE(${presupuesto.fecha_ingreso}, fecha_ingreso),
      patente = COALESCE(${presupuesto.patente}, patente),
      marca = COALESCE(${presupuesto.marca}, marca),
      modelo = COALESCE(${presupuesto.modelo}, modelo),
      kilometraje = COALESCE(${presupuesto.kilometraje}, kilometraje),
      año = COALESCE(${presupuesto.año}, año),
      cliente = COALESCE(${presupuesto.cliente}, cliente),
      telefono = COALESCE(${presupuesto.telefono}, telefono),
      observaciones = COALESCE(${presupuesto.observaciones}, observaciones),
      mano_obra_pintura = COALESCE(${presupuesto.mano_obra_pintura}, mano_obra_pintura),
      cobros = COALESCE(${presupuesto.cobros ? JSON.stringify(presupuesto.cobros) : null}::jsonb, cobros),
      costos = COALESCE(${presupuesto.costos ? JSON.stringify(presupuesto.costos) : null}::jsonb, costos),
      piezas_pintura = COALESCE(${presupuesto.piezas_pintura ? JSON.stringify(presupuesto.piezas_pintura) : null}::jsonb, piezas_pintura),
      iva = COALESCE(${presupuesto.iva}, iva),
      monto_total = COALESCE(${presupuesto.monto_total}, monto_total),
      monto_total_sin_iva = COALESCE(${presupuesto.monto_total_sin_iva}, monto_total_sin_iva),
      observaciones_checkboxes = COALESCE(${presupuesto.observaciones_checkboxes ? JSON.stringify(presupuesto.observaciones_checkboxes) : null}::jsonb, observaciones_checkboxes),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as Presupuesto
}

export async function deletePresupuesto(id: string) {
  const db = getSQL()
  await db`DELETE FROM presupuestos WHERE id = ${id}`
}

export async function convertPresupuestoToServicio(presupuestoId: string) {
  const db = getSQL()
  // Get presupuesto
  const presupuestoData = await db`
    SELECT * FROM presupuestos WHERE id = ${presupuestoId}
  `
  const presupuesto = presupuestoData[0] as Presupuesto

  if (!presupuesto) throw new Error("Presupuesto no encontrado")

  // Create servicio from presupuesto
  const newServicio = await db`
    INSERT INTO servicios (
      fecha_ingreso, patente, marca, modelo, kilometraje, año, cliente, telefono, observaciones,
      mano_obra_pintura, cobros, costos, piezas_pintura, estado, iva,
      anticipo, saldo_pendiente, monto_total, monto_total_sin_iva, observaciones_checkboxes,
      fotos_ingreso, fotos_entrega
    ) VALUES (
      CURRENT_DATE, ${presupuesto.patente}, ${presupuesto.marca}, ${presupuesto.modelo},
      ${presupuesto.kilometraje || null}, ${presupuesto.año || null},
      ${presupuesto.cliente}, ${presupuesto.telefono}, ${presupuesto.observaciones},
      ${presupuesto.mano_obra_pintura}, ${JSON.stringify(presupuesto.cobros)}, ${JSON.stringify(presupuesto.costos)},
      ${JSON.stringify(presupuesto.piezas_pintura)}, 'En Cola', ${presupuesto.iva},
      0, ${presupuesto.monto_total}, ${presupuesto.monto_total}, ${presupuesto.monto_total_sin_iva},
      ${JSON.stringify(presupuesto.observaciones_checkboxes)},
      '[]'::jsonb, '[]'::jsonb
    ) RETURNING *
  `

  // Delete presupuesto
  await db`DELETE FROM presupuestos WHERE id = ${presupuestoId}`

  return newServicio[0] as Servicio
}

// Gastos
export async function getGastos() {
  const db = getSQL()
  const data = await db`
    SELECT * FROM gastos 
    ORDER BY fecha DESC
  `
  return data as Gasto[]
}

export async function getGastosByMonth(year: number, month: number) {
  const db = getSQL()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

  const data = await db`
    SELECT * FROM gastos 
    WHERE fecha >= ${startDate} 
    AND fecha <= ${endDate}
    ORDER BY fecha DESC
  `
  return data as Gasto[]
}

export async function getGastosByCategoria(categoria: string) {
  const db = getSQL()
  const data = await db`
    SELECT * FROM gastos 
    WHERE categoria = ${categoria}
    ORDER BY fecha DESC
  `
  return data as Gasto[]
}

export async function createGasto(gasto: Omit<Gasto, "id" | "created_at" | "updated_at">) {
  const db = getSQL()
  const data = await db`
    INSERT INTO gastos (fecha, categoria, descripcion, monto)
    VALUES (${gasto.fecha}, ${gasto.categoria}, ${gasto.descripcion}, ${gasto.monto})
    RETURNING *
  `
  return data[0] as Gasto
}

export async function updateGasto(id: string, gasto: Partial<Gasto>) {
  const db = getSQL()
  const data = await db`
    UPDATE gastos SET
      fecha = COALESCE(${gasto.fecha}, fecha),
      categoria = COALESCE(${gasto.categoria}, categoria),
      descripcion = COALESCE(${gasto.descripcion}, descripcion),
      monto = COALESCE(${gasto.monto}, monto),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as Gasto
}

export async function deleteGasto(id: string) {
  const db = getSQL()
  await db`DELETE FROM gastos WHERE id = ${id}`
}

// Trabajadores
export async function getTrabajadores() {
  const db = getSQL()
  const data = await db`
    SELECT * FROM trabajadores 
    ORDER BY nombre ASC
  `
  return data as Trabajador[]
}

export async function createTrabajador(trabajador: Omit<Trabajador, "id" | "created_at" | "updated_at">) {
  const db = getSQL()
  const data = await db`
    INSERT INTO trabajadores (nombre, sueldo_base, activo)
    VALUES (${trabajador.nombre}, ${trabajador.sueldo_base}, ${trabajador.activo})
    RETURNING *
  `
  return data[0] as Trabajador
}

export async function updateTrabajador(id: string, trabajador: Partial<Trabajador>) {
  const db = getSQL()
  const data = await db`
    UPDATE trabajadores SET
      nombre = COALESCE(${trabajador.nombre}, nombre),
      sueldo_base = COALESCE(${trabajador.sueldo_base}, sueldo_base),
      activo = COALESCE(${trabajador.activo}, activo),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as Trabajador
}

export async function deleteTrabajador(id: string) {
  const db = getSQL()
  await db`DELETE FROM trabajadores WHERE id = ${id}`
}

// Empleados
export interface Empleado {
  id: string
  nombre: string
  rut?: string
  cargo?: string
  sueldo_base: number
  activo: boolean
  created_at: string
}

export interface AbonoEmpleado {
  id: string
  empleado_id: string
  mes: number
  año: number
  monto: number
  fecha: string
  notas?: string
  created_at: string
  empleado_nombre?: string
  empleado_cargo?: string
}

export async function getEmpleados() {
  const db = getSQL()
  const data = await db`SELECT * FROM empleados ORDER BY nombre ASC`
  return data as Empleado[]
}

export async function createEmpleado(e: { nombre: string; rut?: string; cargo?: string; sueldo_base: number }) {
  const db = getSQL()
  const data = await db`
    INSERT INTO empleados (nombre, rut, cargo, sueldo_base)
    VALUES (${e.nombre}, ${e.rut || null}, ${e.cargo || null}, ${e.sueldo_base})
    RETURNING *
  `
  return data[0] as Empleado
}

export async function updateEmpleado(id: string, e: Partial<Empleado>) {
  const db = getSQL()
  const data = await db`
    UPDATE empleados SET
      nombre      = COALESCE(${e.nombre ?? null}, nombre),
      rut         = COALESCE(${e.rut ?? null}, rut),
      cargo       = COALESCE(${e.cargo ?? null}, cargo),
      sueldo_base = COALESCE(${e.sueldo_base ?? null}, sueldo_base),
      activo      = COALESCE(${e.activo ?? null}, activo)
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as Empleado
}

export async function deleteEmpleado(id: string) {
  const db = getSQL()
  await db`DELETE FROM empleados WHERE id = ${id}`
}

export async function getAbonosByMonth(year: number, month: number) {
  const db = getSQL()
  const data = await db`
    SELECT a.*, e.nombre AS empleado_nombre, e.cargo AS empleado_cargo
    FROM abonos_empleados a
    JOIN empleados e ON e.id = a.empleado_id
    WHERE a.año = ${year} AND a.mes = ${month}
    ORDER BY a.fecha ASC, a.created_at ASC
  `
  return data as AbonoEmpleado[]
}

export async function createAbono(a: { empleado_id: string; mes: number; año: number; monto: number; fecha: string; notas?: string }) {
  const db = getSQL()
  const data = await db`
    INSERT INTO abonos_empleados (empleado_id, mes, año, monto, fecha, notas)
    VALUES (${a.empleado_id}, ${a.mes}, ${a.año}, ${a.monto}, ${a.fecha}, ${a.notas ?? null})
    RETURNING *
  `
  return data[0] as AbonoEmpleado
}

export async function deleteAbono(id: string) {
  const db = getSQL()
  await db`DELETE FROM abonos_empleados WHERE id = ${id}`
}

// Dashboard KPIs
export async function getDashboardKPIs(year: number, month: number) {
  const servicios = await getServiciosByMonth(year, month)
  const gastos = await getGastosByMonth(year, month)

  const serviciosCerrados = servicios.filter((s) => s.estado === "Cerrado/Pagado")
  const ingresosSinIVA = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total_sin_iva), 0)
  const ingresosConIVA = serviciosCerrados.reduce((sum, s) => sum + Number(s.monto_total), 0)
  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.monto), 0)
  const costosServicios = servicios.reduce((sum, s) => {
    const costos = s.costos || []
    return sum + costos.reduce((c: number, costo: any) => c + Number(costo.monto), 0)
  }, 0)

  const utilidadOperacional = ingresosSinIVA - totalGastos - costosServicios
  const margenPromedio = ingresosSinIVA > 0 ? (utilidadOperacional / ingresosSinIVA) * 100 : 0

  const porCobrar = servicios
    .filter((s) => s.estado === "Por Cobrar" || Number(s.saldo_pendiente) > 0)
    .reduce((sum, s) => sum + Number(s.saldo_pendiente), 0)

  return {
    ingresosSinIVA,
    ingresosConIVA,
    totalGastos: totalGastos + costosServicios,
    utilidadOperacional,
    margenPromedio,
    porCobrar,
    serviciosActivos: servicios.filter((s) => s.estado !== "Cerrado/Pagado").length,
    serviciosTotal: servicios.length,
  }
}

// Vehicle History
export async function getVehicleHistory(patente: string) {
  const db = getSQL()
  const [serviciosData, presupuestosData] = await Promise.all([
    db`SELECT * FROM servicios WHERE LOWER(patente) LIKE ${`%${patente.toLowerCase()}%`} ORDER BY fecha_ingreso DESC`,
    db`SELECT * FROM presupuestos WHERE LOWER(patente) LIKE ${`%${patente.toLowerCase()}%`} ORDER BY fecha_ingreso DESC`,
  ])

  return {
    servicios: serviciosData as Servicio[],
    presupuestos: presupuestosData as Presupuesto[],
  }
}

// Delete all data
export async function deleteAllData() {
  const db = getSQL()
  await db`DELETE FROM servicios`
  await db`DELETE FROM presupuestos`
  await db`DELETE FROM gastos`
  await db`DELETE FROM trabajadores`
}

// Precio Pintura
export async function getPreciosPintura() {
  const db = getSQL()
  const data = await db`
    SELECT * FROM precios_pintura 
    ORDER BY nombre ASC
  `
  return data as PrecioPintura[]
}

// Precios Pintura - Solo precio global
export async function getPrecioPintura(): Promise<PrecioPintura | null> {
  try {
    const db = getSQL()
    const data = await db`SELECT * FROM precios_pintura LIMIT 1`
    return (data[0] as PrecioPintura) || null
  } catch (error: any) {
    console.error("[v0] Error fetching precios_pintura:", error?.message)
    return null
  }
}

export async function updatePrecioPintura(precio_por_pieza: number) {
  try {
    const db = getSQL()
    const data = await db`
      UPDATE precios_pintura 
      SET precio_por_pieza = ${precio_por_pieza}, updated_at = NOW() 
      RETURNING *
    `
    return data[0] as PrecioPintura
  } catch (error: any) {
    console.error("[v0] Error updating precios_pintura:", error?.message)
    throw error
  }
}

export async function initPrecioPintura(precio_por_pieza: number = 0) {
  try {
    const db = getSQL()
    const existing = await db`SELECT * FROM precios_pintura LIMIT 1`
    if (existing.length > 0) {
      return existing[0] as PrecioPintura
    }
    const data = await db`
      INSERT INTO precios_pintura (precio_por_pieza) 
      VALUES (${precio_por_pieza}) 
      RETURNING *
    `
    return data[0] as PrecioPintura
  } catch (error: any) {
    console.error("[v0] Error initializing precios_pintura:", error?.message)
    throw error
  }
}

// Piezas Pintura - Lista de piezas con cantidad
export async function getPiezasPintura() {
  try {
    const db = getSQL()
    const data = await db`SELECT * FROM piezas_pintura ORDER BY nombre ASC`
    return data as PiezaPintura[]
  } catch (error: any) {
    console.error("[v0] Error fetching piezas_pintura:", error?.message)
    return []
  }
}

export async function getPiezaPintura(id: string) {
  try {
    const db = getSQL()
    const data = await db`SELECT * FROM piezas_pintura WHERE id = ${id}`
    return (data[0] as PiezaPintura) || null
  } catch (error: any) {
    console.error("[v0] Error fetching pieza_pintura:", error?.message)
    return null
  }
}

export async function createPiezaPintura(nombre: string, cantidad_piezas: number = 1) {
  try {
    const db = getSQL()
    const data = await db`
      INSERT INTO piezas_pintura (nombre, cantidad_piezas) 
      VALUES (${nombre}, ${cantidad_piezas}) 
      RETURNING *
    `
    return data[0] as PiezaPintura
  } catch (error: any) {
    console.error("[v0] Error creating pieza_pintura:", error?.message)
    throw error
  }
}

export async function updatePiezaPintura(id: string, cantidad_piezas: number) {
  try {
    const db = getSQL()
    const data = await db`
      UPDATE piezas_pintura 
      SET cantidad_piezas = ${cantidad_piezas}, updated_at = NOW() 
      WHERE id = ${id} 
      RETURNING *
    `
    return data[0] as PiezaPintura
  } catch (error: any) {
    console.error("[v0] Error updating pieza_pintura:", error?.message)
    throw error
  }
}

export async function deletePiezaPintura(id: string) {
  try {
    const db = getSQL()
    await db`DELETE FROM piezas_pintura WHERE id = ${id}`
  } catch (error: any) {
    console.error("[v0] Error deleting pieza_pintura:", error?.message)
    throw error
  }
}

// ─── Clientes ───────────────────────────────────────────────────────────────

export interface Cliente {
  id: string
  nombre: string
  telefono?: string
  email?: string
  notas?: string
  created_at: string
  updated_at: string
}

export interface Vehiculo {
  id: string
  patente: string
  marca?: string
  modelo?: string
  color?: string
  año?: number
  cliente_id?: string
  created_at: string
  updated_at: string
}

export async function getClientes() {
  const db = getSQL()
  const data = await db`SELECT * FROM clientes ORDER BY nombre ASC`
  return data as Cliente[]
}

export async function getClienteById(id: string) {
  const db = getSQL()
  const data = await db`SELECT * FROM clientes WHERE id = ${id}`
  return (data[0] as Cliente) || null
}

export async function createCliente(cliente: Omit<Cliente, "id" | "created_at" | "updated_at">) {
  const db = getSQL()
  const data = await db`
    INSERT INTO clientes (nombre, telefono, email, notas)
    VALUES (${cliente.nombre}, ${cliente.telefono || null}, ${cliente.email || null}, ${cliente.notas || null})
    RETURNING *
  `
  return data[0] as Cliente
}

export async function updateCliente(id: string, cliente: Partial<Cliente>) {
  const db = getSQL()
  const data = await db`
    UPDATE clientes SET
      nombre = COALESCE(${cliente.nombre}, nombre),
      telefono = COALESCE(${cliente.telefono}, telefono),
      email = COALESCE(${cliente.email}, email),
      notas = COALESCE(${cliente.notas}, notas),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as Cliente
}

export async function deleteCliente(id: string) {
  const db = getSQL()
  await db`DELETE FROM clientes WHERE id = ${id}`
}

export async function upsertClienteYVehiculo(
  nombre: string,
  telefono: string,
  patente: string,
  vehiculoData: { marca?: string; modelo?: string; color?: string; año?: number }
) {
  const db = getSQL()

  // Buscar o crear cliente por nombre+telefono
  let clienteRows = await db`
    SELECT * FROM clientes WHERE nombre = ${nombre} AND telefono = ${telefono} LIMIT 1
  `
  let cliente: Cliente
  if (clienteRows.length > 0) {
    cliente = clienteRows[0] as Cliente
    // Actualizar telefono si cambió
    if (telefono && cliente.telefono !== telefono) {
      await db`UPDATE clientes SET telefono = ${telefono}, updated_at = NOW() WHERE id = ${cliente.id}`
    }
  } else {
    const created = await db`
      INSERT INTO clientes (nombre, telefono) VALUES (${nombre}, ${telefono || null}) RETURNING *
    `
    cliente = created[0] as Cliente
  }

  // Buscar o crear vehículo por patente
  const vehiculoRows = await db`SELECT * FROM vehiculos WHERE patente = ${patente.toUpperCase()} LIMIT 1`
  if (vehiculoRows.length > 0) {
    await db`
      UPDATE vehiculos SET
        marca = COALESCE(${vehiculoData.marca || null}, marca),
        modelo = COALESCE(${vehiculoData.modelo || null}, modelo),
        color = COALESCE(${vehiculoData.color || null}, color),
        año = COALESCE(${vehiculoData.año || null}, año),
        cliente_id = ${cliente.id},
        updated_at = NOW()
      WHERE patente = ${patente.toUpperCase()}
    `
  } else {
    await db`
      INSERT INTO vehiculos (patente, marca, modelo, color, año, cliente_id)
      VALUES (${patente.toUpperCase()}, ${vehiculoData.marca || null}, ${vehiculoData.modelo || null},
              ${vehiculoData.color || null}, ${vehiculoData.año || null}, ${cliente.id})
    `
  }

  return cliente
}

export async function getVehiculosConCliente() {
  const db = getSQL()
  const data = await db`
    SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.email as cliente_email
    FROM vehiculos v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    ORDER BY v.patente ASC
  `
  return data
}

export async function getClienteConVehiculos(clienteId: string) {
  const db = getSQL()
  const [clienteData, vehiculosData] = await Promise.all([
    db`SELECT * FROM clientes WHERE id = ${clienteId}`,
    db`SELECT * FROM vehiculos WHERE cliente_id = ${clienteId} ORDER BY patente ASC`,
  ])
  return {
    cliente: (clienteData[0] as Cliente) || null,
    vehiculos: vehiculosData as Vehiculo[],
  }
}

export async function deletePrecioPintura(id: string) {
  const db = getSQL()
  await db`DELETE FROM precios_pintura WHERE id = ${id}`
}

export async function batchUpdatePreciosPintura(updates: { id: string; precio: number }[]) {
  const db = getSQL()

  if (updates.length === 0) return []

  // Construir el query dinámicamente con CASE para actualizar múltiples filas en una sola query
  const ids = updates.map((u) => u.id)
  const caseStatement = updates.map((u) => `WHEN id = '${u.id}' THEN ${u.precio}`).join(" ")

  const data = await db`
    UPDATE precios_pintura SET
      precio = CASE ${db.unsafe(caseStatement)} END,
      updated_at = NOW()
    WHERE id = ANY(${ids})
    RETURNING *
  `

  return data as PrecioPintura[]
}
