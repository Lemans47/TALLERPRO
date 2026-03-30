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

  const loadRoleInBackground = (userId: string) => {
    fetchRole(userId).then((r) => {
      if (r) {
        roleLoadedForRef.current = userId
        setRole(r)
      }
    })
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          // Don't block loading on role fetch — load role in background
          loadRoleInBackground(session.user.id)
        }
      } catch (e) {
        console.error("Auth init error:", e)
      } finally {
        // Release loading immediately after session check, not after role fetch
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        if (roleLoadedForRef.current !== session.user.id) {
          loadRoleInBackground(session.user.id)
        }
      } else {
        setUser(null)
        setRole(null)
        roleLoadedForRef.current = null
      }
    })

    return () => subscription.unsubscribe()
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
