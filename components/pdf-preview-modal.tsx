"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Printer, X } from "lucide-react"

interface PDFPreviewModalProps {
  url: string
  fileName: string
  onClose: () => void
}

export function PDFPreviewModal({ url, fileName, onClose }: PDFPreviewModalProps) {
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
        const scale = window.devicePixelRatio >= 2 ? 2 : 1.5

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement("canvas")
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext("2d")!

          await page.render({ canvas, canvasContext: ctx, viewport } as any).promise
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

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
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
