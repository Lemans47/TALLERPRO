import { NextResponse } from "next/server"
import { getServiciosByMonth, getGastosByMonth, getEmpleados } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = Number.parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = Number.parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())

    const [servicios, gastos, empleados] = await Promise.all([
      getServiciosByMonth(year, month),
      getGastosByMonth(year, month),
      getEmpleados(),
    ])

    return NextResponse.json({ servicios, gastos, empleados })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json({ error: "Error loading dashboard data" }, { status: 500 })
  }
}
