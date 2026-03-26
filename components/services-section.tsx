import { ServiceCard } from "./service-card"
import { Wrench, Zap, Shield, Paintbrush } from "lucide-react"

export function ServicesSection() {
  const services = [
    {
      name: "Desabolladura Básica",
      description: "Reparación de abolladuras menores sin pintura",
      price: 150,
      status: "active" as const,
      icon: <Wrench className="w-6 h-6" />,
    },
    {
      name: "Desabolladura Premium",
      description: "Reparación completa con pintura y acabado",
      price: 350,
      status: "active" as const,
      icon: <Paintbrush className="w-6 h-6" />,
    },
    {
      name: "Reparación Eléctrica",
      description: "Diagnóstico y reparación de sistemas eléctricos",
      price: 200,
      status: "active" as const,
      icon: <Zap className="w-6 h-6" />,
    },
    {
      name: "Protección Anticorrosión",
      description: "Tratamiento preventivo contra óxido y corrosión",
      price: 250,
      status: "pending" as const,
      icon: <Shield className="w-6 h-6" />,
    },
  ]

  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Servicios Ofrecidos</h2>
        <p className="text-muted-foreground mt-2">Catálogo de servicios disponibles para tus clientes</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((service) => (
          <ServiceCard key={service.name} {...service} />
        ))}
      </div>
    </div>
  )
}
