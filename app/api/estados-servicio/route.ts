import { NextResponse } from "next/server"
import {
  getEstadosServicio,
  createEstadoServicio,
  updateEstadoServicio,
  deleteEstadoServicio,
  type EstadoTipo,
} from "@/lib/database"
import { isAdminUser } from "@/lib/auth-server"

const TIPOS_VALIDOS: EstadoTipo[] = ["activo", "por_cobrar", "cerrado"]

export async function GET() {
  try {
    const estados = await getEstadosServicio()
    return NextResponse.json(estados)
  } catch (error: any) {
    console.error("Error fetching estados_servicio:", error)
    return NextResponse.json({ error: "Error loading estados" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const body = await request.json()
    const { nombre, tipo, orden } = body
    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: "El nombre del estado es requerido" }, { status: 400 })
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
    }
    const nuevo = await createEstadoServicio(nombre.trim(), tipo, typeof orden === "number" ? orden : undefined)
    return NextResponse.json(nuevo)
  } catch (error: any) {
    console.error("Error creating estado_servicio:", error)
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Ya existe un estado con ese nombre" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || "Error al crear el estado" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const body = await request.json()
    const { id, nombre, tipo, orden, visible } = body
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
    }
    const updated = await updateEstadoServicio(id, {
      nombre: typeof nombre === "string" ? nombre.trim() : undefined,
      tipo,
      orden: typeof orden === "number" ? orden : undefined,
      visible: typeof visible === "boolean" ? visible : undefined,
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating estado_servicio:", error)
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Ya existe un estado con ese nombre" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || "Error al actualizar el estado" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const migrarA = searchParams.get("migrarA") || undefined
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    const result = await deleteEstadoServicio(id, migrarA)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    if (error?.code === "HAS_SERVICIOS") {
      return NextResponse.json(
        {
          error: "HAS_SERVICIOS",
          message: `${error.count} servicios usan el estado "${error.estado}". Indica un estado destino para migrarlos.`,
          count: error.count,
          estado: error.estado,
        },
        { status: 409 },
      )
    }
    console.error("Error deleting estado_servicio:", error)
    return NextResponse.json({ error: error.message || "Error al borrar el estado" }, { status: 500 })
  }
}
