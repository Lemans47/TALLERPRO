// Audit: muestra servicios con iva='con' y su fecha_facturacion
// Run: npx tsx scripts/audit-fecha-facturacion.ts

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

const sql = postgres(process.env.DATABASE_URL || "", { ssl: "require", prepare: false })

async function main() {
  const col: any[] = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'servicios' AND column_name = 'fecha_facturacion'
  `
  console.log("Column exists:", col.length > 0 ? `YES (${col[0].data_type}, nullable=${col[0].is_nullable})` : "NO")

  const rows: any[] = await sql`
    SELECT numero_ot, patente, cliente, estado, fecha_ingreso::text AS fecha_ingreso, fecha_facturacion::text AS fecha_facturacion
    FROM servicios
    WHERE iva = 'con'
    ORDER BY fecha_ingreso DESC
    LIMIT 30
  `
  console.log(`\nServicios con iva='con' (${rows.length}):`)
  for (const r of rows) {
    const ot = r.numero_ot != null ? `OT-${String(r.numero_ot).padStart(4, "0")}` : "(s/OT)"
    console.log(`  ${ot} | ${String(r.patente).padEnd(10)} | ${String(r.estado).padEnd(22)} | ingreso=${r.fecha_ingreso} | fact=${r.fecha_facturacion || "NULL"}`)
  }

  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
