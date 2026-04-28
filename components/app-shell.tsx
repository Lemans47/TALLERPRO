"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { EstadosProvider } from "@/lib/estados"
import { SidebarNav } from "@/components/sidebar-nav"

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const router = useRouter()

  const isPublicRoute = pathname === "/login" || pathname.startsWith("/solicitar-presupuesto")

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.push("/login")
    }
  }, [user, loading, pathname, isPublicRoute])

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user && !isPublicRoute) {
    router.push("/login")
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 min-w-0 md:ml-64 pt-16 md:pt-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <EstadosProvider>
        <ShellContent>{children}</ShellContent>
      </EstadosProvider>
    </AuthProvider>
  )
}
