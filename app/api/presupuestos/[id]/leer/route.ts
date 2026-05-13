import { NextResponse } from "next/server"
import { markPresupuestoLeido } from "@/lib/database"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }
    const presupuesto = await markPresupuestoLeido(id)
    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error("mark leido error:", error)
    return NextResponse.json({ error: "Error marking as read" }, { status: 500 })
  }
}
