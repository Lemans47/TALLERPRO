import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  try {
    const admin = getAdminClient()
    // List all auth users
    const { data: { users }, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) throw usersError
    // List all roles
    const { data: roles, error: rolesError } = await admin.from("user_roles").select("user_id, role")
    if (rolesError) throw rolesError

    const roleMap: Record<string, string> = {}
    for (const r of roles || []) roleMap[r.user_id] = r.role

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: roleMap[u.id] || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, role } = await req.json()
    if (!userId || !role) return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
    const admin = getAdminClient()
    // Upsert role
    const { error } = await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id" })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
