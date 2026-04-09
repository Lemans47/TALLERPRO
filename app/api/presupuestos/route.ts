import { NextResponse } from "next/server"
import {
  getPresupuestos,
  getPresupuestosByMonth,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  convertPresupuestoToServicio,
} from "@/lib/database"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const month = searchParams.get("month")
    const action = searchParams.get("action")

    if (action === "convert") {
      const id = searchParams.get("id")
      if (!id) {
        return NextResponse.json({ error: "ID required" }, { status: 400 })
      }

      // Convertir presupuesto a servicio de forma atómica (transacción)
      // convertPresupuestoToServicio lanza error si el presupuesto no existe
      const servicio = await convertPresupuestoToServicio(id)

      return NextResponse.json({
        success: true,
        servicio,
        message: "Presupuesto convertido a servicio exitosamente",
      })
    }

    let presupuestos
    if (year && month) {
      presupuestos = await getPresupuestosByMonth(Number.parseInt(year), Number.parseInt(month))
    } else {
      presupuestos = await getPresupuestos()
    }

    return NextResponse.json(presupuestos)
  } catch (error) {
    console.error("Presupuestos GET error:", error)
    return NextResponse.json({ error: "Error loading presupuestos" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const presupuesto = await createPresupuesto(data)
    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error("Presupuestos POST error:", error)
    return NextResponse.json({ error: "Error creating presupuesto" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, ...updateData } = data
    const presupuesto = await updatePresupuesto(id, updateData)
    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error("Presupuestos PUT error:", error)
    return NextResponse.json({ error: "Error updating presupuesto" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }
    await deletePresupuesto(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Presupuestos DELETE error:", error)
    return NextResponse.json({ error: "Error deleting presupuesto" }, { status: 500 })
  }
}
