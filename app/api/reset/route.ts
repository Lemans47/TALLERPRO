import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function DELETE() {
  try {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.NEON_DATABASE_URL ||
      process.env.POSTGRES_URL_NON_POOLING

    if (!connectionString) {
      throw new Error("Database connection string not found")
    }

    const sql = neon(connectionString)
    await sql`TRUNCATE TABLE servicios, presupuestos, gastos RESTART IDENTITY CASCADE`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reset DELETE error:", error)
    return NextResponse.json({ error: "Error al borrar los datos" }, { status: 500 })
  }
}
