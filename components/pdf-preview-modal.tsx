"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Download, Printer, X } from "lucide-react"

interface PDFPreviewModalProps {
  url: string
  fileName: string
  onClose: () => void
}

function isMobileOrTablet() {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && "ontouchend" in document)
}

export function PDFPreviewModal({ url, fileName, onClose }: PDFPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [pages, setPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsMobile(isMobileOrTablet())
  }, [])

  // Render PDF pages to canvas images on mobile
  useEffect(() => {
    if (!isMobile) {
      setLoading(false)
      return
    }

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
  }, [isMobile, url])

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
    if (isMobile) {
      // On mobile, open blob URL in new tab for native print
      window.open(url, "_blank")
    } else {
      iframeRef.current?.contentWindow?.print()
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
        {isMobile ? (
          loading ? (
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
                  className="w-full max-w-[600px] shadow-lg rounded"
                />
              ))}
            </div>
          )
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            title="Vista previa del PDF"
          />
        )}
      </div>
    </div>
  )
}
