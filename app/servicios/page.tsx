"use client"

import { CollapsibleContent } from "@/components/ui/collapsible"
import { CollapsibleTrigger } from "@/components/ui/collapsible"
import { Collapsible } from "@/components/ui/collapsible"
import { useState, useEffect, useCallback } from "react"
import { ServiceForm } from "@/components/service-form"
import { ServicesTable } from "@/components/services-table"
import { PresupuestosTable } from "@/components/presupuestos-table"
import { SearchBar } from "@/components/search-bar"
import { useMonth } from "@/lib/month-context"
import { api, type Servicio, type Presupuesto } from "@/lib/api-client"
import { RefreshCw, Wrench, FileText, ClipboardList, Plus, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function ServicesPage() {
  const [servicioAEditar, setServicioAEditar] = useState<(Servicio & { isPresupuesto?: boolean }) | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const { selectedMonth } = useMonth()
  const [serviciosOpen, setServiciosOpen] = useState(true)
  const [presupuestosOpen, setPresupuestosOpen] = useState(true)

  const ESTADOS_ACTIVOS = ["En Cola", "En Proceso", "En Reparación", "Esperando Repuestos", "Control de Calidad", "Listo para Entrega", "Entregado", "Por Cobrar"]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      const [delMes, todos, presupuestosDelMes, todosPresupuestos] = await Promise.all([
        api.servicios.getByMonth(year, month),
        api.servicios.getAll(),
        api.presupuestos.getByMonth(year, month),
        api.presupuestos.getAll(),
      ])
      // Servicios del mes + activos de cualquier mes, sin duplicados
      const activos = todos.filter((s) => ESTADOS_ACTIVOS.includes(s.estado))
      const idsDelMes = new Set(delMes.map((s) => s.id))
      const extra = activos.filter((s) => !idsDelMes.has(s.id))
      setServicios([...delMes, ...extra])
      // Presupuestos del mes + todos los demás (todos son activos hasta convertirse)
      const idsPresDelMes = new Set(presupuestosDelMes.map((p) => p.id))
      const extraPres = todosPresupuestos.filter((p) => !idsPresDelMes.has(p.id))
      setPresupuestos([...presupuestosDelMes, ...extraPres])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleEditServicio = (servicio: Servicio) => {
    setServicioAEditar({ ...servicio, isPresupuesto: false })
    setShowFormDialog(true)
  }

  const handleEditPresupuesto = (presupuesto: Presupuesto) => {
    setServicioAEditar({ ...presupuesto, isPresupuesto: true } as Servicio & { isPresupuesto: boolean })
    setShowFormDialog(true)
  }

  const handleNuevoServicio = () => {
    setServicioAEditar(null)
    setShowFormDialog(true)
  }

  const handleClearEdit = () => {
    setServicioAEditar(null)
    setShowFormDialog(false)
  }

  const handleSaved = () => {
    setTimeout(() => {
      loadData()
    }, 500)
    setServicioAEditar(null)
    setShowFormDialog(false)
  }

  const filterBySearch = <T extends { patente: string; cliente: string; marca: string; modelo: string }>(
    items: T[],
  ): T[] => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter(
      (item) =>
        item.patente.toLowerCase().includes(query) ||
        item.cliente.toLowerCase().includes(query) ||
        item.marca.toLowerCase().includes(query) ||
        item.modelo.toLowerCase().includes(query),
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            Servicios
          </h1>
          <p className="text-muted-foreground mt-2">Gestiona los servicios y presupuestos del taller</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleNuevoServicio}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Servicio
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-border hover:bg-secondary bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ClipboardList className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{servicios.length}</p>
              <p className="text-xs text-muted-foreground">Servicios</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <FileText className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{presupuestos.length}</p>
              <p className="text-xs text-muted-foreground">Presupuestos</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Wrench className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{servicios.filter((s) => s.estado !== "Cerrado/Pagado").length}</p>
              <p className="text-xs text-muted-foreground">En proceso</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <ClipboardList className="w-4 h-4 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{servicios.filter((s) => s.estado === "Cerrado/Pagado").length}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por patente, cliente, marca o modelo..."
      />

      {/* Tables */}
      <div className="space-y-6">
        <PresupuestosTable
          presupuestos={filterBySearch(presupuestos)}
          onEditPresupuesto={handleEditPresupuesto}
          onConverted={loadData}
          loading={loading}
        />
        
        <ServicesTable
          servicios={filterBySearch(servicios)}
          onEditServicio={handleEditServicio}
          onDeleted={loadData}
          loading={loading}
        />
      </div>

      {/* Dialog with Service Form */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw] xl:max-w-7xl w-full h-[98vh] sm:h-[95vh] flex flex-col bg-card border-border p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-border">
            <DialogTitle className="text-lg sm:text-xl">
              {servicioAEditar ? `Editar ${servicioAEditar.isPresupuesto ? "Presupuesto" : "Servicio"}` : "Nuevo Servicio"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <ServiceForm servicioAEditar={servicioAEditar} onClearEdit={handleClearEdit} onSaved={handleSaved} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
