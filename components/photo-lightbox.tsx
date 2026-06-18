"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react"
import type { FotoServicio } from "@/lib/api-client"

interface PhotoLightboxProps {
  fotos: FotoServicio[]
  initialIndex: number
  onClose: () => void
}

const ZOOM_STEP = 0.5
const MAX_ZOOM = 4
const MIN_ZOOM = 1
const SWIPE_THRESHOLD = 50

export function PhotoLightbox({ fotos, initialIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const total = fotos.length
  const foto = fotos[index]
  const isVideo = !!foto && (foto.tipo ?? "image") === "video"

  const resetView = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total)
    resetView()
  }, [total, resetView])

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % total)
    resetView()
  }, [total, resetView])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev()
      else if (e.key === "ArrowRight") goNext()
      else if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goPrev, goNext, onClose])

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  const zoomOut = () =>
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, z - ZOOM_STEP)
      if (next === 1) setOffset({ x: 0, y: 0 })
      return next
    })

  const toggleZoom = () => {
    if (zoom > 1) {
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    } else {
      setZoom(2)
    }
  }

  // Touch handling: swipe to navigate (when not zoomed), pan when zoomed
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const panStart = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    panStart.current = { ...offset }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (zoom <= 1 || !touchStart.current || !panStart.current) return
    const t = e.touches[0]
    setOffset({
      x: panStart.current.x + (t.clientX - touchStart.current.x),
      y: panStart.current.y + (t.clientY - touchStart.current.y),
    })
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    if (zoom <= 1) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x
      const dy = e.changedTouches[0].clientY - touchStart.current.y
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) goPrev()
        else goNext()
      }
    }
    touchStart.current = null
    panStart.current = null
  }

  // Mouse drag to pan when zoomed
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      })
    }
    const onUp = () => {
      dragStart.current = null
      setDragging(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragging])

  const handleDownload = async () => {
    if (!foto) return
    try {
      const res = await fetch(foto.url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const ext = isVideo ? (foto.url.split(".").pop()?.split("?")[0] || "mp4") : "jpg"
      a.download = `${foto.publicId?.split("/").pop() || (isVideo ? "video" : "foto")}.${ext}`
      a.href = blobUrl
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // Si falla la descarga directa (CORS), abrir en nueva pestaña
      window.open(foto.url, "_blank")
    }
  }

  if (!foto) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 text-white">
        <span className="text-sm font-medium tabular-nums">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-1">
          {/* El zoom solo aplica a imágenes; en video se ocultan. */}
          {!isVideo && (
            <>
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-40 transition-colors"
                aria-label="Alejar"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-40 transition-colors"
                aria-label="Acercar"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
            aria-label="Descargar"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {total > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 sm:left-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}

        {isVideo ? (
          <video
            key={foto.publicId}
            src={foto.url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <img
            src={foto.url}
            alt={`Foto ${index + 1}`}
            draggable={false}
            onDoubleClick={toggleZoom}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
              transition: dragging ? "none" : "transform 0.15s ease-out",
            }}
            className="max-w-full max-h-full object-contain touch-none"
          />
        )}

        {total > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 sm:right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}
      </div>
    </div>
  )
}
