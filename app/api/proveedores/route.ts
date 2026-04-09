import { NextResponse } from "next/server"
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from "@/lib/database"

export async function GET() {
  try {
    const data = await getProveedores()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Proveedores GET error:", error)
    return NextResponse.json({ error: "Error cargando proveedores" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    if (!data.nombre?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }
    const proveedor = await createProveedor(data)
    return NextResponse.json(proveedor)
  } catch (error) {
    console.error("Proveedores POST error:", error)
    return NextResponse.json({ error: "Error creando proveedor" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...data } = await request.json()
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    const proveedor = await updateProveedor(id, data)
    return NextResponse.json(proveedor)
  } catch (error) {
    console.error("Proveedores PUT error:", error)
    return NextResponse.json({ error: "Error actualizando proveedor" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    await deleteProveedor(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Proveedores DELETE error:", error)
    return NextResponse.json({ error: "Error eliminando proveedor" }, { status: 500 })
  }
}
