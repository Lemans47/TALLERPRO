import { NextResponse } from "next/server"
import { getEmpleados, createEmpleado, updateEmpleado, deleteEmpleado } from "@/lib/database"

export async function GET() {
  try {
    const data = await getEmpleados()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Error loading empleados" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await createEmpleado(data)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: "Error creating empleado" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...data } = await request.json()
    const result = await updateEmpleado(id, data)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: "Error updating empleado" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await deleteEmpleado(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Error deleting empleado" }, { status: 500 })
  }
}
