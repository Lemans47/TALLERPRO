import { NextResponse } from "next/server"
import { getClientes, createCliente, updateCliente, deleteCliente, getVehiculosConCliente } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const withVehiculos = searchParams.get("withVehiculos")

    if (withVehiculos) {
      const data = await getVehiculosConCliente()
      return NextResponse.json(data)
    }

    const clientes = await getClientes()
    return NextResponse.json(clientes)
  } catch (error) {
    console.error("Clientes GET error:", error)
    return NextResponse.json({ error: "Error loading clientes" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const cliente = await createCliente(data)
    return NextResponse.json(cliente)
  } catch (error) {
    console.error("Clientes POST error:", error)
    return NextResponse.json({ error: "Error creating cliente" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, ...updateData } = data
    const cliente = await updateCliente(id, updateData)
    return NextResponse.json(cliente)
  } catch (error) {
    console.error("Clientes PUT error:", error)
    return NextResponse.json({ error: "Error updating cliente" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await deleteCliente(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clientes DELETE error:", error)
    return NextResponse.json({ error: "Error deleting cliente" }, { status: 500 })
  }
}
