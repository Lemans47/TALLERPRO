"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { api, type Servicio } from "@/lib/api-client"
import { FileText, Trash2, Edit, Calendar, User, Car, Wrench, ClipboardList, List, AlignJustify, TrendingUp, Receipt, ChevronDown, ChevronRight } from "lucide-react"

const parseArr = (v: any): any[] => {
  let val = v
  while (typeof val === "string" && val) {
    try { val = JSON.parse(val) } catch { return [] }
  }
  if (Array.isArray(val)) return val
  if (val && typeof val === "object") {
    return Object.values(val).flatMap((items: any) => Array.isArray(items) ? items : [])
  }
  return []
}

function calcGanancia(servicio: Servicio) {
  const ingreso = Number(servicio.monto_total_sin_iva || 0)
  const costos = parseArr(servicio.costos)
  if (costos.length === 0) return null
  const totalCostos = costos.reduce((s: number, c: any) => s + Number(c.monto || 0), 0)
  const ganancia = ingreso - totalCostos
  const margen = ingreso > 0 ? (ganancia / ingreso) * 100 : 0
  return { ganancia, margen }
}

function getGananciaStyles(margen: number) {
  if (margen >= 45) return {
    box: "bg-success/10 border border-success/30",
    text: "text-success",
    badge: "bg-success/20 text-success",
  }
  if (margen >= 30) return {
    box: "bg-warning/10 border border-warning/30",
    text: "text-warning",
    badge: "bg-warning/20 text-warning",
  }
  return {
    box: "bg-destructive/10 border border-destructive/30",
    text: "text-destructive",
    badge: "bg-destructive/20 text-destructive",
  }
}
import { generarPDFPresupuesto } from "@/lib/pdf-presupuesto"
import { generarOrdenTrabajo } from "@/lib/pdf-orden-trabajo"
import { generarReciboPDF } from "@/lib/pdf-recibo"
import { PDFPreviewModal } from "@/components/pdf-preview-modal"

interface ServicesTableProps {
  servicios: Servicio[]
  onEditServicio: (servicio: Servicio) => void
  onDeleted: () => void
  loading?: boolean
}

const ESTADOS = [
  "En Cola",
  "En Proceso",
  "Esperando Repuestos",
  "En Reparación",
  "Control de Calidad",
  "Listo para Entrega",
  "Entregado",
  "Por Cobrar",
  "Cerrado/Pagado",
]

export function ServicesTable({ servicios, onEditServicio, onDeleted, loading }: ServicesTableProps) {
  const { toast } = useToast()
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [sortBy, setSortBy] = useState("fecha_desc")
  const [collapsed, setCollapsed] = useState(false)
  const [montoPago, setMontoPago] = useState("")
  const [modoCorregir, setModoCorregir] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [servicioParaPdf, setServicioParaPdf] = useState<Servicio | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null)

  const handleEstadoChange = async (id: string, nuevoEstado: string) => {
    try {
      const updateData: Record<string, unknown> = { estado: nuevoEstado }
      if (nuevoEstado === "Cerrado/Pagado") {
        const servicio = servicios.find((s) => s.id === id)
        if (servicio) {
          const montoTotal = Number(servicio.monto_total) || 0
          updateData.anticipo = montoTotal
          updateData.saldo_pendiente = 0
        }
      }
      await api.servicios.update(id, updateData)
      onDeleted()
      toast({ title: "Estado actualizado" })
    } catch (error) {
      console.error("Error:", error)
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" })
    }
  }

  const handleRegistrarPago = async () => {
    if (!servicioSeleccionado || !montoPago) return

    try {
      const monto = Number(montoPago)
      const total = Number(servicioSeleccionado.monto_total)
      let nuevoAnticipo: number
      let nuevoSaldo: number

      if (modoCorregir) {
        // Set exact anticipo value
        nuevoAnticipo = monto
        nuevoSaldo = Math.max(0, total - monto)
      } else {
        // Add to existing anticipo
        nuevoAnticipo = Number(servicioSeleccionado.anticipo) + monto
        nuevoSaldo = Math.max(0, total - nuevoAnticipo)
      }

      const nuevoEstado = nuevoSaldo <= 0 ? "Cerrado/Pagado" : servicioSeleccionado.estado

      await api.servicios.update(servicioSeleccionado.id, {
        anticipo: nuevoAnticipo,
        saldo_pendiente: nuevoSaldo,
        estado: nuevoEstado,
      })

      setMontoPago("")
      setModoCorregir(false)
      setDialogOpen(false)
      setServicioSeleccionado(null)
      onDeleted()
      toast({ title: modoCorregir ? "Anticipo corregido" : "Pago registrado" })
    } catch (error) {
      console.error("Error:", error)
      toast({ title: "Error", description: "No se pudo registrar el pago", variant: "destructive" })
    }
  }

  const handleDelete = async (servicio: Servicio) => {
    if (!confirm(`¿Eliminar servicio de ${servicio.patente}?`)) return

    try {
      await api.servicios.delete(servicio.id)
      onDeleted()
      toast({ title: "Servicio eliminado" })
    } catch (error) {
      console.error("Error:", error)
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" })
    }
  }

  const getEstadoStyles = (estado: string) => {
    const styles: Record<string, string> = {
      "En Cola": "bg-slate-500/10 text-slate-400 border-slate-500/30",
      "En Proceso": "bg-blue-500/10 text-blue-400 border-blue-500/30",
      "Esperando Repuestos": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      "En Reparación": "bg-purple-500/10 text-purple-400 border-purple-500/30",
      "Control de Calidad": "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
      "Listo para Entrega": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      Entregado: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      "Por Cobrar": "bg-orange-500/10 text-orange-400 border-orange-500/30",
      "Cerrado/Pagado": "bg-green-500/10 text-green-400 border-green-500/30",
    }
    return styles[estado] || "bg-gray-500/10 text-gray-400 border-gray-500/30"
  }

  const ESTADO_ORDER = ["En Cola","En Proceso","Esperando Repuestos","En Reparación","Control de Calidad","Listo para Entrega","Entregado","Por Cobrar","Cerrado/Pagado"]

  const serviciosFiltrados = servicios
    .filter((s) => filtroEstado === "todos" || s.estado === filtroEstado)
    .sort((a, b) => {
      switch (sortBy) {
        case "fecha_asc":  return (a.fecha_ingreso || "").localeCompare(b.fecha_ingreso || "")
        case "fecha_desc": return (b.fecha_ingreso || "").localeCompare(a.fecha_ingreso || "")
        case "estado":     return ESTADO_ORDER.indexOf(a.estado) - ESTADO_ORDER.indexOf(b.estado)
        case "monto_desc": return Number(b.monto_total || 0) - Number(a.monto_total || 0)
        case "monto_asc":  return Number(a.monto_total || 0) - Number(b.monto_total || 0)
        case "margen": {
          const mg = (s: Servicio) => { const g = calcGanancia(s); return g ? g.margen : -Infinity }
          return mg(b) - mg(a)
        }
        default: return 0
      }
    })

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Cargando servicios...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* PDF Preview Modal */}
      {pdfPreview && (
        <PDFPreviewModal
          url={pdfPreview.url}
          fileName={pdfPreview.fileName}
          onClose={() => setPdfPreview(null)}
        />
      )}

      {/* PDF format picker dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Generar Presupuesto PDF</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Elige el formato del presupuesto:</p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              onClick={async () => {
                const { blobUrl, fileName } = await generarPDFPresupuesto(servicioParaPdf!, false)
                setPdfPreview({ url: blobUrl, fileName })
                setPdfDialogOpen(false)
              }}
            >
              <AlignJustify className="w-6 h-6 text-primary" />
              <span className="font-semibold text-sm">Con detalle</span>
              <span className="text-xs text-muted-foreground text-center">Cada item por separado con su valor</span>
            </button>
            <button
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              onClick={async () => {
                const { blobUrl, fileName } = await generarPDFPresupuesto(servicioParaPdf!, true)
                setPdfPreview({ url: blobUrl, fileName })
                setPdfDialogOpen(false)
              }}
            >
              <List className="w-6 h-6 text-primary" />
              <span className="font-semibold text-sm">Solo totales</span>
              <span className="text-xs text-muted-foreground text-center">Un total por categoría, sin detalles</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setModoCorregir(false); setMontoPago("") } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Registrar Pago - {servicioSeleccionado?.patente}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Toggle agregar / corregir */}
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                className={`flex-1 py-2 font-medium transition-colors ${!modoCorregir ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                onClick={() => { setModoCorregir(false); setMontoPago("") }}
              >
                Agregar abono
              </button>
              <button
                className={`flex-1 py-2 font-medium transition-colors ${modoCorregir ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                onClick={() => { setModoCorregir(true); setMontoPago(String(Number(servicioSeleccionado?.anticipo) || 0)) }}
              >
                Corregir anticipo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                <Label className="text-muted-foreground text-xs">Anticipo actual</Label>
                <p className="text-xl font-bold text-success">
                  ${Number(servicioSeleccionado?.anticipo).toLocaleString("es-CL")}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                <Label className="text-muted-foreground text-xs">Saldo pendiente</Label>
                <p className="text-xl font-bold text-warning">
                  ${Number(servicioSeleccionado?.saldo_pendiente).toLocaleString("es-CL")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{modoCorregir ? "Nuevo valor del anticipo" : "Monto a abonar"}</Label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="0"
                className="bg-secondary/50 border-border"
              />
            </div>
            <Button
              onClick={handleRegistrarPago}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {modoCorregir ? "Guardar corrección" : "Confirmar Abono"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border bg-secondary/30">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          <Wrench className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Servicios por Realizar</h3>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
            {serviciosFiltrados.length}
          </Badge>
        </button>
        {!collapsed && <div className="flex gap-2 w-full sm:w-auto">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[170px] bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="fecha_desc" className="focus:bg-secondary">Fecha ↓ (reciente)</SelectItem>
              <SelectItem value="fecha_asc"  className="focus:bg-secondary">Fecha ↑ (antiguo)</SelectItem>
              <SelectItem value="estado"     className="focus:bg-secondary">Por estado</SelectItem>
              <SelectItem value="monto_desc" className="focus:bg-secondary">Monto ↓ (mayor)</SelectItem>
              <SelectItem value="monto_asc"  className="focus:bg-secondary">Monto ↑ (menor)</SelectItem>
              <SelectItem value="margen"     className="focus:bg-secondary">Margen ↓ (mayor)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-full sm:w-[180px] bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="todos" className="focus:bg-secondary">Todos los Estados</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e} className="focus:bg-secondary">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>}
      </div>

      {/* Content */}
      {!collapsed && <>
      {serviciosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay servicios registrados</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {serviciosFiltrados.map((servicio) => (
            <div key={servicio.id} className="p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Car className="w-4 h-4 text-primary" />
                    <span className="font-bold text-lg">{servicio.patente}</span>
                    <Badge className={getEstadoStyles(servicio.estado)}>{servicio.estado}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {servicio.marca} {servicio.modelo}
                    </span>
                    {servicio.numero_ot && (
                      <span className="text-xs font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        OT-{String(servicio.numero_ot).padStart(4, "0")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      {servicio.cliente}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {servicio.fecha_ingreso?.substring(0, 10).split("-").reverse().join("-")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    <div className="p-2 rounded-lg bg-secondary/50">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold">${Number(servicio.monto_total).toLocaleString("es-CL")}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-success/5 border border-success/20 cursor-pointer" onClick={() => {
                      setServicioSeleccionado(servicio)
                      setDialogOpen(true)
                    }}>
                      <p className="text-xs text-muted-foreground">Abono/Anticipo</p>
                      <p className="font-semibold text-success">${Number(servicio.anticipo).toLocaleString("es-CL")}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Click para agregar</p>
                    </div>
                    <div
                      className={`p-2 rounded-lg ${Number(servicio.saldo_pendiente) > 0 ? "bg-warning/5 border border-warning/20" : "bg-success/5 border border-success/20"}`}
                    >
                      <p className="text-xs text-muted-foreground">Saldo Pendiente</p>
                      <p className={`font-semibold ${Number(servicio.saldo_pendiente) > 0 ? "text-warning" : "text-success"}`}>
                        ${Number(servicio.saldo_pendiente).toLocaleString("es-CL")}
                      </p>
                    </div>
                    {(() => {
                      const g = calcGanancia(servicio)
                      if (!g) return (
                        <div className="p-2 rounded-lg bg-secondary/30 border border-border/40">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Ganancia
                          </p>
                          <p className="font-semibold text-muted-foreground text-xs mt-1">Sin costos</p>
                        </div>
                      )
                      const s = getGananciaStyles(g.margen)
                      return (
                        <div className={`p-2 rounded-lg ${s.box}`}>
                          <p className={`text-xs flex items-center gap-1 ${s.text}`}>
                            <TrendingUp className="w-3 h-3" /> Ganancia
                          </p>
                          <p className={`font-semibold ${s.text}`}>${g.ganancia.toLocaleString("es-CL")}</p>
                          <p className={`text-[10px] font-medium mt-0.5 ${s.text}`}>{g.margen.toFixed(1)}% margen</p>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-row sm:flex-col gap-2 sm:w-auto sm:items-end shrink-0">
                  <Select value={servicio.estado} onValueChange={(v) => handleEstadoChange(servicio.id, v)}>
                    <SelectTrigger className="h-9 text-xs bg-secondary/50 border-border w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {ESTADOS.map((e) => (
                        <SelectItem key={e} value={e} className="focus:bg-secondary">
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 bg-transparent border-border hover:bg-secondary"
                      onClick={() => onEditServicio(servicio)}
                      title="Editar"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 bg-transparent border-border hover:bg-secondary"
                      onClick={() => generarOrdenTrabajo(servicio)}
                      title="Orden de trabajo"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 bg-transparent border-border hover:bg-secondary"
                      onClick={() => { setServicioParaPdf(servicio); setPdfDialogOpen(true) }}
                      title="PDF presupuesto"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    {servicio.estado === "Cerrado/Pagado" && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 bg-green-500/5 border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={async () => {
                          const { blobUrl, fileName } = await generarReciboPDF(servicio)
                          setPdfPreview({ url: blobUrl, fileName })
                        }}
                        title="Recibo de pago"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10"
                      onClick={() => handleDelete(servicio)}
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
      </div>
    </>
  )
}
