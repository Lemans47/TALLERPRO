"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createElement } from "react"
import { api, type EstadoServicio, type EstadoTipo } from "./api-client"

// Defaults usados como fallback antes de que cargue la DB (mismos 9 estados originales).
// Garantiza que la UI no quede vacía si la primera request a /api/estados-servicio falla.
const FALLBACK_ESTADOS: EstadoServicio[] = [
  { id: "f-1", nombre: "En Cola",             tipo: "activo",     orden: 1, visible: true, color: "#64748b" },
  { id: "f-2", nombre: "En Proceso",          tipo: "activo",     orden: 2, visible: true, color: "#3b82f6" },
  { id: "f-3", nombre: "Esperando Repuestos", tipo: "activo",     orden: 3, visible: true, color: "#eab308" },
  { id: "f-4", nombre: "En Reparación",       tipo: "activo",     orden: 4, visible: true, color: "#a855f7" },
  { id: "f-5", nombre: "Control de Calidad",  tipo: "activo",     orden: 5, visible: true, color: "#6366f1" },
  { id: "f-6", nombre: "Listo para Entrega",  tipo: "activo",     orden: 6, visible: true, color: "#06b6d4" },
  { id: "f-7", nombre: "Entregado",           tipo: "por_cobrar", orden: 7, visible: true, color: "#10b981" },
  { id: "f-8", nombre: "Por Cobrar",          tipo: "por_cobrar", orden: 8, visible: true, color: "#f97316" },
  { id: "f-9", nombre: "Cerrado/Pagado",      tipo: "cerrado",    orden: 9, visible: true, color: "#22c55e" },
]

export type EstadosCtx = {
  estados: EstadoServicio[]
  loading: boolean
  reload: () => Promise<void>
  esCerrado: (nombre: string | null | undefined) => boolean
  esPorCobrar: (nombre: string | null | undefined) => boolean
  esFinalizado: (nombre: string | null | undefined) => boolean
  esActivo: (nombre: string | null | undefined) => boolean
  nombresPorTipo: (tipos: EstadoTipo[]) => string[]
  colorOf: (nombre: string | null | undefined) => string
}

const Context = createContext<EstadosCtx | null>(null)

export function EstadosProvider({ children }: { children: ReactNode }) {
  const [estados, setEstados] = useState<EstadoServicio[]>(FALLBACK_ESTADOS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const data = await api.estadosServicio.getAll()
      if (data?.length) setEstados(data)
    } catch (e) {
      console.error("[estados] reload error:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo<EstadosCtx>(() => {
    const byTipo = (tipos: EstadoTipo[]) =>
      estados.filter((e) => tipos.includes(e.tipo)).map((e) => e.nombre)
    const has = (tipo: EstadoTipo, nombre: string | null | undefined) =>
      !!nombre && estados.some((e) => e.tipo === tipo && e.nombre === nombre)
    const colorMap = new Map(estados.map((e) => [e.nombre, e.color]))
    return {
      estados,
      loading,
      reload,
      esCerrado: (n) => has("cerrado", n),
      esPorCobrar: (n) => has("por_cobrar", n),
      esFinalizado: (n) => has("cerrado", n) || has("por_cobrar", n),
      esActivo: (n) => has("activo", n),
      nombresPorTipo: byTipo,
      colorOf: (n) => (n && colorMap.get(n)) || "#6b7280",
    }
  }, [estados, loading, reload])

  return createElement(Context.Provider, { value }, children)
}

export function useEstados(): EstadosCtx {
  const ctx = useContext(Context)
  if (!ctx) {
    // Permite usar el hook fuera del provider devolviendo el fallback estático.
    // Evita romper componentes en pruebas o storybooks.
    const fallbackColors = new Map(FALLBACK_ESTADOS.map((e) => [e.nombre, e.color]))
    const fallbackHas = (tipo: EstadoTipo, nombre: string | null | undefined) =>
      !!nombre && FALLBACK_ESTADOS.some((e) => e.tipo === tipo && e.nombre === nombre)
    return {
      estados: FALLBACK_ESTADOS,
      loading: false,
      reload: async () => {},
      esCerrado: (n) => fallbackHas("cerrado", n),
      esPorCobrar: (n) => fallbackHas("por_cobrar", n),
      esFinalizado: (n) => fallbackHas("cerrado", n) || fallbackHas("por_cobrar", n),
      esActivo: (n) => fallbackHas("activo", n),
      nombresPorTipo: (tipos) => FALLBACK_ESTADOS.filter((e) => tipos.includes(e.tipo)).map((e) => e.nombre),
      colorOf: (n) => (n && fallbackColors.get(n)) || "#6b7280",
    }
  }
  return ctx
}
