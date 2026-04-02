"use client"

import { useState, useEffect } from "react"
import { Copy, Zap, Pencil, Trash2, Plus, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Plantilla {
  id: string
  descripcion: string
  monto_estimado: number
}

interface Props {
  selectedMonth: string
  onGenerated: () => void
}

export function GastosFijosPlantillas({ selectedMonth, onGenerated }: Props) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ descripcion: "", monto_estimado: 0 })
  const [newForm, setNewForm] = useState({ descripcion: "", monto_estimado: 0 })
  const [showNew, setShowNew] = useState(false)
  const [mensaje, setMensaje] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    loadPlantillas()
  }, [])

  const loadPlantillas = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/gastos-fijos-plantillas")
      const data = await res.json()
      setPlantillas(data)
    } finally {
      setLoading(false)
    }
  }

  const showMsg = (text: string, ok = true) => {
    setMensaje({ text, ok })
    setTimeout(() => setMensaje(null), 3500)
  }

  const [year, month] = selectedMonth.split("-").map(Number)

  const handleGenerar = async () => {
    setGenerando(true)
    try {
      const res = await fetch("/api/gastos-fijos-plantillas?action=generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      })
      const { creados } = await res.json()
      if (creados.length > 0) {
        showMsg(`${creados.length} gasto(s) generado(s): ${creados.join(", ")}`)
        onGenerated()
      } else {
        showMsg("Ya estaban todos generados este mes", true)
      }
    } catch {
      showMsg("Error al generar", false)
    } finally {
      setGenerando(false)
    }
  }

  const handleCopiar = async () => {
    setCopiando(true)
    try {
      const res = await fetch("/api/gastos-fijos-plantillas?action=copiar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      })
      const { creados } = await res.json()
      if (creados.length > 0) {
        showMsg(`${creados.length} gasto(s) copiado(s) del mes anterior`)
        onGenerated()
      } else {
        showMsg("No hay gastos fijos del mes anterior o ya existen", true)
      }
    } catch {
      showMsg("Error al copiar", false)
    } finally {
      setCopiando(false)
    }
  }

  const handleSaveEdit = async (id: string) => {
    await fetch(`/api/gastos-fijos-plantillas?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    setEditingId(null)
    loadPlantillas()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/gastos-fijos-plantillas?id=${id}`, { method: "DELETE" })
    loadPlantillas()
  }

  const handleCreate = async () => {
    if (!newForm.descripcion.trim()) return
    await fetch("/api/gastos-fijos-plantillas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    })
    setNewForm({ descripcion: "", monto_estimado: 0 })
    setShowNew(false)
    loadPlantillas()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Plantillas de Gastos Fijos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Montos estimados por defecto cada mes</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopiar}
            disabled={copiando}
            className="text-xs gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            {copiando ? "Copiando..." : "Copiar mes anterior"}
          </Button>
          <Button
            size="sm"
            onClick={handleGenerar}
            disabled={generando}
            className="text-xs gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            {generando ? "Generando..." : "Generar este mes"}
          </Button>
        </div>
      </div>

      {mensaje && (
        <div className={`text-xs px-3 py-2 rounded-lg ${mensaje.ok ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
          {mensaje.text}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando plantillas...</p>
      ) : (
        <div className="space-y-1.5">
          {plantillas.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              {editingId === p.id ? (
                <>
                  <input
                    className="flex-1 px-2 py-1 rounded-lg border border-border bg-background text-sm"
                    value={editForm.descripcion}
                    onChange={(e) => setEditForm((f) => ({ ...f, descripcion: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="w-28 px-2 py-1 rounded-lg border border-border bg-background text-sm"
                    value={editForm.monto_estimado}
                    onChange={(e) => setEditForm((f) => ({ ...f, monto_estimado: Number(e.target.value) }))}
                  />
                  <button onClick={() => handleSaveEdit(p.id)} className="text-success hover:opacity-70"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:opacity-70"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-foreground">{p.descripcion}</span>
                  <span className="text-muted-foreground text-xs w-28 text-right">
                    {p.monto_estimado > 0 ? `$${Number(p.monto_estimado).toLocaleString("es-CL")}` : "sin monto"}
                  </span>
                  <button
                    onClick={() => { setEditingId(p.id); setEditForm({ descripcion: p.descripcion, monto_estimado: p.monto_estimado }) }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}

          {showNew ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                placeholder="Descripción"
                className="flex-1 px-2 py-1 rounded-lg border border-border bg-background text-sm"
                value={newForm.descripcion}
                onChange={(e) => setNewForm((f) => ({ ...f, descripcion: e.target.value }))}
                autoFocus
              />
              <input
                type="number"
                placeholder="Monto"
                className="w-28 px-2 py-1 rounded-lg border border-border bg-background text-sm"
                value={newForm.monto_estimado || ""}
                onChange={(e) => setNewForm((f) => ({ ...f, monto_estimado: Number(e.target.value) }))}
              />
              <button onClick={handleCreate} className="text-success hover:opacity-70"><Check className="w-4 h-4" /></button>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:opacity-70"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar plantilla
            </button>
          )}
        </div>
      )}
    </div>
  )
}
