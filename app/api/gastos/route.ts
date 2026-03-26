import { NextResponse } from "next/server"
import { getGastos, getGastosByMonth, createGasto, updateGasto, deleteGasto } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const month = searchParams.get("month")

    let gastos
    if (year && month) {
      gastos = await getGastosByMonth(Number.parseInt(year), Number.parseInt(month))
    } else {
      gastos = await getGastos()
    }

    return NextResponse.json(gastos)
  } catch (error) {
    console.error("Gastos GET error:", error)
    return NextResponse.json({ error: "Error loading gastos" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const gasto = await createGasto(data)
    return NextResponse.json(gasto)
  } catch (error) {
    console.error("Gastos POST error:", error)
    return NextResponse.json({ error: "Error creating gasto" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, ...updateData } = data
    const gasto = await updateGasto(id, updateData)
    return NextResponse.json(gasto)
  } catch (error) {
    console.error("Gastos PUT error:", error)
    return NextResponse.json({ error: "Error updating gasto" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }
    await deleteGasto(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Gastos DELETE error:", error)
    return NextResponse.json({ error: "Error deleting gasto" }, { status: 500 })
  }
}
