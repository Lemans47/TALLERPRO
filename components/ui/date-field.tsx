"use client"

import * as React from "react"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { cn, formatFechaDMA } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** Parsea "YYYY-MM-DD" a un Date anclado al mediodía local (tz-safe). */
function parseYmd(value?: string | null): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.substring(0, 10).split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Formatea un Date a "YYYY-MM-DD" (mismo patrón que los forms). */
function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

interface DateFieldProps {
  /** Valor en formato "YYYY-MM-DD" (o "" si vacío). */
  value: string
  /** Emite el nuevo valor en formato "YYYY-MM-DD" (o "" si se limpia). */
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  /** Si true, muestra un botón para limpiar la fecha (deja "" ). */
  clearable?: boolean
}

/**
 * Selector de fecha con display consistente DD/MM/YYYY (independiente de la
 * config regional del navegador/SO). Mantiene el contrato de valor "YYYY-MM-DD".
 */
export function DateField({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
  id,
  disabled,
  clearable,
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseYmd(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className="truncate">{value ? formatFechaDMA(value) : placeholder}</span>
          {clearable && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar fecha"
              className="ml-auto inline-flex size-5 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                onChange("")
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange("")
                }
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toYmd(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
