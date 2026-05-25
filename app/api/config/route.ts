import { NextResponse } from "next/server"

export async function GET() {
  const url = process.env.DATABASE_URL || ""
  let provider = "PostgreSQL"
  if (url.includes("supabase.com")) provider = "Supabase (PostgreSQL)"

  return NextResponse.json({ provider })
}
