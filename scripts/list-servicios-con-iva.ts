// Lista servicios del mes con iva='con' — audita debito IVA
// Run: npx tsx scripts/list-servicios-con-iva.ts <year> <month>

import postgres from "postgres"
import * as fs from "fs"
import * as path from "path"

const envPath = path.resolve(".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
    if (m) {
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
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

  const rows: any[] = await sql`
    SELECT id, numero_ot, patente, cliente, estado, iva,
           monto_total::numeric AS monto_total,
           monto_total_sin_iva::numeric AS monto_neto,
           fecha_ingreso
    FROM servicios
    WHERE fecha_ingreso >= ${startDate} AND fecha_ingreso <= ${endDate}
      AND iva = 'con'
      AND monto_total_sin_iva::numeric > 0
    ORDER BY fecha_ingreso DESC
  `

  console.log(`\nServicios CON IVA en ${year}-${String(month).padStart(2, "0")}: ${rows.length}\n`)

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL")
  let sumBruto = 0, sumNeto = 0, sumIva = 0

  console.log("OT   | Patente  | Cliente                     | Estado              | Neto         | Total        | IVA         | Fecha")
  console.log("-----+----------+-----------------------------+---------------------+--------------+--------------+-------------+-----------")
  for (const s of rows) {
    const neto = Number(s.monto_neto)
    const bruto = Number(s.monto_total)
    const iva = bruto - neto
    sumBruto += bruto; sumNeto += neto; sumIva += iva
    const ot = s.numero_ot != null ? `OT-${String(s.numero_ot).padStart(4, "0")}` : "(s/OT)"
    const flag = Math.abs(iva - neto * 0.19) > 2 ? " ⚠" : ""
    console.log(
      `${ot.padEnd(8)} | ${String(s.patente).padEnd(8)} | ${String(s.cliente || "-").slice(0, 27).padEnd(27)} | ${String(s.estado).padEnd(19)} | ${fmt(neto).padStart(12)} | ${fmt(bruto).padStart(12)} | ${fmt(iva).padStart(11)}${flag} | ${String(s.fecha_ingreso).slice(0, 10)}`,
    )
  }
  console.log("-----+----------+-----------------------------+---------------------+--------------+--------------+-------------+-----------")
  console.log(`TOTALES                                                                    ${fmt(sumNeto).padStart(12)} | ${fmt(sumBruto).padStart(12)} | ${fmt(sumIva).padStart(11)}`)
  console.log(`\nRatio IVA/Bruto: ${sumBruto > 0 ? (sumIva / sumBruto * 100).toFixed(2) : "0"}% (esperado 15.97%)`)

  const sospechosos = rows.filter((s) => Math.abs((Number(s.monto_total) - Number(s.monto_neto)) - Number(s.monto_neto) * 0.19) > 2)
  if (sospechosos.length) {
    console.log(`\n⚠  ${sospechosos.length} servicio(s) con IVA inconsistente (bruto-neto ≠ neto*0.19):`)
    for (const s of sospechosos) {
      console.log(`   OT-${String(s.numero_ot ?? "?").padStart(4, "0")} ${s.patente}: neto=${fmt(Number(s.monto_neto))}, bruto=${fmt(Number(s.monto_total))}, iva calc=${fmt(Number(s.monto_total) - Number(s.monto_neto))}, esperado=${fmt(Number(s.monto_neto) * 0.19)}`)
    }
  }

  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
