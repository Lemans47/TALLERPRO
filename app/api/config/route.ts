import { NextResponse } from "next/server"

export async function GET() {
  const url = process.env.DATABASE_URL || ""
  let provider = "PostgreSQL"
  if (url.includes("supabase.com")) provider = "Supabase (PostgreSQL)"
  else if (url.includes("neon.tech")) provider = "Neon (PostgreSQL Serverless)"
  else if (url.includes("pooler.supabase.com")) provider = "Supabase (PostgreSQL)"

  return NextResponse.json({ provider })
}
