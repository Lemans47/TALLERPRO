import { NextResponse } from "next/server"
import crypto from "crypto"
import { requireRole } from "@/lib/auth-server"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET

// Validación de subida. Solo imágenes y videos cortos; todo va a carpetas
// "tallerpro/...". El límite de 1 minuto para video se valida tras la subida
// (Cloudinary devuelve `duration`) y, idealmente, también en el preset.
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp"]
const MAX_IMAGE_BYTES = 12 * 1024 * 1024 // 12 MB
const MAX_VIDEO_BYTES = 80 * 1024 * 1024 // 80 MB (respaldo; el límite real es la duración)
const MAX_VIDEO_SECONDS = 60

function cloudinaryConfigured(): boolean {
  return !!(CLOUD_NAME && API_KEY && API_SECRET)
}

function generateSignature(params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort()
  const paramString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&")
  return crypto.createHash("sha1").update(paramString + API_SECRET).digest("hex")
}

// Limita la carpeta a "tallerpro/..." para que no se pueda escribir en rutas ajenas.
function safeFolder(raw: string | null): string {
  const f = (raw || "").replace(/[^a-zA-Z0-9/_-]/g, "")
  return f.startsWith("tallerpro/") ? f : "tallerpro/ingreso"
}

// Deriva una miniatura (poster) JPG del video a partir de su secure_url.
function posterFromVideoUrl(url: string): string {
  return url.replace(/\.(mp4|mov|webm|3gp)$/i, ".jpg")
}

// POST /api/upload — sube una imagen o video corto a Cloudinary (requiere sesión)
export async function POST(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    if (!cloudinaryConfigured()) {
      return NextResponse.json({ error: "Almacenamiento de fotos no configurado" }, { status: 503 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folder = safeFolder(formData.get("folder") as string | null)

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const mime = file.type || ""
    const isImage = ALLOWED_IMAGE.includes(mime)
    const isVideo = ALLOWED_VIDEO.includes(mime)
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 415 })
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "El archivo es demasiado grande" }, { status: 413 })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = generateSignature({ folder, timestamp })

    const uploadForm = new FormData()
    uploadForm.append("file", file)
    uploadForm.append("api_key", API_KEY as string)
    uploadForm.append("timestamp", timestamp.toString())
    uploadForm.append("folder", folder)
    uploadForm.append("signature", signature)

    // `auto` deja que Cloudinary detecte si es imagen o video.
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body: uploadForm,
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("Cloudinary upload error:", data?.error?.message)
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 502 })
    }

    const tipo: "image" | "video" = data.resource_type === "video" ? "video" : "image"

    // Límite de duración para video: si excede, lo borramos y rechazamos.
    if (tipo === "video" && Number(data.duration) > MAX_VIDEO_SECONDS) {
      try {
        const ts = Math.floor(Date.now() / 1000)
        const sig = generateSignature({ public_id: data.public_id, timestamp: ts })
        await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/destroy`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            public_id: data.public_id,
            api_key: API_KEY as string,
            timestamp: ts.toString(),
            signature: sig,
          }).toString(),
        })
      } catch { /* best-effort cleanup */ }
      return NextResponse.json(
        { error: `El video supera el máximo de ${MAX_VIDEO_SECONDS} segundos` },
        { status: 413 },
      )
    }

    return NextResponse.json({
      url: data.secure_url,
      publicId: data.public_id,
      tipo,
      ...(tipo === "video" ? { poster: posterFromVideoUrl(data.secure_url) } : {}),
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

// DELETE /api/upload — elimina un archivo de Cloudinary por public_id (requiere sesión)
export async function DELETE(request: Request) {
  try {
    const denied = await requireRole()
    if (denied) return denied
    if (!cloudinaryConfigured()) {
      return NextResponse.json({ error: "Almacenamiento de fotos no configurado" }, { status: 503 })
    }

    const { publicId, resourceType } = await request.json()
    if (!publicId || typeof publicId !== "string") {
      return NextResponse.json({ error: "publicId required" }, { status: 400 })
    }
    // Solo permitimos borrar dentro de las carpetas de la app.
    if (!publicId.startsWith("tallerpro/")) {
      return NextResponse.json({ error: "publicId no permitido" }, { status: 403 })
    }

    const kind = resourceType === "video" ? "video" : "image"
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = generateSignature({ public_id: publicId, timestamp })

    const body = new URLSearchParams({
      public_id: publicId,
      api_key: API_KEY as string,
      timestamp: timestamp.toString(),
      signature,
    })

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${kind}/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    const data = await res.json()
    if (data.result !== "ok" && data.result !== "not found") {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
