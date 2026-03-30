import { NextResponse } from "next/server"
import { getPagosEmpleadosByMonth, upsertPagoEmpleado, deletePagoEmpleado, createGasto } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get("year"))
    const month = Number(searchParams.get("month"))
    const data = await getPagosEmpleadosByMonth(year, month)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Error loading pagos" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await upsertPagoEmpleado(data)

    // If marking as paid, auto-create a gasto entry
    if (data.pagado && data.crear_gasto) {
      const fecha = data.fecha_pago || new Date().toISOString().split("T")[0]
      await createGasto({
        fecha,
        categoria: "Sueldos",
        descripcion: `Sueldo ${data.empleado_nombre || ""} ${String(data.mes).padStart(2,"0")}/${data.año}`,
        monto: data.monto,
      })
    }

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: "Error saving pago" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await deletePagoEmpleado(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Error deleting pago" }, { status: 500 })
  }
}
