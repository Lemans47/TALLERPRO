"use client"

import { CollapsibleContent } from "@/components/ui/collapsible"
import { CollapsibleTrigger } from "@/components/ui/collapsible"
import { Collapsible } from "@/components/ui/collapsible"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ServiceForm } from "@/components/service-form"
import { ServicesTable } from "@/components/services-table"
import { PresupuestosTable } from "@/components/presupuestos-table"
import { SearchBar } from "@/components/search-bar"
import { useMonth } from "@/lib/month-context"
import { api, type Servicio, type Presupuesto } from "@/lib/api-client"
import { useEstados } from "@/lib/estados"
import { useAuth } from "@/lib/auth-context"
import { RefreshCw, Wrench, FileText, ClipboardList, Plus, ChevronUp, ChevronDown, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

export default function ServicesPage() {
  const [servicioAEditar, setServicioAEditar] = useState<(Servicio & { isPresupuesto?: boolean }) | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const { selectedMonth } = useMonth()
  const { esCerrado, esActivo } = useEstados()
  const { role } = useAuth()
  const canEdit = role !== "supervisor"
  const [serviciosOpen, setServiciosOpen] = useState(true)
  const [presupuestosOpen, setPresupuestosOpen] = useState(true)
  const [backfilling, setBackfilling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { toast } = useToast()

  const handleBackfillRevTecnica = async () => {
    if (backfilling) return
    const ok = window.confirm(
      "Esto consulta la API de patentes para todos los vehículos sin mes de revisión técnica. Puede demorar varios minutos. ¿Continuar?"
    )
    if (!ok) return
    setBackfilling(true)
    try {
      const res = await fetch("/api/backfill-revision-tecnica", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data?.error ?? "No se pudo completar", variant: "destructive" })
      } else {
        toast({
          title: "Backfill completo",
          description: `Total: ${data.total} · Actualizados: ${data.updated} · Sin datos: ${data.skipped} · Fallos: ${data.failed}`,
        })
        loadData({ background: true })
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Error de red", variant: "destructive" })
    } finally {
      setBackfilling(false)
    }
  }

  const loadData = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true)
    try {
      const [year, month] = selectedMonth.split("-").map(Number)
      // Servicios: del mes + activos historicos (filtrados server-side por estado).
      // Presupuestos: del mes + todos los demas (todos son activos hasta convertirse).
      const [delMes, activosHistoricos, presupuestosDelMes, todosPresupuestos] = await Promise.all([
        api.servicios.getByMonth(year, month),
        api.servicios.getActivos(),
        api.presupuestos.getByMonth(year, month),
        api.presupuestos.getAll(),
      ])
      const idsDelMes = new Set(delMes.map((s) => s.id))
      const extra = activosHistoricos.filter((s) => !idsDelMes.has(s.id))
      setServicios([...delMes, ...extra])
      const idsPresDelMes = new Set(presupuestosDelMes.map((p) => p.id))
      const extraPres = todosPresupuestos.filter((p) => !idsPresDelMes.has(p.id))
      setPresupuestos([...presupuestosDelMes, ...extraPres])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      if (!background) setLoading(false)
    }
  }, [selectedMonth])

  // Recarga en segundo plano (sin colapsar la lista a un spinner), para que la
  // posición de scroll de la ventana no se pierda tras guardar/eliminar/convertir.
  const refreshData = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadData({ background: true })
    } finally {
      setRefreshing(false)
    }
  }, [loadData])

  useEffect(() => {
    loadData()
  }, [loadData])

  // El formulario avisa si tiene trabajo sin guardar; el ref lo mantiene accesible
  // desde los listeners (popstate), que no se re-crean en cada render.
  const formDirtyRef = useRef(false)
  const handleFormDirtyChange = useCallback((hayCambios: boolean) => {
    formDirtyRef.current = hayCambios
  }, [])

  const cerrarFormulario = useCallback(() => {
    formDirtyRef.current = false
    setConfirmarCierre(false)
    setServicioAEditar(null)
    setShowFormDialog(false)
  }, [])

  // Cierre pedido por el usuario (X, Esc, clic afuera, Cancelar o botón atrás): si hay
  // trabajo sin guardar se pregunta antes de descartarlo.
  const intentarCerrarFormulario = useCallback(() => {
    if (formDirtyRef.current) {
      setConfirmarCierre(true)
      return
    }
    cerrarFormulario()
  }, [cerrarFormulario])

  // El formulario recién avisa su estado cuando termina de cargar; hasta entonces se
  // asume limpio para no arrastrar el "sucio" de la ficha anterior.
  const abrirFormulario = useCallback((registro: (Servicio & { isPresupuesto?: boolean }) | null) => {
    formDirtyRef.current = false
    setServicioAEditar(registro)
    setShowFormDialog(true)
  }, [])

  const handleEditServicio = (servicio: Servicio) => {
    abrirFormulario({ ...servicio, isPresupuesto: false })
  }

  // Deep-link desde el dashboard: /servicios?edit=<id> abre el modal de edición
  // de ese servicio. Se fetchea por id porque puede ser de otro mes y no estar
  // en la lista cargada. Sin useSearchParams() para no requerir <Suspense>.
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit")
    if (!editId) return
    // Limpiar el param para no re-abrir el modal al refrescar la página
    window.history.replaceState(null, "", "/servicios")
    api.servicios
      .getById(editId)
      .then((s) => {
        if (s) handleEditServicio(s)
        else toast({ title: "Servicio no encontrado", variant: "destructive" })
      })
      .catch(() => toast({ title: "No se pudo abrir el servicio", variant: "destructive" }))
    // Solo al montar: el modal no debe re-abrirse en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Botón/gesto "atrás" con el formulario abierto: el diálogo no crea entrada en el
  // historial, así que volver atrás sacaba de /servicios y se perdía todo lo cargado.
  // Empujamos una entrada al abrirlo para interceptar el gesto y cerrar solo el diálogo.
  useEffect(() => {
    if (!showFormDialog) return
    // Idempotente: en desarrollo StrictMode monta el efecto dos veces y no queremos
    // apilar dos entradas (obligaría a apretar atrás dos veces).
    if (!window.history.state?.tpFormDialog) window.history.pushState({ tpFormDialog: true }, "")
    const onPop = () => {
      if (formDirtyRef.current) {
        // Nos quedamos en el formulario: reponemos la entrada consumida y preguntamos.
        window.history.pushState({ tpFormDialog: true }, "")
        setConfirmarCierre(true)
        return
      }
      cerrarFormulario()
    }
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      // Si el diálogo se cerró por otro camino (guardar, cancelar), sacamos del historial
      // la entrada que habíamos empujado para no dejar un "atrás" que no hace nada.
      if (window.history.state?.tpFormDialog) window.history.back()
    }
  }, [showFormDialog, cerrarFormulario])

  const handleEditPresupuesto = (presupuesto: Presupuesto) => {
    abrirFormulario({ ...presupuesto, isPresupuesto: true } as Servicio & { isPresupuesto: boolean })
  }

  const handleNuevoServicio = () => {
    abrirFormulario(null)
  }

  const handleClearEdit = () => {
    intentarCerrarFormulario()
  }

  const handleSaved = () => {
    // El formulario llama onSaved() recién después de que la API confirma el
    // guardado, así que recargamos de inmediato (sin esperas fijas que dejaban
    // la lista desactualizada en redes lentas).
    setServicioAEditar(null)
    setShowFormDialog(false)
    refreshData()
  }

  const filterBySearch = <
    T extends { patente: string; cliente: string; marca: string; modelo: string; numero_ot?: number | null },
  >(
    items: T[],
  ): T[] => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase().trim()
    // Número de OT: acepta "130", "0130", "OT-0130" y "ot 130". Se compara exacto para
    // que buscar 130 no traiga la 1300; los presupuestos no tienen numero_ot.
    const queryOt = query.replace(/^ot[\s-]*/, "").replace(/^0+/, "")
    const buscaOt = /^\d+$/.test(queryOt)
    return items.filter(
      (item) =>
        (buscaOt && item.numero_ot != null && String(item.numero_ot) === queryOt) ||
        item.patente.toLowerCase().includes(query) ||
        item.cliente.toLowerCase().includes(query) ||
        item.marca.toLowerCase().includes(query) ||
        item.modelo.toLowerCase().includes(query),
    )
  }

  return (
    <div className="@container space-y-6">
      {/* Header */}
      <div className="flex flex-col @2xl:flex-row @2xl:items-center @2xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            Servicios
          </h1>
          <p className="text-muted-foreground mt-2">Gestiona los servicios y presupuestos del taller</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              onClick={handleNuevoServicio}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Servicio
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="border-border hover:bg-secondary bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackfillRevTecnica}
              disabled={backfilling}
              className="border-border hover:bg-secondary bg-transparent"
              title="Consulta la API para completar el mes de revisión técnica en todos los vehículos existentes"
            >
              <Calendar className={`w-4 h-4 mr-2 ${backfilling ? "animate-pulse" : ""}`} />
              {backfilling ? "Actualizando..." : "Rev. Técnica"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
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
              <p className="text-2xl font-bold">{servicios.filter((s) => esActivo(s.estado)).length}</p>
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
              <p className="text-2xl font-bold">{servicios.filter((s) => esCerrado(s.estado)).length}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por N° de OT, patente, cliente, marca o modelo..."
      />

      {/* Tables */}
      <div className="space-y-6">
        <PresupuestosTable
          presupuestos={filterBySearch(presupuestos)}
          onEditPresupuesto={handleEditPresupuesto}
          onConverted={refreshData}
          loading={loading}
        />
        
        <ServicesTable
          servicios={filterBySearch(servicios)}
          onEditServicio={handleEditServicio}
          onDeleted={refreshData}
          loading={loading}
        />
      </div>

      {/* Dialog with Service Form */}
      <Dialog
        open={showFormDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowFormDialog(true)
            return
          }
          intentarCerrarFormulario()
        }}
      >
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw] xl:max-w-7xl w-full h-[100dvh] sm:h-[95vh] max-h-[100dvh] flex flex-col bg-card border-border p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-border">
            <DialogTitle className="text-lg sm:text-xl">
              {servicioAEditar ? `Editar ${servicioAEditar.isPresupuesto ? "Presupuesto" : "Servicio"}` : "Nuevo Servicio"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <ServiceForm
              servicioAEditar={servicioAEditar}
              onClearEdit={handleClearEdit}
              onSaved={handleSaved}
              onDirtyChange={handleFormDirtyChange}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarCierre} onOpenChange={(o) => !o && setConfirmarCierre(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tenés cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Si cerrás ahora se pierde lo que cargaste. Igual queda un borrador en este dispositivo y te lo vamos a
              ofrecer la próxima vez que abras esta ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmarCierre(false)}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={cerrarFormulario}>Cerrar sin guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
