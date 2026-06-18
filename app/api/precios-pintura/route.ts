import { NextResponse } from "next/server"
import { getPrecioPintura, updatePrecioPintura, initPrecioPintura, getPromedioMaterialesMesAnterior } from "@/lib/database"
import { requireRole } from "@/lib/auth-server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Lectura: cualquier sesión (el formulario de servicios usa el precio).
    const denied = await requireRole()
    if (denied) return denied
    let precio = await getPrecioPintura()
    if (!precio) {
      precio = await initPrecioPintura()
    }
    const promedio = await getPromedioMaterialesMesAnterior()
    return NextResponse.json({
      ...(precio || { precio_por_pieza: 0 }),
      promedio_mes_anterior: promedio,
    })
  } catch (error: any) {
    console.error("Error getting precio pintura:", error)
    return NextResponse.json({ error: "Error loading precio pintura" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    // Escritura: solo admin (configuración).
    const denied = await requireRole(["admin"])
    if (denied) return denied
    const body = await request.json()
    const { precio_por_pieza, mano_obra_default, materiales_default } = body
    const updated = await updatePrecioPintura({ precio_por_pieza, mano_obra_default, materiales_default })
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating precio pintura:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
