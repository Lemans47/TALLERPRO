"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Wrench, Receipt, BarChart3, Settings, Menu, X, Car, LogOut, Users, UserCheck } from "lucide-react"
import { useState } from "react"
import { MonthSelector } from "@/components/month-selector"
import { useAuth } from "@/lib/auth-context"

const allNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "supervisor", "operador"] },
  { href: "/servicios", label: "Servicios", icon: Wrench, roles: ["admin", "supervisor", "operador"] },
  { href: "/gastos", label: "Gastos", icon: Receipt, roles: ["admin", "supervisor", "operador"] },
  { href: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "supervisor", "operador"] },
  { href: "/empleados", label: "Empleados", icon: UserCheck, roles: ["admin", "supervisor"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, roles: ["admin", "supervisor"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
]

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  operador: "Operador",
}

export function SidebarNav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { user, role, loading, signOut } = useAuth()

  const navItems = loading
    ? allNavItems // mientras carga, mostrar todos (no se puede actuar igual)
    : allNavItems.filter((item) => role ? item.roles.includes(role) : false)

  const NavItem = ({ item, onClick }: { item: typeof allNavItems[0]; onClick?: () => void }) => {
    const Icon = item.icon
    const isActive = pathname === item.href
    return (
      <Link key={item.href} href={item.href} onClick={onClick}>
        <div
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isActive
              ? "bg-primary text-sidebar-primary-foreground shadow-sm"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          }`}
        >
          <Icon className="w-5 h-5" />
          {item.label}
          {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary-foreground" />}
        </div>
      </Link>
    )
  }

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar backdrop-blur-md border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
            <Car className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">TallerPro</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-sidebar-accent rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-background/98 backdrop-blur-sm z-40">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border">
              <MonthSelector />
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => (
                <NavItem key={item.href} item={item} onClick={() => setIsOpen(false)} />
              ))}
            </nav>
            <div className="p-4 border-t border-border">
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border h-screen flex-col fixed left-0 top-0">
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-black/20">
              <Car className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">TallerPro</h1>
              <p className="text-xs text-sidebar-foreground/50">Gestión Automotriz</p>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="p-4 border-b border-sidebar-border">
          <MonthSelector />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          {user && (
            <div className="px-2">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user.email}</p>
              <p className="text-xs text-sidebar-foreground/50 mt-0.5">
                {role ? roleLabel[role] : "Sin rol"}
              </p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-2 w-full rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
          <div className="flex items-center justify-between text-xs text-sidebar-foreground/40 px-2">
            <span>© 2025 TallerPro</span>
            <span className="px-2 py-1 bg-primary/20 text-primary rounded-md text-[10px] font-medium">v2.0</span>
          </div>
        </div>
      </aside>
    </>
  )
}
