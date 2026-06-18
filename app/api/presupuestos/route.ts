import { NextResponse } from "next/server"
import {
  getPresupuestos,
  getPresupuestosByMonth,
  getPresupuestosNoLeidos,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  convertPresupuestoToServicio,
} from "@/lib/database"
import { parseYearMonth } from "@/lib/utils"
import { requireRole } from "@/lib/auth-server"

export async function GET(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const { searchParams } = new URL(request.url)

    if (searchParams.get("no_leidas") === "1") {
      const data = await getPresupuestosNoLeidos()
      return NextResponse.json(data)
    }

    const ym = parseYearMonth(searchParams)
    const presupuestos = ym
      ? await getPresupuestosByMonth(ym.year, ym.month)
      : await getPresupuestos()

    return NextResponse.json(presupuestos)
  } catch (error) {
    console.error("Presupuestos GET error:", error)
    return NextResponse.json({ error: "Error loading presupuestos" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    const servicio = await convertPresupuestoToServicio(id)

    return NextResponse.json({
      success: true,
      servicio,
      message: "Presupuesto convertido a servicio exitosamente",
    })
  } catch (error) {
    console.error("Presupuestos PATCH (convert) error:", error)
    return NextResponse.json({ error: "Error converting presupuesto" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // El formulario público usa /api/solicitudes; aquí exigimos sesión.
    const denied = await requireRole()
    if (denied) return denied
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
    const denied = await requireRole()
    if (denied) return denied
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
    const denied = await requireRole()
    if (denied) return denied
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
