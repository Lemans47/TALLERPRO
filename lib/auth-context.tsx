"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export type Role = "admin" | "supervisor" | "operador" | null

interface AuthContextType {
  user: User | null
  role: Role
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)
  // Track which userId already has its role loaded to avoid wiping it on token refresh
  const roleLoadedForRef = useRef<string | null>(null)
  // Track which userId tiene un fetch in-flight para descartar resultados
  // que llegan después de un cambio de sesión.
  const inFlightUserRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  // Timer del reintento de carga de rol (backoff), para poder cancelarlo.
  const roleRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = createClient()

  const fetchRole = async (userId: string): Promise<Role> => {
    // Retry up to 2 times with a short timeout
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
        const query = supabase.from("user_roles").select("role").eq("user_id", userId).single()
        const result = await Promise.race([query, timeout])
        if (!result) continue
        const r = ((result as any).data?.role as Role) || null
        if (r) return r
      } catch {
        // retry
      }
    }
    return null
  }

  const loadRoleInBackground = (userId: string, attempt = 0) => {
    inFlightUserRef.current = userId
    fetchRole(userId).then((r) => {
      // Descartar si el componente se desmontó o si la sesión cambió mientras
      // el fetch estaba en vuelo (otro login pisó este userId).
      if (!mountedRef.current) return
      if (inFlightUserRef.current !== userId) return
      if (r) {
        roleLoadedForRef.current = userId
        setRole(r)
        return
      }
      // El rol no cargó (timeout/red intermitente). Reintentar con backoff para
      // que el menú no quede vacío indefinidamente. También reintentamos al
      // recuperar el foco de la ventana (ver listener en el efecto).
      if (attempt < 6) {
        const delay = Math.min(20_000, 1_500 * 2 ** attempt)
        if (roleRetryRef.current) clearTimeout(roleRetryRef.current)
        roleRetryRef.current = setTimeout(() => {
          if (mountedRef.current && inFlightUserRef.current === userId && roleLoadedForRef.current !== userId) {
            loadRoleInBackground(userId, attempt + 1)
          }
        }, delay)
      }
    })
  }

  useEffect(() => {
    mountedRef.current = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mountedRef.current) return
        if (session?.user) {
          setUser(session.user)
          // Don't block loading on role fetch — load role in background
          loadRoleInBackground(session.user.id)
        }
      } catch (e) {
        console.error("Auth init error:", e)
      } finally {
        // Release loading immediately after session check, not after role fetch
        if (mountedRef.current) setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mountedRef.current) return
      if (session?.user) {
        setUser(session.user)
        if (roleLoadedForRef.current !== session.user.id) {
          loadRoleInBackground(session.user.id)
        }
      } else {
        inFlightUserRef.current = null
        setUser(null)
        setRole(null)
        roleLoadedForRef.current = null
      }
    })

    // Si el rol no alcanzó a cargar (red intermitente), reintentar al volver el
    // foco a la pestaña para que el menú no quede vacío.
    const onFocus = () => {
      const uid = inFlightUserRef.current
      if (uid && roleLoadedForRef.current !== uid) {
        loadRoleInBackground(uid, 0)
      }
    }
    window.addEventListener("focus", onFocus)

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      window.removeEventListener("focus", onFocus)
      if (roleRetryRef.current) clearTimeout(roleRetryRef.current)
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
