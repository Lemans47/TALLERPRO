"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api-client"
import { Plus, Pencil, Trash2, Phone, Mail, Building2, RefreshCw } from "lucide-react"

const CATEGORIAS = ["Pintura", "Repuestos", "Insumos", "Servicios", "Herramientas", "Otros"]

interface Proveedor {
  id: string
  nombre: string
  rut?: string
  telefono?: string
  email?: string
  categoria?: string
  notas?: string
}

const EMPTY: Omit<Proveedor, "id"> = { nombre: "", rut: "", telefono: "", email: "", categoria: "", notas: "" }

export default function ProveedoresPage() {
  const { toast } = useToast()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState("todos")
  const [busqueda, setBusqueda] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<Omit<Proveedor, "id">>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.proveedores.getAll()
      setProveedores(data)
    } catch {
      toast({ title: "Error cargando proveedores", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditando(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }

  const openEdit = (p: Proveedor) => {
    setEditando(p)
    setForm({ nombre: p.nombre, rut: p.rut ?? "", telefono: p.telefono ?? "", email: p.email ?? "", categoria: p.categoria ?? "", notas: p.notas ?? "" })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast({ title: "El nombre es requerido", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (editando) {
        await api.proveedores.update({ id: editando.id, ...form })
        toast({ title: "Proveedor actualizado" })
      } else {
        await api.proveedores.create(form)
        toast({ title: "Proveedor creado" })
      }
      setDialogOpen(false)
      load()
    } catch {
      toast({ title: "Error guardando proveedor", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: Proveedor) => {
    if (!confirm(`¿Eliminar proveedor "${p.nombre}"?`)) return
    try {
      await api.proveedores.delete(p.id)
      toast({ title: "Proveedor eliminado" })
      load()
    } catch {
      toast({ title: "Error eliminando proveedor", variant: "destructive" })
    }
  }

  const proveedoresFiltrados = proveedores
    .filter((p) => filtroCategoria === "todos" || p.categoria === filtroCategoria)
    .filter((p) => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.telefono ?? "").includes(busqueda))

  const categoriaBadgeColor: Record<string, string> = {
    Pintura: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Repuestos: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    Insumos: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    Servicios: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    Herramientas: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    Otros: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="text-sm text-muted-foreground">{proveedores.length} proveedores registrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Recargar">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nombre o teléfono..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="bg-secondary/50 border-border sm:max-w-xs"
        />
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="bg-secondary/50 border-border sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="todos">Todas las categorías</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proveedoresFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{proveedores.length === 0 ? "No hay proveedores registrados aún." : "Sin resultados para este filtro."}</p>
            {proveedores.length === 0 && (
              <Button className="mt-4" onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" /> Agregar primer proveedor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {proveedoresFiltrados.map((p) => (
            <Card key={p.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.nombre}</p>
                    {p.rut && <p className="text-xs text-muted-foreground">RUT: {p.rut}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {p.categoria && (
                  <Badge className={`text-xs border ${categoriaBadgeColor[p.categoria] ?? categoriaBadgeColor["Otros"]}`}>
                    {p.categoria}
                  </Badge>
                )}

                <div className="space-y-1">
                  {p.telefono && (
                    <a href={`tel:${p.telefono}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      {p.telefono}
                    </a>
                  )}
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      {p.email}
                    </a>
                  )}
                </div>

                {p.notas && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-2">{p.notas}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del proveedor" className="bg-secondary/50 border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>RUT</Label>
                <Input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="76.xxx.xxx-x" className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.categoria ?? ""} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+56 9 xxxx xxxx" className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" className="bg-secondary/50 border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Condiciones de pago, horarios, etc." className="bg-secondary/50 border-border" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear proveedor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
