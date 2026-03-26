"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  getTrabajadores,
  createTrabajador,
  updateTrabajador,
  deleteTrabajador,
  createGasto,
  type Trabajador,
} from "@/lib/local-storage"
import { Pencil, Trash2, DollarSign, Check, X } from "lucide-react"

export function WorkersManager() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])
  const [nombre, setNombre] = useState("")
  const [sueldoBase, setSueldoBase] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadTrabajadores()
  }, [])

  const loadTrabajadores = () => {
    const data = getTrabajadores()
    setTrabajadores(data)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombre.trim() || !sueldoBase) {
      alert("Por favor completa todos los campos")
      return
    }

    const sueldo = Number.parseInt(sueldoBase)
    if (isNaN(sueldo) || sueldo <= 0) {
      alert("El sueldo debe ser un número positivo")
      return
    }

    if (editingId) {
      updateTrabajador(editingId, {
        nombre: nombre.trim(),
        sueldo_base: sueldo,
      })
      setEditingId(null)
    } else {
      createTrabajador({
        nombre: nombre.trim(),
        sueldo_base: sueldo,
        activo: true,
      })
    }

    setNombre("")
    setSueldoBase("")
    loadTrabajadores()
  }

  const handleEdit = (trabajador: Trabajador) => {
    setEditingId(trabajador.id)
    setNombre(trabajador.nombre)
    setSueldoBase(trabajador.sueldo_base.toString())
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setNombre("")
    setSueldoBase("")
  }

  const handleDelete = (id: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de eliminar al trabajador "${nombre}"?`)) {
      if (deleteTrabajador(id)) {
        loadTrabajadores()
      } else {
        alert("Error al eliminar el trabajador")
      }
    }
  }

  const handleToggleActivo = (id: string, activo: boolean) => {
    updateTrabajador(id, { activo: !activo })
    loadTrabajadores()
  }

  const handlePagarSueldo = (trabajador: Trabajador) => {
    if (
      window.confirm(`¿Confirmar pago de sueldo a ${trabajador.nombre} por ${formatCurrency(trabajador.sueldo_base)}?`)
    ) {
      createGasto({
        fecha: new Date().toISOString().split("T")[0],
        categoria: "Sueldos",
        descripcion: `Sueldo ${trabajador.nombre} - ${new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })}`,
        monto: trabajador.sueldo_base,
      })
      alert("Pago registrado exitosamente en Gastos")
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const totalSueldos = trabajadores.filter((t) => t.activo).reduce((sum, t) => sum + t.sueldo_base, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground mb-1">Total Sueldos Mensuales (Activos)</div>
          <div className="text-2xl font-bold">{formatCurrency(totalSueldos)}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar Trabajador" : "Agregar Trabajador"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sueldo">Sueldo Base Mensual</Label>
                <Input
                  id="sueldo"
                  type="number"
                  value={sueldoBase}
                  onChange={(e) => setSueldoBase(e.target.value)}
                  placeholder="500000"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingId ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Actualizar
                    </>
                  ) : (
                    "Agregar Trabajador"
                  )}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Trabajadores ({trabajadores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Sueldo Base</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trabajadores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No hay trabajadores registrados. Agrega uno usando el formulario.
                      </TableCell>
                    </TableRow>
                  ) : (
                    trabajadores.map((trabajador) => (
                      <TableRow key={trabajador.id} className={!trabajador.activo ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{trabajador.nombre}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(trabajador.sueldo_base)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={trabajador.activo}
                              onCheckedChange={() => handleToggleActivo(trabajador.id, trabajador.activo)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {trabajador.activo ? "Activo" : "Inactivo"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handlePagarSueldo(trabajador)}
                              className="h-8 px-2"
                              disabled={!trabajador.activo}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(trabajador)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(trabajador.id, trabajador.nombre)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
