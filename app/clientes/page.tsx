"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Users, Search, Pencil, Trash2, Plus, Car, Phone, Mail, RefreshCw, X, GitMerge, History, ChevronDown, ChevronUp } from "lucide-react"
import { api, type Cliente, type Vehiculo } from "@/lib/api-client"
import { formatFechaDMA } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

type ServicioHistorial = {
  id: string
  fecha_ingreso: string
  patente: string
  marca: string
  modelo: string
  estado: string
  monto_total: number
  monto_total_sin_iva: number
  cobros: { categoria: string; descripcion: string; monto: number }[]
  observaciones: string
  numero_ot?: string
}

type VehiculoConCliente = Vehiculo & { cliente?: Cliente }

export default function ClientesPage() {
  const { role } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoConCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [deduplicando, setDeduplicando] = useState(false)
  const [historialOpen, setHistorialOpen] = useState(false)
  const [historialCliente, setHistorialCliente] = useState<Cliente | null>(null)
  const [historialData, setHistorialData] = useState<ServicioHistorial[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [expandedServicio, setExpandedServicio] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", notas: "" })

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [c, v] = await Promise.all([api.clientes.getAll(), api.clientes.getVehiculosConCliente()])
      setClientes(c)
      setVehiculos(v)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: "", telefono: "", email: "", notas: "" })
    setDialogOpen(true)
  }

  const abrirEditar = (cliente: Cliente) => {
    setEditando(cliente)
    setForm({
      nombre: cliente.nombre,
      telefono: cliente.telefono || "",
      email: cliente.email || "",
      notas: cliente.notas || "",
    })
    setDialogOpen(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    try {
      if (editando) {
        await api.clientes.update(editando.id, form)
      } else {
        await api.clientes.create(form)
      }
      setDialogOpen(false)
      await cargarDatos()
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return
    try {
      await api.clientes.delete(id)
      await cargarDatos()
    } catch (e) {
      console.error(e)
    }
  }

  const verHistorial = async (cliente: Cliente) => {
    setHistorialCliente(cliente)
    setHistorialOpen(true)
    setHistorialLoading(true)
    setExpandedServicio(null)
    try {
      const res = await fetch(`/api/clientes/historial?cliente=${encodeURIComponent(cliente.nombre)}`)
      const data = await res.json()
      setHistorialData(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setHistorialData([])
    } finally {
      setHistorialLoading(false)
    }
  }

  const deduplicar = async () => {
    if (!confirm("¿Unificar todos los clientes duplicados? Se mantendrá el registro con más datos.")) return
    setDeduplicando(true)
    try {
      const res = await fetch("/api/clientes/deduplicar", { method: "POST" })
      const { deleted } = await res.json()
      alert(deleted > 0 ? `Se eliminaron ${deleted} duplicado(s).` : "No se encontraron duplicados.")
      await cargarDatos()
    } catch (e) {
      console.error(e)
    } finally {
      setDeduplicando(false)
    }
  }

  const vehiculosPorCliente = (clienteId: string) =>
    vehiculos.filter((v) => v.cliente_id === clienteId)

  const clientesFiltrados = clientes.filter((c) => {
    const q = busqueda.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.telefono || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      vehiculosPorCliente(c.id).some((v) => v.patente.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-4 md:p-6 space-y-6 pt-20 md:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">{clientes.length} clientes registrados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={cargarDatos} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {role === "admin" && (
            <Button variant="outline" onClick={deduplicar} disabled={deduplicando}>
              <GitMerge className="w-4 h-4 mr-2" />
              {deduplicando ? "Limpiando..." : "Limpiar duplicados"}
            </Button>
          )}
          {(role === "admin" || role === "supervisor") && (
            <Button onClick={abrirNuevo}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo cliente
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono, patente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9 pr-9"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {busqueda ? "Sin resultados para la búsqueda" : "No hay clientes registrados"}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((cliente) => {
            const vehs = vehiculosPorCliente(cliente.id)
            return (
              <Card key={cliente.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">
                      {cliente.nombre}
                    </CardTitle>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Ver historial"
                        onClick={() => verHistorial(cliente)}
                      >
                        <History className="w-3.5 h-3.5" />
                      </Button>
                      {(role === "admin" || role === "supervisor") && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => abrirEditar(cliente)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => eliminar(cliente.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cliente.telefono && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span>{cliente.telefono}</span>
                    </div>
                  )}
                  {cliente.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.notas && (
                    <p className="text-xs text-muted-foreground italic">{cliente.notas}</p>
                  )}

                  {/* Vehículos */}
                  {vehs.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide">
                        Vehículos ({vehs.length})
                      </p>
                      {vehs.map((v) => (
                        <div key={v.id} className="flex items-center gap-2 text-sm">
                          <Car className="w-3.5 h-3.5 shrink-0 text-primary" />
                          <span className="font-mono font-semibold text-xs bg-muted px-1.5 py-0.5 rounded">
                            {v.patente}
                          </span>
                          <span className="text-xs truncate">
                            {[v.marca, v.modelo, v.color].filter(Boolean).join(" ")}
                            {v.año ? ` (${v.año})` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog historial */}
      <Dialog open={historialOpen} onOpenChange={setHistorialOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial — {historialCliente?.nombre}
            </DialogTitle>
          </DialogHeader>
          {historialLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : historialData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Sin servicios registrados</div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{historialData.length} servicio(s) encontrado(s)</p>
              {historialData.map((s) => {
                const fecha = formatFechaDMA(s.fecha_ingreso)
                const expanded = expandedServicio === s.id
                const estadoColor: Record<string, string> = {
                  "Pagado": "bg-green-500/20 text-green-400",
                  "Cerrado": "bg-blue-500/20 text-blue-400",
                  "En Proceso": "bg-yellow-500/20 text-yellow-400",
                  "En Cola": "bg-gray-500/20 text-gray-400",
                }
                return (
                  <div key={s.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between gap-3 p-3 hover:bg-muted/50 text-left"
                      onClick={() => setExpandedServicio(expanded ? null : s.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-mono text-muted-foreground shrink-0">{fecha}</span>
                        <span className="font-mono font-semibold text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{s.patente}</span>
                        <span className="text-sm truncate">{[s.marca, s.modelo].filter(Boolean).join(" ")}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold">${Number(s.monto_total).toLocaleString("es-CL")}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[s.estado] || "bg-muted text-muted-foreground"}`}>
                          {s.estado}
                        </span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
                        {s.observaciones && (
                          <p className="text-xs text-muted-foreground italic">{s.observaciones}</p>
                        )}
                        {Array.isArray(s.cobros) && s.cobros.length > 0 && (
                          <div className="space-y-1">
                            {s.cobros.map((c, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{c.descripcion || c.categoria}</span>
                                <span>${Number(c.monto).toLocaleString("es-CL")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.numero_ot && (
                          <p className="text-xs text-muted-foreground">OT #{s.numero_ot}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog nuevo/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="+56 9 ..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones opcionales"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || !form.nombre.trim()}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
