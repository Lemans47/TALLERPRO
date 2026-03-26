import { NextResponse } from "next/server"
import { getPrecioPintura, updatePrecioPintura, initPrecioPintura } from "@/lib/database"

export async function GET() {
  try {
    let precio = await getPrecioPintura()
    if (!precio) {
      precio = await initPrecioPintura()
    }
    return NextResponse.json(precio || { precio_por_pieza: 0 })
  } catch (error: any) {
    console.error("Error getting precio pintura:", error)
    return NextResponse.json({ error: "Error loading precio pintura" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { precio_por_pieza } = body
    const updated = await updatePrecioPintura(precio_por_pieza)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating precio pintura:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
