import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export type Role = "admin" | "supervisor" | "operador"

async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    },
  )
}

/**
 * Devuelve `{ userId, role }` de la sesión actual leída desde las cookies, o
 * `null` si no hay sesión válida. El rol sale de la tabla `user_roles`.
 */
export async function getSessionUser(): Promise<{ userId: string; role: Role | null } | null> {
  try {
    const supabase = await getServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single()
    return { userId: user.id, role: (data?.role as Role) ?? null }
  } catch {
    return null
  }
}

/** true si el usuario actual es admin. Mantiene la firma usada por rutas existentes. */
export async function isAdminUser(): Promise<boolean> {
  const session = await getSessionUser()
  return session?.role === "admin"
}

/**
 * Guarda de autorización para route handlers. Úsese al inicio del handler:
 *
 *   const denied = await requireRole(["admin", "operador"])
 *   if (denied) return denied
 *
 * - Sin `roles` (o lista vacía): solo exige sesión iniciada (cualquier rol).
 * - Con `roles`: además exige que el rol del usuario esté en la lista.
 *
 * Devuelve un `NextResponse` 401 (sin sesión) o 403 (rol no permitido) cuando
 * se debe rechazar, o `null` cuando el acceso está permitido.
 */
export async function requireRole(roles?: Role[]): Promise<NextResponse | null> {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (roles && roles.length > 0 && (!session.role || !roles.includes(session.role))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}
