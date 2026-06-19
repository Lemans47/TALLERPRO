import { NextResponse } from "next/server"
import { getGastos, getGastosByMonth, createGasto, updateGasto, deleteGasto } from "@/lib/database"
import { parseYearMonth, montoValido } from "@/lib/utils"
import { requireRole } from "@/lib/auth-server"

// Gastos = sección visible para admin y operador (no supervisor).
const ROLES = ["admin", "operador"] as const

export async function GET(request: Request) {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const ym = parseYearMonth(searchParams)

    const gastos = ym
      ? await getGastosByMonth(ym.year, ym.month)
      : await getGastos()

    return NextResponse.json(gastos)
  } catch (error) {
    console.error("Gastos GET error:", error)
    return NextResponse.json({ error: "Error loading gastos" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
    const data = await request.json()
    if (!montoValido(data.monto)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
    }
    const gasto = await createGasto(data)
    return NextResponse.json(gasto)
  } catch (error) {
    console.error("Gastos POST error:", error)
    return NextResponse.json({ error: "Error creating gasto" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
    const data = await request.json()
    const { id, ...updateData } = data
    if (!montoValido(updateData.monto)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
    }
    const gasto = await updateGasto(id, updateData)
    return NextResponse.json(gasto)
  } catch (error) {
    console.error("Gastos PUT error:", error)
    return NextResponse.json({ error: "Error updating gasto" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireRole([...ROLES])
    if (denied) return denied
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
