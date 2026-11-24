import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getSQL } from "@/lib/database"

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
    // getUser() (NO getSession()) valida el token contra Supabase Auth: esa es
    // la verificación de identidad. El rol se lee por la conexión directa a
    // Postgres en vez de PostgREST: ahorra un round-trip HTTP por request y no
    // depende del schema cache de PostgREST. Es seguro porque corre solo en el
    // servidor, el user_id sale del token ya verificado y va parametrizado.
    // Sin caché a propósito: quitar un rol debe aplicar en la próxima request.
    const rows = await getSQL()`SELECT role FROM user_roles WHERE user_id = ${user.id} LIMIT 1`
    return { userId: user.id, role: (rows[0]?.role as Role) ?? null }
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
