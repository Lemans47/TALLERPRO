"use client"

import { AlertDialogAction } from "@/components/ui/alert-dialog"
import { AlertDialogCancel } from "@/components/ui/alert-dialog"
import { AlertDialogFooter } from "@/components/ui/alert-dialog"
import { AlertDialogDescription } from "@/components/ui/alert-dialog"
import { AlertDialogTitle } from "@/components/ui/alert-dialog"
import { AlertDialogHeader } from "@/components/ui/alert-dialog"
import { AlertDialogContent } from "@/components/ui/alert-dialog"
import { AlertDialog } from "@/components/ui/alert-dialog"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  Trash2,
  AlertTriangle,
  ArrowLeft,
  Database,
  Cloud,
  CheckCircle,
  Paintbrush,
  Plus,
  Save,
  Settings,
  Users,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, type PrecioPintura, type PiezaPintura } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type UsuarioRow = { id: string; email: string; role: string | null; created_at: string; last_sign_in_at: string | null }

export default function ConfiguracionPage() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [stats, setStats] = useState({ servicios: 0, gastos: 0, presupuestos: 0 })
  const [loading, setLoading] = useState(true)
  const [precioPintura, setPrecioPintura] = useState<PrecioPintura | null>(null)
  const [piezasPintura, setPiezasPintura] = useState<PiezaPintura[]>([])
  const [precioTemp, setPrecioTemp] = useState("")
  const [savingPrecio, setSavingPrecio] = useState(false)
  const [nuevaPieza, setNuevaPieza] = useState({ nombre: "", cantidad_piezas: "1" })
  const [savingPiezas, setSavingPiezas] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { role: myRole } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [usuariosLoading, setUsuariosLoading] = useState(false)
  const [usuariosError, setUsuariosError] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("operador")
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [servicios, gastos, presupuestos, precio, piezas] = await Promise.all([
        api.servicios.getAll(),
        api.gastos.getAll(),
        api.presupuestos.getAll(),
        api.precioPintura.get(),
        api.piezasPintura.getAll(),
      ])
      setStats({
        servicios: servicios.length,
        gastos: gastos.length,
        presupuestos: presupuestos.length,
      })
      setPrecioPintura(precio)
      setPrecioTemp(precio?.precio_por_pieza?.toString() || "")
      setPiezasPintura(piezas)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsuarios = async () => {
    setUsuariosLoading(true)
    setUsuariosError(null)
    try {
      const res = await fetch("/api/usuarios")
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUsuarios(data)
    } catch (e: any) {
      setUsuariosError(e.message)
    } finally {
      setUsuariosLoading(false)
    }
  }

  const invitarUsuario = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Invitación enviada", description: `Se envió un email a ${inviteEmail}` })
      setInviteEmail("")
      await loadUsuarios()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setInviting(false)
    }
  }

  const cambiarRol = async (userId: string, role: string) => {
    setSavingRole(userId)
    try {
      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUsuarios((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
      toast({ title: "Rol actualizado" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSavingRole(null)
    }
  }

  const handleSavePrecio = async () => {
    if (!precioTemp || Number.parseFloat(precioTemp) <= 0) {
      toast({ title: "Error", description: "Ingresa un precio válido", variant: "destructive" })
      return
    }
    setSavingPrecio(true)
    try {
      await api.precioPintura.update(Number.parseFloat(precioTemp))
      toast({ title: "Precio guardado", description: "El precio por pieza se actualizó correctamente" })
      await loadData()
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar el precio", variant: "destructive" })
    } finally {
      setSavingPrecio(false)
    }
  }

  const handleAddPieza = async () => {
    if (!nuevaPieza.nombre.trim()) {
      toast({ title: "Error", description: "El nombre de la pieza es requerido", variant: "destructive" })
      return
    }
    try {
      console.log("[v0] Adding pieza:", nuevaPieza)
      const result = await api.piezasPintura.create(nuevaPieza.nombre, Number.parseFloat(nuevaPieza.cantidad_piezas) || 1)
      console.log("[v0] Pieza created:", result)
      setNuevaPieza({ nombre: "", cantidad_piezas: "1" })
      toast({ title: "Pieza agregada", description: `${nuevaPieza.nombre} se agregó exitosamente` })
      await loadData()
    } catch (error: any) {
      console.error("[v0] Error adding pieza:", error)
      toast({ 
        title: "Error al agregar pieza", 
        description: error.message || "No se pudo agregar la pieza", 
        variant: "destructive" 
      })
    }
  }

  const handleUpdateCantidadPieza = async (id: string, cantidad: number) => {
    try {
      await api.piezasPintura.update(id, cantidad)
      await loadData()
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar la cantidad", variant: "destructive" })
    }
  }

  const handleDeletePieza = async (id: string) => {
    try {
      await api.piezasPintura.delete(id)
      toast({ title: "Pieza eliminada" })
      await loadData()
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la pieza", variant: "destructive" })
    }
  }

  const handleDeleteAll = async () => {
    try {
      const res = await fetch("/api/reset", { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Datos eliminados", description: "Todos los servicios, presupuestos y gastos han sido borrados." })
      setShowDeleteDialog(false)
      await loadData()
    } catch {
      toast({ title: "Error", description: "No se pudieron borrar los datos.", variant: "destructive" })
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al Dashboard
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-1">Administra la configuración de tu aplicación</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="pintura"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Paintbrush className="w-4 h-4 mr-2" />
            Precios Pintura
          </TabsTrigger>
          {myRole === "admin" && (
            <TabsTrigger
              value="usuarios"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              onClick={loadUsuarios}
            >
              <Users className="w-4 h-4 mr-2" />
              Usuarios
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          {/* Database Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Estado de la Base de Datos
              </CardTitle>
              <CardDescription>Información sobre el almacenamiento en la nube</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Conectado a Neon</p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Tus datos se sincronizan automáticamente en la nube
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-2xl font-bold">{loading ? "..." : stats.servicios}</p>
                  <p className="text-sm text-muted-foreground">Servicios</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-2xl font-bold">{loading ? "..." : stats.presupuestos}</p>
                  <p className="text-sm text-muted-foreground">Presupuestos</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-2xl font-bold">{loading ? "..." : stats.gastos}</p>
                  <p className="text-sm text-muted-foreground">Gastos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Método de almacenamiento</span>
                <span className="text-sm font-medium">Neon (PostgreSQL Serverless)</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Versión de la aplicación</span>
                <span className="text-sm font-medium">2.0.0</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-muted-foreground">Última actualización</span>
                <span className="text-sm font-medium">{new Date().toLocaleDateString("es-CL")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Zona de Peligro
              </CardTitle>
              <CardDescription>Acciones irreversibles que afectan todos tus datos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Estas acciones eliminarán permanentemente tus datos y no se pueden deshacer.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800 rounded-lg">
                <div>
                  <h3 className="font-medium">Borrar Todos los Datos</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Elimina todos los servicios, presupuestos y gastos
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Borrar Todo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Precios Pintura Tab */}
        <TabsContent value="pintura" className="space-y-6">
          {/* Sección 1: Precio Global */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paintbrush className="w-5 h-5" />
                Precio Global por Pieza
              </CardTitle>
              <CardDescription>
                Define el precio por pieza de pintura. Este valor se multiplicará por la cantidad de piezas de cada elemento.
                Por ejemplo: Si fijas $90.000 y un maletero son 2 piezas, el total será $180.000.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-2 max-w-sm">
                <div className="flex-1">
                  <Label className="text-sm mb-2 block">Valor por pieza</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">$</span>
                    <Input
                      type="number"
                      step="1000"
                      value={precioTemp}
                      onChange={(e) => setPrecioTemp(e.target.value)}
                      placeholder="90000"
                      className="text-right text-lg"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSavePrecio}
                  disabled={savingPrecio}
                  className="bg-primary"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingPrecio ? "Guardando..." : "Guardar"}
                </Button>
              </div>
              {precioPintura && (
                <div className="p-3 bg-success/10 rounded-lg border border-success/30">
                  <p className="text-sm text-success font-medium">
                    Precio actual: ${precioPintura.precio_por_pieza?.toLocaleString("es-CL") || "0"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sección 2: Lista de Piezas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paintbrush className="w-5 h-5" />
                Configurar Piezas
              </CardTitle>
              <CardDescription>
                Define cuántas piezas representa cada elemento. El precio total será: Cantidad × Precio Global.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lista de piezas */}
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Piezas Disponibles</Label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {piezasPintura.map((pieza) => (
                    <div
                      key={pieza.id}
                      className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border border-border"
                    >
                      <span className="flex-1 font-medium text-sm text-foreground">{pieza.nombre}</span>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Cantidad:</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={pieza.cantidad_piezas || 1}
                          onChange={(e) =>
                            handleUpdateCantidadPieza(pieza.id, Number.parseFloat(e.target.value) || 1)
                          }
                          className="w-20 bg-background border-border text-right text-sm"
                          placeholder="1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeletePieza(pieza.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  {piezasPintura.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No hay piezas configuradas. Agrega una nueva abajo.
                    </div>
                  )}
                </div>
              </div>

              {/* Agregar nueva pieza */}
              <div className="p-4 border border-dashed border-border rounded-lg">
                <Label className="text-sm font-medium mb-3 block">Agregar Nueva Pieza</Label>
                <div className="flex gap-2">
                  <Input
                    value={nuevaPieza.nombre}
                    onChange={(e) => setNuevaPieza((prev) => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Nombre (ej: Maletero, Capot, Espejo)"
                    className="flex-1 bg-background"
                  />
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">Cantidad:</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={nuevaPieza.cantidad_piezas}
                      onChange={(e) => setNuevaPieza((prev) => ({ ...prev, cantidad_piezas: e.target.value }))}
                      placeholder="1"
                      className="w-20 bg-background"
                    />
                  </div>
                  <Button onClick={handleAddPieza} className="bg-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usuarios Tab */}
        {myRole === "admin" && (
          <TabsContent value="usuarios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" /> Gestión de Usuarios
                </CardTitle>
                <CardDescription>Administra los roles de acceso de cada usuario.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Invite form */}
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="correo@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    type="email"
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="operador">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={invitarUsuario} disabled={inviting || !inviteEmail.trim()}>
                    <Plus className="w-4 h-4 mr-2" />
                    {inviting ? "Enviando..." : "Invitar"}
                  </Button>
                </div>

                {usuariosError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      {usuariosError.includes("SUPABASE_SERVICE_ROLE_KEY")
                        ? "Falta configurar la variable SUPABASE_SERVICE_ROLE_KEY en Vercel. Agrégala en Project Settings → Environment Variables."
                        : usuariosError}
                    </AlertDescription>
                  </Alert>
                ) : usuariosLoading ? (
                  <p className="text-muted-foreground text-sm">Cargando usuarios...</p>
                ) : usuarios.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin usuarios registrados.</p>
                ) : (
                  <div className="space-y-3">
                    {usuarios.map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-4 p-3 border border-border rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Último acceso: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("es-CL") : "nunca"}
                          </p>
                        </div>
                        <Select
                          value={u.role || ""}
                          onValueChange={(val) => cambiarRol(u.id, val)}
                          disabled={savingRole === u.id}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Sin rol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="operador">Operador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta acción eliminará permanentemente:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{stats.servicios} servicios registrados</li>
                <li>{stats.presupuestos} presupuestos</li>
                <li>{stats.gastos} gastos registrados</li>
              </ul>
              <p className="font-semibold text-destructive mt-4">Esta acción no se puede deshacer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
              Sí, borrar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
