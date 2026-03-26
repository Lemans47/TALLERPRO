import { NextResponse } from "next/server"
import { getPiezasPintura, createPiezaPintura, updatePiezaPintura, deletePiezaPintura } from "@/lib/database"

export async function GET() {
  try {
    const piezas = await getPiezasPintura()
    return NextResponse.json(piezas || [])
  } catch (error: any) {
    console.error("Error fetching piezas pintura:", error)
    return NextResponse.json({ error: "Error loading piezas pintura" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nombre, cantidad_piezas } = body

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: "El nombre de la pieza es requerido" }, { status: 400 })
    }

    const nuevaPieza = await createPiezaPintura(nombre, cantidad_piezas || 1)
    return NextResponse.json(nuevaPieza)
  } catch (error: any) {
    console.error("[v0] Error creating pieza pintura:", error.message, error.code)
    // Si es un error de conexión, retornar respuesta genérica
    return NextResponse.json(
      { error: "No se pudo guardar la pieza. Verifica la conexión a la base de datos." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, cantidad_piezas } = body
    const updated = await updatePiezaPintura(id, cantidad_piezas)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating pieza pintura:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }
    await deletePiezaPintura(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting pieza pintura:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
