import { NextResponse } from "next/server"
import postgres from "postgres"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function isAdminUser(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single()
    return data?.role === "admin"
  } catch {
    return false
  }
}

export async function DELETE() {
  try {
    const isAdmin = await isAdminUser()
    if (!isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

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
