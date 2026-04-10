"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { FileText, Trash2, CheckCircle, Edit, Car, User, Calendar, AlignJustify, List, ChevronDown, ChevronRight } from "lucide-react"
import { api, type Presupuesto } from "@/lib/api-client"
import { generarPDFPresupuesto } from "@/lib/pdf-presupuesto"
import { PDFPreviewModal } from "@/components/pdf-preview-modal"

interface PresupuestosTableProps {
  presupuestos: Presupuesto[]
  onEditPresupuesto: (presupuesto: Presupuesto) => void
  onConverted: () => void
  loading?: boolean
}

export function PresupuestosTable({ presupuestos, onEditPresupuesto, onConverted, loading }: PresupuestosTableProps) {
  const { toast } = useToast()
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [presupuestoParaPdf, setPresupuestoParaPdf] = useState<Presupuesto | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null)
  const [collapsed, setCollapsed] = useState(true)

  const handleDelete = async (presupuesto: Presupuesto) => {
    if (!confirm(`¿Eliminar presupuesto de ${presupuesto.patente}?`)) return
    try {
      await api.presupuestos.delete(presupuesto.id)
      onConverted()
      toast({ title: "Presupuesto eliminado" })
    } catch (error) {
      console.error("Error:", error)
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" })
    }
  }

  const handleConvertir = async (presupuesto: Presupuesto) => {
    if (!confirm(`¿Ingresar vehículo ${presupuesto.patente}? Se convertirá en servicio activo.`)) return
    try {
      await api.presupuestos.convertToServicio(presupuesto.id)
      onConverted()
      toast({ title: "Vehículo ingresado", description: "El presupuesto se convirtió en servicio activo" })
    } catch (error) {
      console.error("Error:", error)
      toast({ title: "Error", description: "No se pudo convertir", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-warning/30 bg-warning/5 p-6">
        <div className="flex items-center justify-center h-20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-warning border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Cargando presupuestos...</span>
          </div>
        </div>
      </div>
    )
  }

  if (presupuestos.length === 0) return null

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
                const { blobUrl, fileName } = await generarPDFPresupuesto(presupuestoParaPdf! as any, false)
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
                const { blobUrl, fileName } = await generarPDFPresupuesto(presupuestoParaPdf! as any, true)
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

      <div className="rounded-xl border border-dashed border-warning/30 bg-card overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-between w-full p-4 border-b border-border bg-warning/5 hover:bg-warning/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-warning" />
            <h3 className="font-semibold">Presupuestos Pendientes</h3>
            <Badge className="bg-warning/10 text-warning border-warning/30">{presupuestos.length}</Badge>
          </div>
          {collapsed ? <ChevronRight className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {/* Content */}
        {!collapsed && <div className="divide-y divide-border">
          {presupuestos.map((presupuesto) => (
            <div key={presupuesto.id} className="p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-warning" />
                    <span className="font-semibold">{presupuesto.patente}</span>
                    <span className="text-sm text-muted-foreground">
                      {presupuesto.marca} {presupuesto.modelo}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {presupuesto.cliente}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {presupuesto.fecha_ingreso?.substring(0, 10).split("-").reverse().join("-")}
                    </span>
                  </div>
                </div>

                {/* Amount and Actions */}
                <div className="flex items-center gap-4">
                  <div className="text-right p-2 rounded-lg bg-secondary/50">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold text-lg">${Number(presupuesto.monto_total).toLocaleString("es-CL")}</p>
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleConvertir(presupuesto)}
                      className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/20"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Ingresar
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 bg-transparent border-border hover:bg-secondary"
                      onClick={() => onEditPresupuesto(presupuesto)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 bg-transparent border-border hover:bg-secondary"
                      onClick={() => { setPresupuestoParaPdf(presupuesto); setPdfDialogOpen(true) }}
                      title="Generar PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10"
                      onClick={() => handleDelete(presupuesto)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>}
      </div>
    </>
  )
}
