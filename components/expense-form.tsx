"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Save, X } from "lucide-react"
import { api, type Gasto } from "@/lib/api-client"

interface ExpenseFormProps {
  defaultCategory: string
  gastoAEditar?: Gasto | null
  onSaved: () => void
  onCancel: () => void
}

export function ExpenseForm({ defaultCategory, gastoAEditar, onSaved, onCancel }: ExpenseFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const localToday = () => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`
  }

  const toDateStr = (v: any) => {
    if (!v) return localToday()
    if (v instanceof Date) {
      return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`
    }
    return String(v).substring(0, 10)
  }

  const [formData, setFormData] = useState({
    descripcion: "",
    monto: "",
    fecha: localToday(),
    pagado: true,
    tipo_documento: "boleta" as "boleta" | "factura",
  })

  useEffect(() => {
    if (gastoAEditar) {
      setFormData({
        descripcion: gastoAEditar.descripcion,
        monto: String(gastoAEditar.monto),
        fecha: toDateStr(gastoAEditar.fecha),
        pagado: gastoAEditar.pagado !== false,
        tipo_documento: gastoAEditar.tipo_documento === "factura" ? "factura" : "boleta",
      })
    } else {
      setFormData({
        descripcion: "",
        monto: "",
        fecha: localToday(),
        pagado: true,
        tipo_documento: "boleta",
      })
    }
  }, [gastoAEditar])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.descripcion || !formData.monto) {
      toast({ title: "Error", description: "Descripción y monto son requeridos", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const data = {
        categoria: defaultCategory,
        descripcion: formData.descripcion,
        monto: Number(formData.monto),
        fecha: formData.fecha,
        pagado: formData.pagado,
        tipo_documento: formData.tipo_documento,
      }

      if (gastoAEditar) {
        await api.gastos.update(gastoAEditar.id, data)
        toast({ title: "Gasto actualizado" })
      } else {
        await api.gastos.create(data)
        toast({ title: "Gasto registrado" })
      }

      setFormData({
        descripcion: "",
        monto: "",
        fecha: localToday(),
        pagado: true,
        tipo_documento: "boleta",
      })
      onSaved()
    } catch (error) {
      console.error("Error:", error)
      toast({ title: "Error", description: "No se pudo guardar el gasto", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      descripcion: "",
      monto: "",
      fecha: localToday(),
      pagado: true,
      tipo_documento: "boleta",
    })
    onCancel()
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{gastoAEditar ? "Editar Gasto" : "Nuevo Gasto"}</CardTitle>
          {gastoAEditar && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción *</Label>
            <Textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Describe el gasto..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monto (CLP) *</Label>
              <Input
                type="number"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Estado de pago</Label>
              <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  className={`flex-1 py-2 font-medium transition-colors ${formData.pagado ? "bg-green-500/20 text-green-400" : "hover:bg-secondary text-muted-foreground"}`}
                  onClick={() => setFormData({ ...formData, pagado: true })}
                >
                  ✓ Pagado
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 font-medium transition-colors ${!formData.pagado ? "bg-orange-500/20 text-orange-400" : "hover:bg-secondary text-muted-foreground"}`}
                  onClick={() => setFormData({ ...formData, pagado: false })}
                >
                  ⏳ Pendiente
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Documento</Label>
              <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  className={`flex-1 py-2 font-medium transition-colors ${formData.tipo_documento === "boleta" ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground"}`}
                  onClick={() => setFormData({ ...formData, tipo_documento: "boleta" })}
                >
                  Boleta
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 font-medium transition-colors ${formData.tipo_documento === "factura" ? "bg-blue-500/20 text-blue-400" : "hover:bg-secondary/50 text-muted-foreground"}`}
                  onClick={() => setFormData({ ...formData, tipo_documento: "factura" })}
                >
                  Factura
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {gastoAEditar ? "Actualizar" : "Guardar"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1 bg-transparent">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
