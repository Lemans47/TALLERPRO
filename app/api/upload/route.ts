import { NextResponse } from "next/server"
import crypto from "crypto"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!
const API_KEY = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!

function generateSignature(params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort()
  const paramString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&")
  return crypto.createHash("sha1").update(paramString + API_SECRET).digest("hex")
}

// POST /api/upload — sube una imagen a Cloudinary
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folder = (formData.get("folder") as string) || "tallerpro/ingreso"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = generateSignature({ folder, timestamp })

    const uploadForm = new FormData()
    uploadForm.append("file", file)
    uploadForm.append("api_key", API_KEY)
    uploadForm.append("timestamp", timestamp.toString())
    uploadForm.append("folder", folder)
    uploadForm.append("signature", signature)

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: uploadForm,
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Upload failed" }, { status: 500 })
    }

    return NextResponse.json({ url: data.secure_url, publicId: data.public_id })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

// DELETE /api/upload — elimina una imagen de Cloudinary por public_id
export async function DELETE(request: Request) {
  try {
    const { publicId } = await request.json()
    if (!publicId) {
      return NextResponse.json({ error: "publicId required" }, { status: 400 })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = generateSignature({ public_id: publicId, timestamp })

    const body = new URLSearchParams({
      public_id: publicId,
      api_key: API_KEY,
      timestamp: timestamp.toString(),
      signature,
    })

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
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
