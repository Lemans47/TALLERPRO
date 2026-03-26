"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, FileText } from "lucide-react"

interface ImportResult {
  success: boolean
  servicios: {
    importados: number
    actualizados: number
    errores: number
  }
  gastos: {
    importados: number
    actualizados: number
    errores: number
  }
  meses: Array<{
    mes: string
    servicios: number
    gastos: number
    totalIngresos: number
    totalGastos: number
    utilidad: number
  }>
  detalles: string[]
}

interface ImportReportProps {
  result: ImportResult
}

export function ImportReport({ result }: ImportReportProps) {
  const totalServicios = result.servicios.importados + result.servicios.actualizados
  const totalGastos = result.gastos.importados + result.gastos.actualizados

  return (
    <div className="space-y-4">
      {result.success ? (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Importación completada exitosamente
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error durante la importación</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Servicios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Importados:</span>
              <span className="font-semibold text-green-600">{result.servicios.importados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Actualizados:</span>
              <span className="font-semibold text-blue-600">{result.servicios.actualizados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Errores:</span>
              <span className="font-semibold text-red-600">{result.servicios.errores}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>{totalServicios}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Importados:</span>
              <span className="font-semibold text-green-600">{result.gastos.importados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Actualizados:</span>
              <span className="font-semibold text-blue-600">{result.gastos.actualizados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Errores:</span>
              <span className="font-semibold text-red-600">{result.gastos.errores}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>{totalGastos}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {result.meses && result.meses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.meses.map((mes, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="font-semibold text-sm mb-2">{mes.mes}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Servicios:</span>
                      <span className="ml-2 font-semibold">{mes.servicios}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gastos:</span>
                      <span className="ml-2 font-semibold">{mes.gastos}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ingresos:</span>
                      <span className="ml-2 font-semibold text-green-600">${mes.totalIngresos.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gastos:</span>
                      <span className="ml-2 font-semibold text-red-600">${mes.totalGastos.toFixed(2)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Utilidad:</span>
                      <span className={`ml-2 font-semibold ${mes.utilidad >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${mes.utilidad.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.detalles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {result.detalles.map((detalle, index) => (
                <li key={index} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{detalle}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
