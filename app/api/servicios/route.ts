import { NextResponse } from "next/server"
import { getServicios, getServiciosByMonth, createServicio, updateServicio, deleteServicio, getServicioById } from "@/lib/database"
import crypto from "crypto"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET

async function deleteCloudinaryImage(publicId: string) {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`).digest("hex")
  const body = new URLSearchParams({ public_id: publicId, api_key: API_KEY, timestamp: timestamp.toString(), signature })
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")
    const month = searchParams.get("month")

    let servicios
    if (year && month) {
      servicios = await getServiciosByMonth(Number.parseInt(year), Number.parseInt(month))
    } else {
      servicios = await getServicios()
    }

    return NextResponse.json(servicios)
  } catch (error) {
    console.error("Servicios GET error:", error)
    return NextResponse.json({ error: "Error loading servicios" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const servicio = await createServicio(data)
    return NextResponse.json(servicio)
  } catch (error) {
    console.error("Servicios POST error:", error)
    return NextResponse.json({ error: "Error creating servicio" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, ...updateData } = data
    const servicio = await updateServicio(id, updateData)
    return NextResponse.json(servicio)
  } catch (error) {
    console.error("Servicios PUT error:", error)
    return NextResponse.json({ error: "Error updating servicio" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    // Delete associated Cloudinary images before removing the service
    const servicio = await getServicioById(id)
    if (servicio) {
      const fotos = [...(servicio.fotos_ingreso || []), ...(servicio.fotos_entrega || [])]
      await Promise.allSettled(fotos.map((f) => deleteCloudinaryImage(f.publicId)))
    }

    await deleteServicio(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Servicios DELETE error:", error)
    return NextResponse.json({ error: "Error deleting servicio" }, { status: 500 })
  }
}
