// Diagnostico: encontrar el origen de la diferencia entre Pagado y Facturado-Pendiente
// Run: npx tsx scripts/debug-discrepancia.ts <year> <month>

import postgres from "postgres"
import * as fs from "fs"
import * as path from "path"

// Mini parser de .env.local sin dependencia
const envPath = path.resolve(".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
    if (m) {
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  }
}

const year = Number(process.argv[2]) || new Date().getFullYear()
const month = Number(process.argv[3]) || new Date().getMonth() + 1

const sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL || "", { ssl: "require", prepare: false })

async function main() {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

  // Resolver nombres de estado tipo "cerrado" dinámicamente.
  const cerradoRows: any[] = await sql`SELECT nombre FROM estados_servicio WHERE tipo = 'cerrado'`
  const nombresCerrado = new Set(cerradoRows.map((r) => r.nombre))

  const servicios: any[] = await sql`
    SELECT id, numero_ot, patente, cliente, estado,
           monto_total_sin_iva::numeric AS monto,
           anticipo::numeric AS anticipo,
           saldo_pendiente::numeric AS saldo,
           fecha_ingreso
    FROM servicios
    WHERE fecha_ingreso >= ${startDate} AND fecha_ingreso <= ${endDate}
    ORDER BY fecha_ingreso DESC
  `

  console.log(`\nServicios mes ${year}-${month}: ${servicios.length}\n`)

  let totalFacturado = 0
  let totalPendiente = 0
  let totalCobradoCerrados = 0
  let totalAnticiposNoCerrados = 0

  const sospechosos: any[] = []

  for (const s of servicios) {
    const monto = Number(s.monto)
    const anticipo = Number(s.anticipo)
    const saldo = Number(s.saldo)
    const esCerrado = nombresCerrado.has(s.estado)
    const esFacturado = monto > 0

    if (esFacturado) totalFacturado += monto
    if (esFacturado) totalPendiente += saldo
    if (esCerrado) totalCobradoCerrados += monto
    if (!esCerrado) totalAnticiposNoCerrados += anticipo

    // Caso 1: anticipo > 0 sin monto
    if (!esCerrado && monto === 0 && anticipo > 0) {
      sospechosos.push({ tipo: "anticipo_sin_monto", aporta_diff: anticipo, ...s })
    }

    // Caso 2: facturado no-cerrado donde anticipo + saldo != monto
    if (!esCerrado && esFacturado) {
      const diff = (anticipo + saldo) - monto
      if (Math.abs(diff) > 1) {
        sospechosos.push({ tipo: "anticipo+saldo!=monto", aporta_diff: diff, ...s })
      }
    }

    // Caso 3: cerrado con saldo > 0 (no debiera)
    if (esCerrado && saldo > 0) {
      sospechosos.push({ tipo: "cerrado_con_saldo", aporta_diff: saldo, ...s })
    }
  }

  const pagado = totalCobradoCerrados + totalAnticiposNoCerrados
  const sumaPP = pagado + totalPendiente
  const diff = sumaPP - totalFacturado

  console.log("=== Totales ===")
  console.log(`Facturado:           $${totalFacturado.toLocaleString("es-CL")}`)
  console.log(`Pagado (Entradas):   $${pagado.toLocaleString("es-CL")}`)
  console.log(`Pendiente:           $${totalPendiente.toLocaleString("es-CL")}`)
  console.log(`Pagado + Pendiente:  $${sumaPP.toLocaleString("es-CL")}`)
  console.log(`Diferencia vs Fact:  $${diff.toLocaleString("es-CL")}\n`)

  console.log(`=== Servicios sospechosos (${sospechosos.length}) ===`)
  if (sospechosos.length === 0) {
    console.log("Ninguno encontrado. La diferencia debe venir de cerrados con saldo > 0 o redondeos.")
  }
  for (const s of sospechosos) {
    console.log(
      `[${s.tipo}] OT#${s.numero_ot} ${s.patente} ${s.cliente} | estado=${s.estado} ` +
      `| monto=$${Number(s.monto).toLocaleString("es-CL")} ` +
      `anticipo=$${Number(s.anticipo).toLocaleString("es-CL")} ` +
      `saldo=$${Number(s.saldo).toLocaleString("es-CL")} ` +
      `| aporta a diff: $${Number(s.aporta_diff).toLocaleString("es-CL")}`
    )
  }

  const sumaSospechosos = sospechosos.reduce((s, x) => s + Number(x.aporta_diff), 0)
  console.log(`\nSuma 'aporta a diff' de sospechosos: $${sumaSospechosos.toLocaleString("es-CL")}`)

  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
