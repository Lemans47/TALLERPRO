import { Button } from "@/components/ui/button"
import { Plus, Settings } from "lucide-react"

export function DashboardHeader() {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Bienvenido a tu gestor de taller</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Servicio
        </Button>
      </div>
    </div>
  )
}
