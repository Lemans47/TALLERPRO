import { NextResponse } from "next/server"
import { getEmpleados, createEmpleado, updateEmpleado, deleteEmpleado } from "@/lib/database"
import { requireRole } from "@/lib/auth-server"

// Empleados = sección visible para admin y supervisor (no operador).
const ROLES = ["admin", "supervisor"] as const

export async function GET() {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
    const data = await getEmpleados()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Error loading empleados" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
    const data = await request.json()
    const result = await createEmpleado(data)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: "Error creating empleado" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
    const { id, ...data } = await request.json()
    const result = await updateEmpleado(id, data)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: "Error updating empleado" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await deleteEmpleado(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Error deleting empleado" }, { status: 500 })
  }
}
