"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { useMonth } from "@/lib/month-context"
import { api, type Empleado, type PagoEmpleado } from "@/lib/api-client"
import { Users, Plus, Pencil, Trash2, RefreshCw, CheckCircle, Clock, DollarSign } from "lucide-react"

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

export default function EmpleadosPage() {
  const { role } = useAuth()
  const { selectedMonth } = useMonth()
  const { toast } = useToast()
  const [year, month] = selectedMonth.split("-").map(Number)

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [pagos, setPagos] = useState<PagoEmpleado[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog empleado
  const [empDialog, setEmpDialog] = useState(false)
  const [editando, setEditando] = useState<Empleado | null>(null)
  const [empForm, setEmpForm] = useState({ nombre: "", rut: "", cargo: "", sueldo_base: "" })
  const [guardando, setGuardando] = useState(false)

  // Dialog pago
  const [pagoDialog, setPagoDialog] = useState(false)
  const [pagoEmpleado, setPagoEmpleado] = useState<Empleado | null>(null)
  const [pagoMonto, setPagoMonto] = useState("")
  const [pagoNota, setPagoNota] = useState("")

  const canEdit = role === "admin" || role === "supervisor"

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [e, p] = await Promise.all([api.empleados.getAll(), api.pagosEmpleados.getByMonth(year, month)])
      setEmpleados(e)
      setPagos(p)
    } catch { toast({ title: "Error al cargar datos", variant: "destructive" }) }
    finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { cargar() }, [cargar])

  // ── Empleados CRUD ──────────────────────────────────────────────
  const abrirNuevoEmp = () => {
    setEditando(null)
    setEmpForm({ nombre: "", rut: "", cargo: "", sueldo_base: "" })
    setEmpDialog(true)
  }

  const abrirEditarEmp = (e: Empleado) => {
    setEditando(e)
    setEmpForm({ nombre: e.nombre, rut: e.rut || "", cargo: e.cargo || "", sueldo_base: String(e.sueldo_base) })
    setEmpDialog(true)
  }

  const guardarEmp = async () => {
    if (!empForm.nombre.trim()) return
    setGuardando(true)
    try {
      const payload = { nombre: empForm.nombre.trim(), rut: empForm.rut.trim() || undefined, cargo: empForm.cargo.trim() || undefined, sueldo_base: Number(empForm.sueldo_base) || 0 }
      if (editando) await api.empleados.update(editando.id, payload)
      else await api.empleados.create(payload)
      setEmpDialog(false)
      await cargar()
      toast({ title: editando ? "Empleado actualizado" : "Empleado creado" })
    } catch { toast({ title: "Error al guardar", variant: "destructive" }) }
    finally { setGuardando(false) }
  }

  const eliminarEmp = async (id: string) => {
    if (!confirm("¿Eliminar empleado? Se eliminarán también sus registros de pago.")) return
    try {
      await api.empleados.delete(id)
      await cargar()
      toast({ title: "Empleado eliminado" })
    } catch { toast({ title: "Error al eliminar", variant: "destructive" }) }
  }

  const toggleActivo = async (emp: Empleado) => {
    try {
      await api.empleados.update(emp.id, { activo: !emp.activo })
      await cargar()
    } catch { toast({ title: "Error", variant: "destructive" }) }
  }

  // ── Pagos ───────────────────────────────────────────────────────
  const abrirPago = (emp: Empleado) => {
    const existing = pagos.find(p => p.empleado_id === emp.id)
    setPagoEmpleado(emp)
    setPagoMonto(existing ? String(existing.monto) : String(emp.sueldo_base))
    setPagoNota(existing?.notas || "")
    setPagoDialog(true)
  }

  const marcarPagado = async () => {
    if (!pagoEmpleado) return
    setGuardando(true)
    try {
      await api.pagosEmpleados.upsert({
        empleado_id: pagoEmpleado.id,
        mes: month,
        año: year,
        monto: Number(pagoMonto) || pagoEmpleado.sueldo_base,
        pagado: true,
        fecha_pago: new Date().toISOString().split("T")[0],
        notas: pagoNota || undefined,
        crear_gasto: true,
        empleado_nombre: pagoEmpleado.nombre,
      })
      setPagoDialog(false)
      await cargar()
      toast({ title: "Pago registrado", description: "Se registró también en Gastos > Sueldos" })
    } catch { toast({ title: "Error al registrar pago", variant: "destructive" }) }
    finally { setGuardando(false) }
  }

  const desmarcarPagado = async (pago: PagoEmpleado) => {
    if (!confirm("¿Desmarcar como pagado?")) return
    try {
      await api.pagosEmpleados.upsert({ ...pago, pagado: false, fecha_pago: null })
      await cargar()
      toast({ title: "Pago desmarcado" })
    } catch { toast({ title: "Error", variant: "destructive" }) }
  }

  // ── Totales ─────────────────────────────────────────────────────
  const totalSueldos = empleados.filter(e => e.activo).reduce((s, e) => s + Number(e.sueldo_base), 0)
  const totalPagado = pagos.filter(p => p.pagado).reduce((s, p) => s + Number(p.monto), 0)
  const pendientes = empleados.filter(e => e.activo && !pagos.find(p => p.empleado_id === e.id && p.pagado)).length

  return (
    <div className="p-4 md:p-6 space-y-6 pt-20 md:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Empleados</h1>
            <p className="text-sm text-muted-foreground">{MESES[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={cargar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {canEdit && (
            <Button onClick={abrirNuevoEmp}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo empleado
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total sueldos</p>
          <p className="text-xl font-bold">${totalSueldos.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pagado este mes</p>
          <p className="text-xl font-bold text-success">${totalPagado.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pendientes de pago</p>
          <p className="text-xl font-bold text-warning">{pendientes}</p>
        </div>
      </div>

      <Tabs defaultValue="sueldos">
        <TabsList>
          <TabsTrigger value="sueldos">Sueldos del mes</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
        </TabsList>

        {/* ── Tab Sueldos ── */}
        <TabsContent value="sueldos" className="mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando...</div>
          ) : empleados.filter(e => e.activo).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No hay empleados activos. Agrégalos en la pestaña Equipo.</div>
          ) : (
            <div className="space-y-2">
              {empleados.filter(e => e.activo).map(emp => {
                const pago = pagos.find(p => p.empleado_id === emp.id)
                const pagado = pago?.pagado ?? false
                return (
                  <div key={emp.id} className="bg-card rounded-xl border p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{emp.nombre}</p>
                      <p className="text-sm text-muted-foreground">{emp.cargo || "Sin cargo"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${Number(pago?.monto ?? emp.sueldo_base).toLocaleString("es-CL")}</p>
                      {pago?.fecha_pago && <p className="text-xs text-muted-foreground">{new Date(pago.fecha_pago + "T12:00").toLocaleDateString("es-CL")}</p>}
                    </div>
                    {pagado ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-success/20 text-success border-success/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Pagado
                        </Badge>
                        {canEdit && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground h-7 text-xs" onClick={() => desmarcarPagado(pago!)}>
                            Desmarcar
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-warning border-warning/30">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </Badge>
                        {canEdit && (
                          <Button size="sm" className="h-8" onClick={() => abrirPago(emp)}>
                            <DollarSign className="w-3.5 h-3.5 mr-1" />
                            Pagar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Tab Equipo ── */}
        <TabsContent value="equipo" className="mt-4">
          <div className="space-y-2">
            {empleados.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground">No hay empleados registrados.</div>
            )}
            {empleados.map(emp => (
              <div key={emp.id} className={`bg-card rounded-xl border p-4 flex items-center gap-4 ${!emp.activo ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{emp.nombre}</p>
                    {!emp.activo && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{emp.cargo || "Sin cargo"}{emp.rut ? ` · ${emp.rut}` : ""}</p>
                </div>
                <p className="font-semibold">${Number(emp.sueldo_base).toLocaleString("es-CL")}</p>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditarEmp(emp)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActivo(emp)}
                      title={emp.activo ? "Desactivar" : "Activar"}>
                      <CheckCircle className={`w-3.5 h-3.5 ${emp.activo ? "text-success" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarEmp(emp.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog empleado */}
      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={empForm.nombre} onChange={e => setEmpForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Juan Pérez" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>RUT</Label>
                <Input value={empForm.rut} onChange={e => setEmpForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={empForm.cargo} onChange={e => setEmpForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Mecánico" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Sueldo base *</Label>
              <Input type="number" value={empForm.sueldo_base} onChange={e => setEmpForm(f => ({ ...f, sueldo_base: e.target.value }))} placeholder="500000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpDialog(false)}>Cancelar</Button>
            <Button onClick={guardarEmp} disabled={guardando || !empForm.nombre.trim()}>{guardando ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pago */}
      <Dialog open={pagoDialog} onOpenChange={setPagoDialog}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pago — {pagoEmpleado?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Monto a pagar</Label>
              <Input type="number" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Input value={pagoNota} onChange={e => setPagoNota(e.target.value)} placeholder="Ej: incluye bono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialog(false)}>Cancelar</Button>
            <Button onClick={marcarPagado} disabled={guardando} className="bg-success hover:bg-success/90">
              {guardando ? "Registrando..." : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
