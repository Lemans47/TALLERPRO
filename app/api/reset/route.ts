import { NextResponse } from "next/server"
import postgres from "postgres"

export async function DELETE() {
  try {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
    if (!connectionString) throw new Error("Database connection string not found")

    const sql = postgres(connectionString, { ssl: "require", max: 1, prepare: false })
    await sql`TRUNCATE TABLE servicios, presupuestos, gastos RESTART IDENTITY CASCADE`
    await sql.end()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reset DELETE error:", error)
    return NextResponse.json({ error: "Error al borrar los datos" }, { status: 500 })
  }
}
