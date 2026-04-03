"use client"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Printer, X } from "lucide-react"

interface PDFPreviewModalProps {
  url: string
  fileName: string
  onClose: () => void
}

export function PDFPreviewModal({ url, fileName, onClose }: PDFPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Revoke blob URL on unmount to free memory
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
    iframeRef.current?.contentWindow?.print()
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
      <div className="flex-1 bg-muted/30 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full h-full border-0"
          title="Vista previa del presupuesto"
        />
      </div>
    </div>
  )
}
