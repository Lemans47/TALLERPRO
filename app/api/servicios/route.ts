import { NextResponse } from "next/server"
import { getServicios, getServiciosByMonth, createServicio, updateServicio, deleteServicio } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const month = searchParams.get("month")

    let servicios
    if (year && month) {
      servicios = await getServiciosByMonth(Number.parseInt(year), Number.parseInt(month))
    } else {
      servicios = await getServicios()
    }

    return NextResponse.json(servicios)
  } catch (error) {
    console.error("Servicios GET error:", error)
    return NextResponse.json({ error: "Error loading servicios" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const servicio = await createServicio(data)
    return NextResponse.json(servicio)
  } catch (error) {
    console.error("Servicios POST error:", error)
    return NextResponse.json({ error: "Error creating servicio" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, ...updateData } = data
    const servicio = await updateServicio(id, updateData)
    return NextResponse.json(servicio)
  } catch (error) {
    console.error("Servicios PUT error:", error)
    return NextResponse.json({ error: "Error updating servicio" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }
    await deleteServicio(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Servicios DELETE error:", error)
    return NextResponse.json({ error: "Error deleting servicio" }, { status: 500 })
  }
}
