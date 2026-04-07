import { NextResponse } from "next/server"
import { getServicios, getGastos, getEmpleados } from "@/lib/database"

export async function GET() {
  try {
    const [servicios, gastos, empleados] = await Promise.all([getServicios(), getGastos(), getEmpleados()])

    return NextResponse.json({ servicios, gastos, empleados })
  } catch (error) {
    console.error("Chart API error:", error)
    return NextResponse.json({ error: "Error loading chart data" }, { status: 500 })
  }
}
