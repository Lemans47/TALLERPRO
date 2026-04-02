import { NextResponse } from "next/server"
import {
  getPlantillas,
  createPlantilla,
  updatePlantilla,
  deletePlantilla,
  getGastosByMonth,
  createGasto,
} from "@/lib/database"

export async function GET() {
  try {
    const data = await getPlantillas()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Error loading plantillas" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")

    // Generar gastos del mes desde plantillas
    if (action === "generar") {
      const { year, month } = await request.json()
      const plantillas = await getPlantillas()
      const existentes = await getGastosByMonth(year, month)
      const existentesFijos = existentes.filter((g) => g.categoria === "Gastos Fijos")

      const creados: string[] = []
      for (const p of plantillas) {
        const yaExiste = existentesFijos.some(
          (g) => g.descripcion.toLowerCase() === p.descripcion.toLowerCase()
        )
        if (!yaExiste && p.monto_estimado > 0) {
          await createGasto({
            fecha: `${year}-${String(month).padStart(2, "0")}-01`,
            categoria: "Gastos Fijos",
            descripcion: p.descripcion,
            monto: p.monto_estimado,
          })
          creados.push(p.descripcion)
        }
      }
      return NextResponse.json({ creados })
    }

    // Copiar gastos fijos del mes anterior
    if (action === "copiar") {
      const { year, month } = await request.json()
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const anteriores = await getGastosByMonth(prevYear, prevMonth)
      const fijosPrevios = anteriores.filter((g) => g.categoria === "Gastos Fijos")

      const existentes = await getGastosByMonth(year, month)
      const existentesFijos = existentes.filter((g) => g.categoria === "Gastos Fijos")

      const creados: string[] = []
      for (const g of fijosPrevios) {
        const yaExiste = existentesFijos.some(
          (e) => e.descripcion.toLowerCase() === g.descripcion.toLowerCase()
        )
        if (!yaExiste) {
          await createGasto({
            fecha: `${year}-${String(month).padStart(2, "0")}-01`,
            categoria: "Gastos Fijos",
            descripcion: g.descripcion,
            monto: g.monto,
          })
          creados.push(g.descripcion)
        }
      }
      return NextResponse.json({ creados })
    }

    // Crear plantilla nueva
    const body = await request.json()
    const data = await createPlantilla({ descripcion: body.descripcion, monto_estimado: body.monto_estimado })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Error en operación" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    const body = await request.json()
    const data = await updatePlantilla(id, { descripcion: body.descripcion, monto_estimado: body.monto_estimado })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Error updating plantilla" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await deletePlantilla(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Error deleting plantilla" }, { status: 500 })
  }
}
