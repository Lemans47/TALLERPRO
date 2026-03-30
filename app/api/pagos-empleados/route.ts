import { NextResponse } from "next/server"
import { getAbonosByMonth, createAbono, deleteAbono, createGasto } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get("year"))
    const month = Number(searchParams.get("month"))
    const data = await getAbonosByMonth(year, month)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Error loading abonos" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const abono = await createAbono({
      empleado_id: data.empleado_id,
      mes: data.mes,
      año: data.año,
      monto: data.monto,
      fecha: data.fecha,
      notas: data.notas,
    })
    // Auto-create gasto entry
    await createGasto({
      fecha: data.fecha,
      categoria: "Sueldos",
      descripcion: `Abono sueldo ${data.empleado_nombre || ""} ${String(data.mes).padStart(2, "0")}/${data.año}`,
      monto: data.monto,
    })
    return NextResponse.json(abono)
  } catch (e) {
    return NextResponse.json({ error: "Error creating abono" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await deleteAbono(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Error deleting abono" }, { status: 500 })
  }
}
