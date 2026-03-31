import { NextResponse } from "next/server"
import { deduplicarClientes } from "@/lib/database"

export async function POST() {
  try {
    const deleted = await deduplicarClientes()
    return NextResponse.json({ deleted })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Error al deduplicar" }, { status: 500 })
  }
}
