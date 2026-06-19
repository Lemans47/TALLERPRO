import { NextResponse } from "next/server"
import { createPresupuesto } from "@/lib/database"
import { hoyChile } from "@/lib/utils"

// Endpoint PÚBLICO (sin sesión) para el formulario `/solicitar-presupuesto`.
// A diferencia de `/api/presupuestos` (que exige sesión), aquí solo se aceptan
// los campos que el formulario público necesita, se fuerzan los montos a 0 y
// `source = "public"`, y se valida/recorta todo lo que llega del exterior.
// Así podemos cerrar `/api/presupuestos` sin romper el flujo sin login.

const MAX_STR = 200
const MAX_OBS = 2000
const MAX_FOTOS = 15

function str(v: unknown, max = MAX_STR): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

function sanitizeFotos(raw: unknown): { url: string; publicId: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((f): f is { url: string; publicId: string } =>
      !!f && typeof f.url === "string" && typeof f.publicId === "string")
    .slice(0, MAX_FOTOS)
    .map((f) => ({ url: f.url.slice(0, 500), publicId: f.publicId.slice(0, 300) }))
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    const patente = str(data.patente, 20).toUpperCase()
    const cliente = str(data.cliente)
    const marca = str(data.marca)
    const modelo = str(data.modelo)

    if (!patente || !cliente) {
      return NextResponse.json({ error: "Patente y nombre del cliente son obligatorios" }, { status: 400 })
    }

    const añoNum = Number(data.año)
    const año = Number.isFinite(añoNum) && añoNum > 1900 && añoNum < 3000 ? Math.trunc(añoNum) : null

    const solicitud = await createPresupuesto({
      // Fecha del servidor en horario de Chile; no confiamos en la del cliente.
      fecha_ingreso: hoyChile(),
      patente,
      marca,
      modelo,
      color: str(data.color) || null,
      kilometraje: null,
      año,
      cliente,
      telefono: str(data.telefono, 40),
      observaciones: str(data.observaciones, MAX_OBS),
      iva: "sin",
      mano_obra_pintura: 0,
      cobros: [],
      costos: [],
      piezas_pintura: [],
      observaciones_checkboxes: [],
      fotos_ingreso: sanitizeFotos(data.fotos_ingreso),
      monto_total: 0,
      monto_total_sin_iva: 0,
      source: "public",
      leida: false,
    } as any)

    // No devolvemos el registro completo al público; solo confirmación.
    return NextResponse.json({ ok: true, id: solicitud.id })
  } catch (error) {
    console.error("Solicitudes POST error:", error)
    return NextResponse.json({ error: "Error creando la solicitud" }, { status: 500 })
  }
}
