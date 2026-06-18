import { NextResponse } from "next/server"
import { deduplicarClientes } from "@/lib/database"
import { requireRole } from "@/lib/auth-server"

export async function POST() {
  try {
    const denied = await requireRole(["admin"])
    if (denied) return denied
    const deleted = await deduplicarClientes()
    return NextResponse.json({ deleted })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Error al deduplicar" }, { status: 500 })
  }
}
