import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-server"

export async function GET() {
  const denied = await requireRole()
  if (denied) return denied
  const url = process.env.DATABASE_URL || ""
  let provider = "PostgreSQL"
  if (url.includes("supabase.com")) provider = "Supabase (PostgreSQL)"

  return NextResponse.json({ provider })
}
