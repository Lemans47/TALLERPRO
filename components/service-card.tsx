import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ServiceCardProps {
  name: string
  description: string
  price: number | string
  status?: "active" | "inactive" | "pending"
  icon?: React.ReactNode
}

export function ServiceCard({ name, description, price, status = "active", icon }: ServiceCardProps) {
  const statusColors = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    inactive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  }

  const statusLabels = {
    active: "Activo",
    inactive: "Inactivo",
    pending: "Pendiente",
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-start gap-3 flex-1">
          {icon && <div className="text-2xl text-primary mt-1">{icon}</div>}
          <div className="flex-1">
            <CardTitle className="text-base">{name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-primary">${price}</div>
          <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
