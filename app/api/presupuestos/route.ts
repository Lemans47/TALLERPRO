import { NextResponse } from "next/server"
import {
  getPresupuestos,
  getPresupuestosByMonth,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  getPresupuestoById,
  createServicio,
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

      // Obtener el presupuesto
      const presupuesto = await getPresupuestoById(id)
      if (!presupuesto) {
        return NextResponse.json({ error: "Presupuesto not found" }, { status: 404 })
      }

      // Crear un servicio basado en el presupuesto
      const servicioData = {
        fecha_ingreso: presupuesto.fecha_ingreso,
        patente: presupuesto.patente,
        marca: presupuesto.marca,
        modelo: presupuesto.modelo,
        color: presupuesto.color || "",
        kilometraje: presupuesto.kilometraje || null,
        año: presupuesto.año || null,
        cliente: presupuesto.cliente,
        telefono: presupuesto.telefono || "",
        observaciones: presupuesto.observaciones || "",
        estado: "En Cola",
        iva: presupuesto.iva || "sin",
        anticipo: 0,
        saldo_pendiente: presupuesto.monto_total || 0,
        monto_total: presupuesto.monto_total || 0,
        monto_total_sin_iva: presupuesto.monto_total_sin_iva || 0,
        mano_obra_pintura: presupuesto.mano_obra_pintura || 0,
        cobros: presupuesto.cobros || [],
        costos: presupuesto.costos || [],
        piezas_pintura: presupuesto.piezas_pintura || [],
        observaciones_checkboxes: presupuesto.observaciones_checkboxes || [],
        fotos_ingreso: [],
        fotos_entrega: [],
      }

      const servicio = await createServicio(servicioData)
      await deletePresupuesto(id)

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
