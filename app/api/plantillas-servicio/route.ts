import { NextResponse } from "next/server"
import { getPlantillasServicio, createPlantillaServicio, deletePlantillaServicio } from "@/lib/database"

export async function GET() {
  try {
    const data = await getPlantillasServicio()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching plantillas:", error)
    return NextResponse.json({ error: "Error fetching plantillas" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }
    const data = await createPlantillaServicio({ nombre: body.nombre, cobros: body.cobros ?? [], costos: body.costos ?? [] })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error creating plantilla:", error)
    return NextResponse.json({ error: "Error creating plantilla" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    await deletePlantillaServicio(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting plantilla:", error)
    return NextResponse.json({ error: "Error deleting plantilla" }, { status: 500 })
  }
}
