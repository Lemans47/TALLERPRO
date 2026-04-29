import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"
import { isAdminUser } from "@/lib/auth-server"

export async function GET() {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const db = getSQL()
    const rows = await db`
      SELECT id, categoria, descripcion, monto, fecha
      FROM gastos
      WHERE categoria = 'Sueldos'
      ORDER BY fecha ASC
    `
    const total = rows.reduce((s: number, g: any) => s + Number(g.monto || 0), 0)
    return NextResponse.json({ count: rows.length, total, rows })
  } catch (e) {
    console.error("cleanup-sueldos GET error:", e)
    return NextResponse.json({ error: "Error consultando registros" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const db = getSQL()
    const deleted = await db`
      DELETE FROM gastos
      WHERE categoria = 'Sueldos'
      RETURNING id, descripcion, monto, fecha
    `
    const total = deleted.reduce((s: number, g: any) => s + Number(g.monto || 0), 0)
    return NextResponse.json({ deleted: deleted.length, total, rows: deleted })
  } catch (e) {
    console.error("cleanup-sueldos DELETE error:", e)
    return NextResponse.json({ error: "Error borrando registros" }, { status: 500 })
  }
}
