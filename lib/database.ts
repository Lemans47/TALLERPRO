import postgres from "postgres"

// Unwrap any over-encoded JSONB string values, then re-encode once cleanly.
// Prevents double/triple encoding when values come back from postgres as strings.
function safeJson(v: any): string {
  let val = v
  while (typeof val === "string" && val) {
    try { val = JSON.parse(val) } catch { break }
  }
  return JSON.stringify(val ?? null)
}

declare global {
  // eslint-disable-next-line no-var
  var _pgSql: ReturnType<typeof postgres> | undefined
}

export function getSQL() {
  if (global._pgSql) return global._pgSql as any

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!connectionString) {
    throw new Error("Database connection string not found")
  }

  global._pgSql = postgres(connectionString, { ssl: "require", max: 5, prepare: false })
  return global._pgSql as any
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
  cobros: { categoria: string; descripcion: string; monto: number; isAuto?: boolean }[]
  costos: { categoria?: string; descripcion: string; monto: number; isAuto?: boolean }[]
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
  cobros: { categoria: string; descripcion: string; monto: number; isAuto?: boolean }[]
  costos: { categoria?: string; descripcion: string; monto: number; isAuto?: boolean }[]
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
  pagado?: boolean
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

export async function getHistorialByPatente(patente: string) {
  const db = getSQL()
  const data = await db`
    SELECT id, fecha_ingreso, patente, marca, modelo, color, cliente, telefono,
           observaciones, estado, monto_total, monto_total_sin_iva, cobros,
           piezas_pintura, anticipo, saldo_pendiente, numero_ot
    FROM servicios
    WHERE UPPER(TRIM(patente)) = UPPER(TRIM(${patente}))
    ORDER BY fecha_ingreso DESC
  `
  return data as Servicio[]
}

export async function getHistorialByCliente(nombre: string) {
  const db = getSQL()
  const data = await db`
    SELECT id, fecha_ingreso, patente, marca, modelo, color, cliente, telefono,
           observaciones, estado, monto_total, monto_total_sin_iva, cobros,
           piezas_pintura, anticipo, saldo_pendiente, numero_ot
    FROM servicios
    WHERE LOWER(TRIM(cliente)) = LOWER(TRIM(${nombre}))
    ORDER BY fecha_ingreso DESC
  `
  return data as Servicio[]
}

export async function getServicios() {
  const db = getSQL()
  const data = await db`
    SELECT * FROM servicios 
    ORDER BY fecha_ingreso DESC
  `
  return data as Servicio[]
}

export async function getActiveServicios() {
  const db = getSQL()
  const data = await db`
    SELECT * FROM servicios
    WHERE estado NOT IN ('Cerrado/Pagado', 'Entregado')
    ORDER BY fecha_ingreso DESC
  `
  return data as Servicio[]
}

export async function getEntregadosByMonth(year: number, month: number) {
  const db = getSQL()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const data = await db`
    SELECT * FROM servicios
    WHERE estado IN ('Entregado', 'Cerrado/Pagado', 'Por Cobrar')
    AND updated_at >= ${startDate}
    AND updated_at < ${endDate}
    ORDER BY updated_at DESC
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
      fecha_ingreso, patente, marca, modelo, color, kilometraje, año, cliente, telefono, observaciones,
      mano_obra_pintura, cobros, costos, piezas_pintura, estado, iva,
      anticipo, saldo_pendiente, monto_total, monto_total_sin_iva, observaciones_checkboxes,
      fotos_ingreso, fotos_entrega
    ) VALUES (
      ${servicio.fecha_ingreso}, ${servicio.patente}, ${servicio.marca}, ${servicio.modelo},
      ${servicio.color || null}, ${servicio.kilometraje || null}, ${servicio.año || null},
      ${servicio.cliente}, ${servicio.telefono}, ${servicio.observaciones},
      ${servicio.mano_obra_pintura}, ${safeJson(servicio.cobros)}, ${safeJson(servicio.costos)},
      ${safeJson(servicio.piezas_pintura)}, ${servicio.estado}, ${servicio.iva},
      ${servicio.anticipo}, ${servicio.saldo_pendiente}, ${servicio.monto_total},
      ${servicio.monto_total_sin_iva}, ${safeJson(servicio.observaciones_checkboxes)},
      ${safeJson(servicio.fotos_ingreso || [])}, ${safeJson(servicio.fotos_entrega || [])}
    ) RETURNING *
  `
  return data[0] as Servicio
}

export async function updateServicio(id: string, servicio: Partial<Servicio>) {
  const db = getSQL()
  const data = await db`
    UPDATE servicios SET
      fecha_ingreso = COALESCE(${servicio.fecha_ingreso ?? null}, fecha_ingreso),
      patente = COALESCE(${servicio.patente ?? null}, patente),
      marca = COALESCE(${servicio.marca ?? null}, marca),
      modelo = COALESCE(${servicio.modelo ?? null}, modelo),
      color = COALESCE(${servicio.color ?? null}, color),
      kilometraje = COALESCE(${servicio.kilometraje ?? null}, kilometraje),
      año = COALESCE(${servicio.año ?? null}, año),
      cliente = COALESCE(${servicio.cliente ?? null}, cliente),
      telefono = COALESCE(${servicio.telefono ?? null}, telefono),
      observaciones = COALESCE(${servicio.observaciones ?? null}, observaciones),
      mano_obra_pintura = COALESCE(${servicio.mano_obra_pintura ?? null}, mano_obra_pintura),
      cobros = COALESCE(${servicio.cobros != null ? safeJson(servicio.cobros) : null}::jsonb, cobros),
      costos = COALESCE(${servicio.costos != null ? safeJson(servicio.costos) : null}::jsonb, costos),
      piezas_pintura = COALESCE(${servicio.piezas_pintura != null ? safeJson(servicio.piezas_pintura) : null}::jsonb, piezas_pintura),
      estado = COALESCE(${servicio.estado ?? null}, estado),
      iva = COALESCE(${servicio.iva ?? null}, iva),
      anticipo = COALESCE(${servicio.anticipo ?? null}, anticipo),
      saldo_pendiente = COALESCE(${servicio.saldo_pendiente ?? null}, saldo_pendiente),
      monto_total = COALESCE(${servicio.monto_total ?? null}, monto_total),
      monto_total_sin_iva = COALESCE(${servicio.monto_total_sin_iva ?? null}, monto_total_sin_iva),
      observaciones_checkboxes = COALESCE(${servicio.observaciones_checkboxes != null ? safeJson(servicio.observaciones_checkboxes) : null}::jsonb, observaciones_checkboxes),
      fotos_ingreso = COALESCE(${servicio.fotos_ingreso != null ? safeJson(servicio.fotos_ingreso) : null}::jsonb, fotos_ingreso),
      fotos_entrega = COALESCE(${servicio.fotos_entrega != null ? safeJson(servicio.fotos_entrega) : null}::jsonb, fotos_entrega),
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
      fecha_ingreso, patente, marca, modelo, color, kilometraje, año, cliente, telefono, observaciones,
      mano_obra_pintura, cobros, costos, piezas_pintura, iva,
      monto_total, monto_total_sin_iva, observaciones_checkboxes
    ) VALUES (
      ${presupuesto.fecha_ingreso}, ${presupuesto.patente}, ${presupuesto.marca}, ${presupuesto.modelo},
      ${presupuesto.color || null}, ${presupuesto.kilometraje || null}, ${presupuesto.año || null},
      ${presupuesto.cliente}, ${presupuesto.telefono}, ${presupuesto.observaciones},
      ${presupuesto.mano_obra_pintura}, ${safeJson(presupuesto.cobros)}, ${safeJson(presupuesto.costos)},
      ${safeJson(presupuesto.piezas_pintura)}, ${presupuesto.iva},
      ${presupuesto.monto_total}, ${presupuesto.monto_total_sin_iva}, ${safeJson(presupuesto.observaciones_checkboxes)}
    ) RETURNING *
  `
  return data[0] as Presupuesto
}

export async function updatePresupuesto(id: string, presupuesto: Partial<Presupuesto>) {
  const db = getSQL()
  const data = await db`
    UPDATE presupuestos SET
      fecha_ingreso = COALESCE(${presupuesto.fecha_ingreso ?? null}, fecha_ingreso),
      patente = COALESCE(${presupuesto.patente ?? null}, patente),
      marca = COALESCE(${presupuesto.marca ?? null}, marca),
      modelo = COALESCE(${presupuesto.modelo ?? null}, modelo),
      color = COALESCE(${presupuesto.color ?? null}, color),
      kilometraje = COALESCE(${presupuesto.kilometraje ?? null}, kilometraje),
      año = COALESCE(${presupuesto.año ?? null}, año),
      cliente = COALESCE(${presupuesto.cliente ?? null}, cliente),
      telefono = COALESCE(${presupuesto.telefono ?? null}, telefono),
      observaciones = COALESCE(${presupuesto.observaciones ?? null}, observaciones),
      mano_obra_pintura = COALESCE(${presupuesto.mano_obra_pintura ?? null}, mano_obra_pintura),
      cobros = COALESCE(${presupuesto.cobros != null ? safeJson(presupuesto.cobros) : null}::jsonb, cobros),
      costos = COALESCE(${presupuesto.costos != null ? safeJson(presupuesto.costos) : null}::jsonb, costos),
      piezas_pintura = COALESCE(${presupuesto.piezas_pintura != null ? safeJson(presupuesto.piezas_pintura) : null}::jsonb, piezas_pintura),
      iva = COALESCE(${presupuesto.iva ?? null}, iva),
      monto_total = COALESCE(${presupuesto.monto_total ?? null}, monto_total),
      monto_total_sin_iva = COALESCE(${presupuesto.monto_total_sin_iva ?? null}, monto_total_sin_iva),
      observaciones_checkboxes = COALESCE(${presupuesto.observaciones_checkboxes != null ? safeJson(presupuesto.observaciones_checkboxes) : null}::jsonb, observaciones_checkboxes),
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
  return await db.begin(async (sql: any) => {
    // Get presupuesto within transaction to lock the row
    const presupuestoData = await sql`SELECT * FROM presupuestos WHERE id = ${presupuestoId} FOR UPDATE`
    const presupuesto = presupuestoData[0] as Presupuesto
    if (!presupuesto) throw new Error("Presupuesto no encontrado")

    // Create servicio from presupuesto (atomically)
    const newServicio = await sql`
      INSERT INTO servicios (
        fecha_ingreso, patente, marca, modelo, color, kilometraje, año, cliente, telefono, observaciones,
        mano_obra_pintura, cobros, costos, piezas_pintura, estado, iva,
        anticipo, saldo_pendiente, monto_total, monto_total_sin_iva, observaciones_checkboxes,
        fotos_ingreso, fotos_entrega
      ) VALUES (
        NOW(), ${presupuesto.patente}, ${presupuesto.marca}, ${presupuesto.modelo},
        ${presupuesto.color || null}, ${presupuesto.kilometraje || null}, ${presupuesto.año || null},
        ${presupuesto.cliente}, ${presupuesto.telefono || ""}, ${presupuesto.observaciones || ""},
        ${presupuesto.mano_obra_pintura || 0},
        ${safeJson(presupuesto.cobros)}, ${safeJson(presupuesto.costos)},
        ${safeJson(presupuesto.piezas_pintura)}, 'En Cola', ${presupuesto.iva || "sin"},
        0, ${presupuesto.monto_total || 0}, ${presupuesto.monto_total || 0}, ${presupuesto.monto_total_sin_iva || 0},
        ${safeJson(presupuesto.observaciones_checkboxes || [])},
        '[]'::jsonb, '[]'::jsonb
      ) RETURNING *
    `

    // Delete presupuesto atomically with the insert
    await sql`DELETE FROM presupuestos WHERE id = ${presupuestoId}`

    return newServicio[0] as Servicio
  })
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
  const pagado = gasto.pagado !== false // default true
  const data = await db`
    INSERT INTO gastos (fecha, categoria, descripcion, monto, pagado)
    VALUES (${gasto.fecha}, ${gasto.categoria}, ${gasto.descripcion}, ${gasto.monto}, ${pagado})
    RETURNING *
  `
  return data[0] as Gasto
}

export async function updateGasto(id: string, gasto: Partial<Gasto>) {
  const db = getSQL()
  const data = await db`
    UPDATE gastos SET
      fecha = COALESCE(${gasto.fecha ?? null}, fecha),
      categoria = COALESCE(${gasto.categoria ?? null}, categoria),
      descripcion = COALESCE(${gasto.descripcion ?? null}, descripcion),
      monto = COALESCE(${gasto.monto ?? null}, monto),
      pagado = COALESCE(${gasto.pagado ?? null}, pagado),
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
      nombre = COALESCE(${trabajador.nombre ?? null}, nombre),
      sueldo_base = COALESCE(${trabajador.sueldo_base ?? null}, sueldo_base),
      activo = COALESCE(${trabajador.activo ?? null}, activo),
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

export async function getAbonoById(id: string) {
  const db = getSQL()
  const data = await db`
    SELECT a.*, e.nombre AS empleado_nombre
    FROM abonos_empleados a
    JOIN empleados e ON e.id = a.empleado_id
    WHERE a.id = ${id}
  `
  return data[0] as AbonoEmpleado | undefined
}

export async function deleteAbono(id: string) {
  const db = getSQL()
  await db`DELETE FROM abonos_empleados WHERE id = ${id}`
}

export async function deleteGastosSueldoByPattern(nombre: string, mes: number, año: number) {
  const db = getSQL()
  const pattern = `Abono sueldo ${nombre} ${String(mes).padStart(2, "0")}/${año}`
  await db`DELETE FROM gastos WHERE categoria = 'Sueldos' AND descripcion = ${pattern}`
}

// Borra el abono y su gasto asociado de forma atómica
export async function deleteAbonoWithGastos(id: string) {
  const db = getSQL()
  await db.begin(async (sql: any) => {
    const [abono] = await sql`
      SELECT a.*, e.nombre AS empleado_nombre
      FROM abonos_empleados a
      JOIN empleados e ON e.id = a.empleado_id
      WHERE a.id = ${id}
    `
    // Borrar el abono primero
    await sql`DELETE FROM abonos_empleados WHERE id = ${id}`
    // Borrar el gasto asociado si existía
    if (abono) {
      const pattern = `Abono sueldo ${abono.empleado_nombre} ${String(abono.mes).padStart(2, "0")}/${abono.año}`
      await sql`DELETE FROM gastos WHERE categoria = 'Sueldos' AND descripcion = ${pattern}`
    }
  })
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
  vin?: string
  mes_revision_tecnica?: string
  cliente_id?: string
  created_at: string
  updated_at: string
}

export async function getVehiculoByPatente(patente: string): Promise<Vehiculo | null> {
  const db = getSQL()
  const data = await db`SELECT * FROM vehiculos WHERE patente = ${patente.toUpperCase()} LIMIT 1`
  return (data[0] as Vehiculo) || null
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
      nombre = COALESCE(${cliente.nombre ?? null}, nombre),
      telefono = COALESCE(${cliente.telefono ?? null}, telefono),
      email = COALESCE(${cliente.email ?? null}, email),
      notas = COALESCE(${cliente.notas ?? null}, notas),
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
  vehiculoData: { marca?: string; modelo?: string; color?: string; año?: number; vin?: string }
) {
  const db = getSQL()

  // Buscar o crear cliente por nombre (case-insensitive, trim)
  let clienteRows = await db`
    SELECT * FROM clientes WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(${nombre})) LIMIT 1
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
        vin = COALESCE(${vehiculoData.vin || null}, vin),
        cliente_id = ${cliente.id},
        updated_at = NOW()
      WHERE patente = ${patente.toUpperCase()}
    `
  } else {
    await db`
      INSERT INTO vehiculos (patente, marca, modelo, color, año, vin, cliente_id)
      VALUES (${patente.toUpperCase()}, ${vehiculoData.marca || null}, ${vehiculoData.modelo || null},
              ${vehiculoData.color || null}, ${vehiculoData.año || null}, ${vehiculoData.vin || null}, ${cliente.id})
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

export async function deduplicarClientes(): Promise<number> {
  const db = getSQL()
  const todos = await db`SELECT * FROM clientes ORDER BY created_at ASC`

  // Group by normalized name
  const grupos: Record<string, typeof todos> = {}
  for (const c of todos) {
    const key = (c.nombre as string).toLowerCase().trim()
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(c)
  }

  let deleted = 0
  for (const grupo of Object.values(grupos)) {
    if (grupo.length <= 1) continue
    // Keep the one with phone first, then oldest
    const keeper = [...grupo].sort((a, b) => {
      if (a.telefono && !b.telefono) return -1
      if (!a.telefono && b.telefono) return 1
      return new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime()
    })[0]
    const toDelete = grupo.filter((c: any) => c.id !== keeper.id)
    for (const dup of toDelete) {
      await db`UPDATE vehiculos SET cliente_id = ${keeper.id as string}, updated_at = NOW() WHERE cliente_id = ${dup.id as string}`
      await db`DELETE FROM clientes WHERE id = ${dup.id as string}`
      deleted++
    }
  }
  return deleted
}

export async function deletePrecioPintura(id: string) {
  const db = getSQL()
  await db`DELETE FROM precios_pintura WHERE id = ${id}`
}

export async function batchUpdatePreciosPintura(updates: { id: string; precio: number }[]) {
  const db = getSQL()
  if (updates.length === 0) return []
  const results = await Promise.all(
    updates.map((u) =>
      db`UPDATE precios_pintura SET precio_por_pieza = ${u.precio}, updated_at = NOW() WHERE id = ${u.id} RETURNING *`
    )
  )
  return results.flat() as PrecioPintura[]
}

// ── Gastos Fijos Plantillas ──────────────────────────────────────────────────
export interface GastoFijoPlantilla {
  id: string
  descripcion: string
  monto_estimado: number
  orden: number
  activo: boolean
  created_at: string
}

async function ensurePlantillasTable(db: any) {
  await db`
    CREATE TABLE IF NOT EXISTS gastos_fijos_plantillas (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      descripcion TEXT NOT NULL,
      monto_estimado INTEGER NOT NULL DEFAULT 0,
      orden INTEGER DEFAULT 0,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  // Seed defaults if empty
  const count = await db`SELECT COUNT(*) AS n FROM gastos_fijos_plantillas`
  if (Number(count[0].n) === 0) {
    await db`
      INSERT INTO gastos_fijos_plantillas (descripcion, monto_estimado, orden) VALUES
      ('Luz', 0, 1),
      ('Agua', 0, 2),
      ('Convenio Contribuciones', 0, 3),
      ('Boleta Electrónica', 0, 4)
    `
  }
}

export async function getPlantillas() {
  const db = getSQL()
  await ensurePlantillasTable(db)
  const data = await db`SELECT * FROM gastos_fijos_plantillas WHERE activo = TRUE ORDER BY orden ASC, created_at ASC`
  return data as GastoFijoPlantilla[]
}

export async function createPlantilla(p: { descripcion: string; monto_estimado: number }) {
  const db = getSQL()
  await ensurePlantillasTable(db)
  const maxOrden = await db`SELECT COALESCE(MAX(orden), 0) AS m FROM gastos_fijos_plantillas`
  const data = await db`
    INSERT INTO gastos_fijos_plantillas (descripcion, monto_estimado, orden)
    VALUES (${p.descripcion}, ${p.monto_estimado}, ${Number(maxOrden[0].m) + 1})
    RETURNING *
  `
  return data[0] as GastoFijoPlantilla
}

export async function updatePlantilla(id: string, p: { descripcion?: string; monto_estimado?: number }) {
  const db = getSQL()
  const data = await db`
    UPDATE gastos_fijos_plantillas SET
      descripcion    = COALESCE(${p.descripcion ?? null}, descripcion),
      monto_estimado = COALESCE(${p.monto_estimado ?? null}, monto_estimado)
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as GastoFijoPlantilla
}

export async function deletePlantilla(id: string) {
  const db = getSQL()
  await db`DELETE FROM gastos_fijos_plantillas WHERE id = ${id}`
}

// ── Plantillas de Servicio ────────────────────────────────────────────────────

export interface PlantillaServicio {
  id: string
  nombre: string
  cobros: any
  costos: any
  created_at?: string
}

async function ensurePlantillasServicioTable(db: any) {
  await db`
    CREATE TABLE IF NOT EXISTS plantillas_servicio (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      nombre TEXT NOT NULL,
      cobros JSONB DEFAULT '[]',
      costos JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function getPlantillasServicio() {
  const db = getSQL()
  await ensurePlantillasServicioTable(db)
  const data = await db`SELECT * FROM plantillas_servicio ORDER BY nombre ASC`
  return data as PlantillaServicio[]
}

export async function createPlantillaServicio(p: { nombre: string; cobros: any; costos: any }) {
  const db = getSQL()
  await ensurePlantillasServicioTable(db)
  const data = await db`
    INSERT INTO plantillas_servicio (nombre, cobros, costos)
    VALUES (${p.nombre}, ${safeJson(p.cobros)}::jsonb, ${safeJson(p.costos)}::jsonb)
    RETURNING *
  `
  return data[0] as PlantillaServicio
}

export async function deletePlantillaServicio(id: string) {
  const db = getSQL()
  await db`DELETE FROM plantillas_servicio WHERE id = ${id}`
}

// ── Proveedores ───────────────────────────────────────────────────────────────

export interface Proveedor {
  id: string
  nombre: string
  rut?: string
  telefono?: string
  email?: string
  categoria?: string
  notas?: string
  created_at?: string
  updated_at?: string
}

export async function getProveedores() {
  const db = getSQL()
  const data = await db`SELECT * FROM proveedores ORDER BY nombre ASC`
  return data as Proveedor[]
}

export async function createProveedor(p: Omit<Proveedor, "id" | "created_at" | "updated_at">) {
  const db = getSQL()
  const data = await db`
    INSERT INTO proveedores (nombre, rut, telefono, email, categoria, notas)
    VALUES (${p.nombre}, ${p.rut ?? null}, ${p.telefono ?? null}, ${p.email ?? null}, ${p.categoria ?? null}, ${p.notas ?? null})
    RETURNING *
  `
  return data[0] as Proveedor
}

export async function updateProveedor(id: string, p: Partial<Omit<Proveedor, "id" | "created_at" | "updated_at">>) {
  const db = getSQL()
  const data = await db`
    UPDATE proveedores SET
      nombre    = COALESCE(${p.nombre ?? null}, nombre),
      rut       = COALESCE(${p.rut ?? null}, rut),
      telefono  = COALESCE(${p.telefono ?? null}, telefono),
      email     = COALESCE(${p.email ?? null}, email),
      categoria = COALESCE(${p.categoria ?? null}, categoria),
      notas     = COALESCE(${p.notas ?? null}, notas),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return data[0] as Proveedor
}

export async function deleteProveedor(id: string) {
  const db = getSQL()
  await db`DELETE FROM proveedores WHERE id = ${id}`
}
