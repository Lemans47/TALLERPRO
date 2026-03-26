"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, File, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ExcelUploadFormProps {
  onImport: (file: File) => void
  isLoading: boolean
}

export function ExcelUploadForm({ onImport, isLoading }: ExcelUploadFormProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    const validTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]

    if (!validTypes.includes(file.type)) {
      setError("Por favor selecciona un archivo Excel válido (.xlsx o .xls)")
      return false
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no debe superar 10MB")
      return false
    }

    setError(null)
    return true
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (validateFile(file)) {
        setSelectedFile(file)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (validateFile(file)) {
        setSelectedFile(file)
      }
    }
  }

  const handleImport = () => {
    if (selectedFile) {
      onImport(selectedFile)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />

        <div className="flex flex-col items-center gap-3">
          <Upload className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Arrastra tu archivo Excel aquí</p>
            <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
          </div>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            Seleccionar archivo
          </Button>
        </div>
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <File className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="font-medium text-sm">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(2)} KB</p>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleImport} disabled={!selectedFile || isLoading} className="w-full" size="lg">
        {isLoading ? "Importando..." : "Importar datos"}
      </Button>
    </div>
  )
}
