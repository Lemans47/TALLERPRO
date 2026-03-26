import { NextResponse } from "next/server"
import { getServicios, getGastos } from "@/lib/database"

export async function GET() {
  try {
    const [servicios, gastos] = await Promise.all([getServicios(), getGastos()])

    return NextResponse.json({ servicios, gastos })
  } catch (error) {
    console.error("Chart API error:", error)
    return NextResponse.json({ error: "Error loading chart data" }, { status: 500 })
  }
}
