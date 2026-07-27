import { NextResponse } from "next/server"
import { getServicios, getServiciosByMonth, getServiciosActivosParaLista, createServicio, updateServicio, deleteServicio, getServicioById, upsertClienteYVehiculo } from "@/lib/database"
import { parseYearMonth, montoValido } from "@/lib/utils"
import { requireRole } from "@/lib/auth-server"
import { invalidateDashboardCache } from "@/lib/dashboard-cache"
import crypto from "crypto"

// Campos monetarios de nivel superior que deben ser números finitos ≥ 0.
// `anticipo` y `saldo_pendiente` siguen validándose por compatibilidad, pero el
// servidor los ignora al escribir: se derivan de `abonos` (ver lib/pagos.ts).
const CAMPOS_MONTO = ["monto_total", "monto_total_sin_iva", "anticipo", "saldo_pendiente"] as const
function montosServicioValidos(data: Record<string, unknown>): boolean {
  return CAMPOS_MONTO.every((c) => montoValido(data[c]))
}

// `abonos` alimenta directamente el anticipo y el saldo, así que un array mal
// formado corrompería la contabilidad del servicio. Antes no se validaba nada.
function abonosValidos(data: Record<string, unknown>): boolean {
  const abonos = data.abonos
  if (abonos == null) return true
  if (!Array.isArray(abonos)) return false
  return abonos.every(
    (a) =>
      a != null &&
      typeof a === "object" &&
      typeof (a as any).fecha === "string" &&
      montoValido((a as any).monto),
  )
}

// Una violación de CHECK (scripts/14-constraints-pagos.sql) es un error del
// cliente, no del servidor: devolverla como 400 legible en vez de un 500 opaco.
function errorResponse(error: unknown, fallback: string) {
  const err = error as { code?: string; constraint?: string; message?: string }
  if (err?.code === "23514") {
    return NextResponse.json(
      { error: `Datos inconsistentes: ${err.constraint ?? err.message}` },
      { status: 400 },
    )
  }
  if (err?.message === "Servicio no encontrado") {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET

async function deleteCloudinaryAsset(publicId: string, tipo: "image" | "video" = "image") {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`).digest("hex")
  const body = new URLSearchParams({ public_id: publicId, api_key: API_KEY, timestamp: timestamp.toString(), signature })
  const kind = tipo === "video" ? "video" : "image"
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${kind}/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
}

export async function GET(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (id) {
      const servicio = await getServicioById(id)
      if (!servicio) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
      return NextResponse.json(servicio)
    }
    const activos = searchParams.get("activos")
    const ym = parseYearMonth(searchParams)

    const servicios =
      activos === "1"
        ? await getServiciosActivosParaLista()
        : ym
          ? await getServiciosByMonth(ym.year, ym.month)
          : await getServicios()

    return NextResponse.json(servicios)
  } catch (error) {
    console.error("Servicios GET error:", error)
    return NextResponse.json({ error: "Error loading servicios" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const data = await request.json()
    if (!montosServicioValidos(data)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
    }
    if (!abonosValidos(data)) {
      return NextResponse.json({ error: "Abonos inválidos" }, { status: 400 })
    }
    const servicio = await createServicio(data)
    invalidateDashboardCache()
    // Sincronizar cliente y vehículo en sus tablas
    if (servicio.cliente && servicio.patente) {
      await upsertClienteYVehiculo(servicio.cliente, servicio.telefono || "", servicio.patente, {
        marca: servicio.marca, modelo: servicio.modelo, color: servicio.color, año: servicio.año ? Number(servicio.año) : undefined,
      }).catch((e) => console.error("upsertClienteYVehiculo (POST):", e))
    }
    return NextResponse.json(servicio)
  } catch (error) {
    console.error("Servicios POST error:", error)
    return errorResponse(error, "Error creating servicio")
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const data = await request.json()
    const { id, ...updateData } = data
    if (!montosServicioValidos(updateData)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
    }
    if (!abonosValidos(updateData)) {
      return NextResponse.json({ error: "Abonos inválidos" }, { status: 400 })
    }
    const servicio = await updateServicio(id, updateData)
    invalidateDashboardCache()
    // Sincronizar cliente y vehículo en sus tablas
    if (servicio.cliente && servicio.patente) {
      await upsertClienteYVehiculo(servicio.cliente, servicio.telefono || "", servicio.patente, {
        marca: servicio.marca, modelo: servicio.modelo, color: servicio.color, año: servicio.año ? Number(servicio.año) : undefined,
      }).catch((e) => console.error("upsertClienteYVehiculo (PUT):", e))
    }
    return NextResponse.json(servicio)
  } catch (error) {
    console.error("Servicios PUT error:", error)
    return errorResponse(error, "Error updating servicio")
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    // Delete associated Cloudinary images before removing the service
    const servicio = await getServicioById(id)
    if (servicio) {
      const fotos = [...(servicio.fotos_ingreso || []), ...(servicio.fotos_entrega || [])]
      await Promise.allSettled(fotos.map((f) => deleteCloudinaryAsset(f.publicId, f.tipo ?? "image")))
    }

    await deleteServicio(id)
    invalidateDashboardCache()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Servicios DELETE error:", error)
    return NextResponse.json({ error: "Error deleting servicio" }, { status: 500 })
  }
}
