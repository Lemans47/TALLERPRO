"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Inbox, Phone, Car, Check, ChevronRight } from "lucide-react"
import type { Presupuesto } from "@/lib/database"

interface PendingSolicitudesAlertProps {
  solicitudes: Presupuesto[]
  onUpdated?: () => void
  maxItems?: number
}

export function PendingSolicitudesAlert({ solicitudes, onUpdated, maxItems = 5 }: PendingSolicitudesAlertProps) {
  const router = useRouter()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const visibles = solicitudes.filter((s) => !hidden.has(s.id))

  if (visibles.length === 0) return null

  const marcarLeida = async (id: string) => {
    setHidden((h) => new Set(h).add(id))
    try {
      await fetch(`/api/presupuestos/${id}/leer`, { method: "POST" })
      onUpdated?.()
    } catch {
      // si falla, vuelve a aparecer en el próximo refresh
    }
  }

  const verYMarcar = (id: string) => {
    // fire-and-forget: navega de inmediato y marca como leída en paralelo
    fetch(`/api/presupuestos/${id}/leer`, { method: "POST" }).catch(() => {})
    setHidden((h) => new Set(h).add(id))
    router.push("/servicios")
  }

  return (
    <div className="rounded-xl border border-warning/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-warning/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/15">
            <Inbox className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Nuevas solicitudes web
              <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/40">
                {visibles.length}
              </Badge>
            </h3>
            <p className="text-sm text-muted-foreground">
              Recibidas desde el formulario público
            </p>
          </div>
        </div>
        <Link href="/servicios">
          <Button variant="outline" size="sm" className="gap-1">
            Ver todas
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Lista */}
      <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
        {visibles.slice(0, maxItems).map((s) => (
          <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-muted/30 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium truncate">{s.cliente}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Car className="w-3.5 h-3.5" /> {s.marca} {s.modelo} {s.patente ? `· ${s.patente}` : ""}
                </span>
                <a href={`tel:${s.telefono}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Phone className="w-3.5 h-3.5" /> {s.telefono}
                </a>
              </div>
              {s.observaciones && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.observaciones}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="default" onClick={() => verYMarcar(s.id)}>Ver</Button>
              <Button size="sm" variant="ghost" onClick={() => marcarLeida(s.id)} title="Marcar como leída">
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {visibles.length > maxItems && (
          <div className="p-3 text-center text-xs text-muted-foreground">
            +{visibles.length - maxItems} más
          </div>
        )}
      </div>
    </div>
  )
}
