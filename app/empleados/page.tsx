"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { useMonth } from "@/lib/month-context"
import { api, type Empleado, type AbonoEmpleado } from "@/lib/api-client"
import { formatFechaDMA } from "@/lib/utils"
import { Users, Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronUp, CheckCircle } from "lucide-react"

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

export default function EmpleadosPage() {
  const { role } = useAuth()
  const { selectedMonth } = useMonth()
  const { toast } = useToast()
  const [year, month] = selectedMonth.split("-").map(Number)

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [abonos, setAbonos] = useState<AbonoEmpleado[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Dialog empleado
  const [empDialog, setEmpDialog] = useState(false)
  const [editando, setEditando] = useState<Empleado | null>(null)
  const [empForm, setEmpForm] = useState({ nombre: "", rut: "", cargo: "", sueldo_base: "" })
  const [guardando, setGuardando] = useState(false)

  // Dialog abono
  const [abonoDialog, setAbonoDialog] = useState(false)
  const [abonoEmpleado, setAbonoEmpleado] = useState<Empleado | null>(null)
  const [abonoMonto, setAbonoMonto] = useState("")
  const [abonoFecha, setAbonoFecha] = useState(new Date().toISOString().split("T")[0])
  const [abonoNota, setAbonoNota] = useState("")

  const canEdit = role === "admin" || role === "supervisor"

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [e, a] = await Promise.all([api.empleados.getAll(), api.abonos.getByMonth(year, month)])
      setEmpleados(e)
      setAbonos(a)
    } catch { toast({ title: "Error al cargar datos", variant: "destructive" }) }
    finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { cargar() }, [cargar])

  const abonosPorEmpleado = (id: string) => abonos.filter(a => a.empleado_id === id)
  const totalAbonado = (id: string) => abonosPorEmpleado(id).reduce((s, a) => s + Number(a.monto), 0)

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
    if (!confirm("¿Eliminar empleado? Se eliminarán también sus abonos.")) return
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

  // ── Abonos ──────────────────────────────────────────────────────
  const abrirAbono = (emp: Empleado) => {
    setAbonoEmpleado(emp)
    const pendiente = Number(emp.sueldo_base) - totalAbonado(emp.id)
    setAbonoMonto(String(pendiente > 0 ? pendiente : ""))
    setAbonoFecha(new Date().toISOString().split("T")[0])
    setAbonoNota("")
    setAbonoDialog(true)
  }

  const guardarAbono = async () => {
    if (!abonoEmpleado || !abonoMonto) return
    setGuardando(true)
    try {
      await api.abonos.create({
        empleado_id: abonoEmpleado.id,
        mes: month,
        año: year,
        monto: Number(abonoMonto),
        fecha: abonoFecha,
        notas: abonoNota || undefined,
        empleado_nombre: abonoEmpleado.nombre,
      })
      setAbonoDialog(false)
      await cargar()
      toast({ title: "Abono registrado", description: "Se registró en Gastos > Sueldos" })
    } catch { toast({ title: "Error al registrar abono", variant: "destructive" }) }
    finally { setGuardando(false) }
  }

  const eliminarAbono = async (id: string) => {
    if (!confirm("¿Eliminar este abono?")) return
    try {
      await api.abonos.delete(id)
      await cargar()
      toast({ title: "Abono eliminado" })
    } catch { toast({ title: "Error", variant: "destructive" }) }
  }

  // ── Totales globales ─────────────────────────────────────────────
  const activosCount = empleados.filter(e => e.activo).length
  const totalSueldos = empleados.filter(e => e.activo).reduce((s, e) => s + Number(e.sueldo_base), 0)
  const totalPagadoMes = abonos.reduce((s, a) => s + Number(a.monto), 0)
  const totalPendiente = totalSueldos - totalPagadoMes

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
            <p className="text-sm text-muted-foreground">{MESES[month - 1]} {year} · {activosCount} activos</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total sueldos mes</p>
          <p className="text-xl font-bold">${totalSueldos.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total abonado</p>
          <p className="text-xl font-bold text-success">${totalPagadoMes.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Por pagar</p>
          <p className={`text-xl font-bold ${totalPendiente > 0 ? "text-warning" : "text-success"}`}>
            ${Math.max(0, totalPendiente).toLocaleString("es-CL")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="sueldos">
        <TabsList>
          <TabsTrigger value="sueldos">Sueldos del mes</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
        </TabsList>

        {/* ── Tab Sueldos ── */}
        <TabsContent value="sueldos" className="mt-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando...</div>
          ) : empleados.filter(e => e.activo).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No hay empleados activos.</div>
          ) : empleados.filter(e => e.activo).map(emp => {
            const abEmp = abonosPorEmpleado(emp.id)
            const total = totalAbonado(emp.id)
            const sueldo = Number(emp.sueldo_base)
            const pendiente = sueldo - total
            const pct = sueldo > 0 ? Math.min(100, Math.round((total / sueldo) * 100)) : 0
            const pagadoCompleto = total >= sueldo
            const isOpen = expanded === emp.id

            return (
              <div key={emp.id} className="bg-card rounded-xl border overflow-hidden">
                {/* Fila principal */}
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{emp.nombre}</p>
                      {pagadoCompleto && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle className="w-3.5 h-3.5" /> Completo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{emp.cargo || "Sin cargo"}</p>
                    {/* Barra de progreso */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pagadoCompleto ? "bg-success" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        ${total.toLocaleString("es-CL")} / ${sueldo.toLocaleString("es-CL")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && !pagadoCompleto && (
                      <Button size="sm" className="h-8" onClick={() => abrirAbono(emp)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Abonar
                      </Button>
                    )}
                    {canEdit && pagadoCompleto && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => abrirAbono(emp)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Abonar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(isOpen ? null : emp.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Detalle abonos */}
                {isOpen && (
                  <div className="border-t border-border bg-secondary/20 px-4 pb-3 pt-2 space-y-1.5">
                    {abEmp.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Sin abonos este mes.</p>
                    ) : abEmp.map(a => (
                      <div key={a.id} className="flex items-center gap-3 text-sm py-1 border-b border-border/40 last:border-0">
                        <span className="text-muted-foreground w-24 shrink-0">
                          {formatFechaDMA(a.fecha)}
                        </span>
                        <span className="flex-1">{a.notas || "—"}</span>
                        <span className="font-semibold text-success">${Number(a.monto).toLocaleString("es-CL")}</span>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0" onClick={() => eliminarAbono(a.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-1">
                      <span>Pendiente</span>
                      <span className={pendiente > 0 ? "text-warning" : "text-success"}>
                        ${Math.max(0, pendiente).toLocaleString("es-CL")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </TabsContent>

        {/* ── Tab Equipo ── */}
        <TabsContent value="equipo" className="mt-4 space-y-2">
          {empleados.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">No hay empleados registrados.</div>
          )}
          {empleados.map(emp => (
            <div key={emp.id} className={`bg-card rounded-xl border p-4 flex items-center gap-4 ${!emp.activo ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{emp.nombre}</p>
                  {!emp.activo && <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">Inactivo</span>}
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

      {/* Dialog abono */}
      <Dialog open={abonoDialog} onOpenChange={setAbonoDialog}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar abono — {abonoEmpleado?.nombre}</DialogTitle>
          </DialogHeader>
          {abonoEmpleado && (
            <div className="text-sm text-muted-foreground pb-1">
              Sueldo base: <strong className="text-foreground">${Number(abonoEmpleado.sueldo_base).toLocaleString("es-CL")}</strong>
              {" · "}Abonado: <strong className="text-success">${totalAbonado(abonoEmpleado.id).toLocaleString("es-CL")}</strong>
            </div>
          )}
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Monto *</Label>
              <Input type="number" value={abonoMonto} onChange={e => setAbonoMonto(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={abonoFecha} onChange={e => setAbonoFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Input value={abonoNota} onChange={e => setAbonoNota(e.target.value)} placeholder="Ej: quincena" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbonoDialog(false)}>Cancelar</Button>
            <Button onClick={guardarAbono} disabled={guardando || !abonoMonto}>
              {guardando ? "Registrando..." : "Registrar abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
