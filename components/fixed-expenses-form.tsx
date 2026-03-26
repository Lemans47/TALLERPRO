"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createGasto } from "@/lib/local-storage"

interface FixedExpensesFormProps {
  onSave?: () => void
}

export function FixedExpensesForm({ onSave }: FixedExpensesFormProps) {
  const [formData, setFormData] = useState({
    luz: "",
    agua: "",
    contribucionesMensual: "",
    ahorroContribuciones: "",
    mantencionCuentaCorriente: "",
    fecha: new Date().toISOString().split("T")[0],
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Create individual gastos for each field
      if (formData.luz) {
        createGasto({
          categoria: "Gastos Fijos",
          descripcion: "Luz - Suministros",
          monto: Number.parseInt(formData.luz),
          fecha: formData.fecha,
        })
      }

      if (formData.agua) {
        createGasto({
          categoria: "Gastos Fijos",
          descripcion: "Agua - Suministros",
          monto: Number.parseInt(formData.agua),
          fecha: formData.fecha,
        })
      }

      if (formData.contribucionesMensual) {
        createGasto({
          categoria: "Gastos Fijos",
          descripcion: "Pago Contribuciones Mensual",
          monto: Number.parseInt(formData.contribucionesMensual),
          fecha: formData.fecha,
        })
      }

      if (formData.ahorroContribuciones) {
        createGasto({
          categoria: "Gastos Fijos",
          descripcion: "Ahorro Contribuciones",
          monto: Number.parseInt(formData.ahorroContribuciones),
          fecha: formData.fecha,
        })
      }

      if (formData.mantencionCuentaCorriente) {
        createGasto({
          categoria: "Gastos Fijos",
          descripcion: "Mantención Cuenta Corriente",
          monto: Number.parseInt(formData.mantencionCuentaCorriente),
          fecha: formData.fecha,
        })
      }

      alert("Gastos fijos registrados exitosamente")

      // Reset form
      setFormData({
        luz: "",
        agua: "",
        contribucionesMensual: "",
        ahorroContribuciones: "",
        mantencionCuentaCorriente: "",
        fecha: new Date().toISOString().split("T")[0],
      })

      onSave?.()
      window.location.reload()
    } catch (error) {
      console.error("[v0] Error saving fixed expenses:", error)
      alert("Error al guardar los gastos fijos")
    }
  }

  const calcularTotal = () => {
    return (
      Number.parseInt(formData.luz || "0") +
      Number.parseInt(formData.agua || "0") +
      Number.parseInt(formData.contribucionesMensual || "0") +
      Number.parseInt(formData.ahorroContribuciones || "0") +
      Number.parseInt(formData.mantencionCuentaCorriente || "0")
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Gastos Fijos</CardTitle>
        <CardDescription>Ingresa los gastos fijos del taller para el mes</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fecha */}
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" name="fecha" type="date" value={formData.fecha} onChange={handleChange} required />
          </div>

          {/* Suministros */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Suministros</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="luz">Luz (CLP)</Label>
                <Input
                  id="luz"
                  name="luz"
                  type="number"
                  placeholder="0"
                  value={formData.luz}
                  onChange={handleChange}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agua">Agua (CLP)</Label>
                <Input
                  id="agua"
                  name="agua"
                  type="number"
                  placeholder="0"
                  value={formData.agua}
                  onChange={handleChange}
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Contribuciones */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Contribuciones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contribucionesMensual">Pago Mensual (CLP)</Label>
                <Input
                  id="contribucionesMensual"
                  name="contribucionesMensual"
                  type="number"
                  placeholder="0"
                  value={formData.contribucionesMensual}
                  onChange={handleChange}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ahorroContribuciones">Ahorro (CLP)</Label>
                <Input
                  id="ahorroContribuciones"
                  name="ahorroContribuciones"
                  type="number"
                  placeholder="0"
                  value={formData.ahorroContribuciones}
                  onChange={handleChange}
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Mantención Cuenta Corriente */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Cuenta Corriente</h3>
            <div className="space-y-2">
              <Label htmlFor="mantencionCuentaCorriente">Mantención (CLP)</Label>
              <Input
                id="mantencionCuentaCorriente"
                name="mantencionCuentaCorriente"
                type="number"
                placeholder="0"
                value={formData.mantencionCuentaCorriente}
                onChange={handleChange}
                min="0"
              />
            </div>
          </div>

          {/* Total */}
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Total Gastos Fijos:</span>
              <span className="text-xl font-bold text-primary">${calcularTotal().toLocaleString("es-CL")}</span>
            </div>
          </div>

          {/* Botón */}
          <Button type="submit" className="w-full">
            Guardar Gastos Fijos
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
