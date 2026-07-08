"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Printer, X } from "lucide-react"

interface PDFPreviewModalProps {
  url: string
  fileName: string
  onClose: () => void
  /** Muestra el botón de WhatsApp para compartir el PDF (elegir contacto al enviar). */
  showWhatsApp?: boolean
}

// WhatsApp no está en lucide-react (es un logo de marca); lo definimos como SVG inline.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

export function PDFPreviewModal({ url, fileName, onClose, showWhatsApp }: PDFPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Render PDF pages to canvas images on every platform.
  // Relying on the browser's native <iframe> PDF viewer is unreliable: when the
  // browser is configured to download PDFs (or PDFium is disabled) the iframe shows
  // a generic "open file" placeholder instead of the document. Rendering with pdf.js
  // guarantees a consistent preview regardless of browser settings.
  useEffect(() => {
    let cancelled = false

    async function renderPDF() {
      try {
        const pdfjsLib = await import("pdfjs-dist")
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

        const loadingTask = pdfjsLib.getDocument(url)
        const pdf = await loadingTask.promise

        const rendered: string[] = []
        // Render at high resolution so the preview stays sharp. The images are
        // displayed at ~800px CSS width, so we render well above that and let the
        // browser downscale. Cap by devicePixelRatio to avoid oversized canvases.
        const scale = Math.min(3, 2 * (window.devicePixelRatio || 1))

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement("canvas")
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext("2d")!

          await page.render({ canvas, canvasContext: ctx, viewport } as any).promise
          // PNG keeps text/line edges crisp; JPEG would blur thin table rules.
          rendered.push(canvas.toDataURL("image/png"))
        }

        if (!cancelled) {
          setPages(rendered)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error("PDF render error:", err)
          setError("No se pudo renderizar el PDF")
          setLoading(false)
        }
      }
    }

    renderPDF()
    return () => { cancelled = true }
  }, [url])

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [url])

  const handleDownload = async () => {
    // Abrir el diálogo "Guardar como" en lugar de descargar automáticamente.
    // File System Access API disponible en navegadores Chromium de escritorio.
    try {
      if ("showSaveFilePicker" in window) {
        const blob = await (await fetch(url)).blob()
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return // el usuario canceló el diálogo
      // otros errores → cae al fallback de descarga directa
    }
    // Fallback (Safari/Firefox/móvil): descarga directa
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
  }

  const handleWhatsApp = async () => {
    // Compartir el PDF real vía Web Share API: abre la hoja de compartir del sistema
    // (en móvil se elige WhatsApp y luego el contacto, adjuntando el archivo).
    try {
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], fileName, { type: "application/pdf" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName })
        return
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return // el usuario canceló la hoja de compartir
    }
    // Fallback (escritorio sin soporte de compartir archivos): abrir WhatsApp
    // para elegir el contacto y adjuntar el PDF manualmente.
    window.open("https://wa.me/", "_blank")
  }

  const handlePrint = () => {
    // Print via a temporary hidden iframe so it works regardless of the visible
    // viewer being canvas-based. Falls back to opening the PDF in a new tab.
    try {
      const frame = document.createElement("iframe")
      frame.style.position = "fixed"
      frame.style.right = "0"
      frame.style.bottom = "0"
      frame.style.width = "0"
      frame.style.height = "0"
      frame.style.border = "0"
      frame.src = url
      frame.onload = () => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
        } catch {
          window.open(url, "_blank")
        }
        // Clean up after the print dialog has had time to open
        setTimeout(() => frame.remove(), 60000)
      }
      document.body.appendChild(frame)
    } catch {
      window.open(url, "_blank")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="bg-transparent border-border gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
          {showWhatsApp && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsApp}
              className="bg-transparent border-border gap-1.5 text-[#25D366] hover:text-[#25D366]"
              title="Enviar por WhatsApp"
            >
              <WhatsAppIcon className="w-4 h-4" />
              WhatsApp
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleDownload}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
          >
            <Download className="w-4 h-4" />
            Descargar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-muted/30 overflow-auto" ref={containerRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Cargando PDF...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-4">
            {pages.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Página ${i + 1}`}
                className="w-full max-w-[800px] shadow-lg rounded bg-white"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
