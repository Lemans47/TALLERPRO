import { NextRequest, NextResponse } from "next/server"
import { getHistorialByPatente, getHistorialByCliente } from "@/lib/database"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patente = searchParams.get("patente")
  const cliente = searchParams.get("cliente")
  try {
    if (patente) {
      const data = await getHistorialByPatente(patente)
      return NextResponse.json(data)
    }
    if (cliente) {
      const data = await getHistorialByCliente(cliente)
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: "Falta patente o cliente" }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 })
  }
}
