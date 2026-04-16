"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Save,
  FileText,
  X,
  Car,
  User,
  Wrench,
  Paintbrush,
  Plus,
  Trash2,
  Settings,
  Check,
  ChevronsUpDown,
  Camera,
  Upload,
  ImageIcon,
  AlignJustify,
  List,
  BookTemplate,
  BookMarked,
  Loader2,
} from "lucide-react"
import { api, lookupPatente, type Servicio, type Presupuesto, type FotoServicio } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { generarPDFPresupuesto } from "@/lib/pdf-presupuesto"
import { PDFPreviewModal } from "@/components/pdf-preview-modal"
import { roundMoney } from "@/lib/utils"

interface ServiceFormProps {
  servicioAEditar?: (Servicio & { isPresupuesto?: boolean }) | null
  onClearEdit: () => void
  onSaved: () => void
}

const ESTADOS = [
  "En Cola",
  "En Proceso",
  "Esperando Repuestos",
  "En Reparación",
  "Control de Calidad",
  "Listo para Entrega",
  "Entregado",
  "Por Cobrar",
  "Cerrado/Pagado",
]

interface ItemDetalle {
  id: string
  descripcion: string
  monto: number
}

interface ItemsPorCategoria {
  desmontar: ItemDetalle[]
  desabolladura: ItemDetalle[]
  reparar: ItemDetalle[]
  pintura: ItemDetalle[]
  mecanica: ItemDetalle[]
  repuestos: ItemDetalle[]
  otros: ItemDetalle[]
}

interface PiezaPintura {
  nombre: string
  precio: number
  seleccionada: boolean
  cantidad_piezas?: number
}

const isAutoItem = (desc: string | null | undefined) => {
  if (!desc) return false
  const d = desc.toLowerCase()
  return d.includes("mano de obra") || d.includes("materiales pintura")
}

export function ServiceForm({ servicioAEditar, onClearEdit, onSaved }: ServiceFormProps) {
  const { toast } = useToast() // Declare useToast hook
  const [loading, setLoading] = useState(false)
  const [pdfFormatDialog, setPdfFormatDialog] = useState(false)
  const [savedPresupuesto, setSavedPresupuesto] = useState<any>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null)
  const [piezasSeleccionadas, setPiezasSeleccionadas] = useState<PiezaPintura[]>([])

  const [showPreciosModal, setShowPreciosModal] = useState(false)
  const [showManoObraModal, setShowManoObraModal] = useState(false)
  const [showMaterialesModal, setShowMaterialesModal] = useState(false)
  const [manoObraConfig, setManoObraConfig] = useState(0)
  const [materialesConfig, setMaterialesConfig] = useState(0)
  const [, setPrecioGlobalPintura] = useState(0)
  const [preciosTemp, setPreciosTemp] = useState<{ precio: number }[]>([{ precio: 0 }])

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [showEditPiezasModal, setShowEditPiezasModal] = useState(false)
  const [activeTab, setActiveTab] = useState("cobros")
  const [activeCobroTab, setActiveCobroTab] = useState("desmontar")
  const [fotosIngreso, setFotosIngreso] = useState<FotoServicio[]>([])
  const [fotosEntrega, setFotosEntrega] = useState<FotoServicio[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ patente?: boolean; cliente?: boolean }>({})
  const patenteRef = useRef<HTMLInputElement>(null)
  const clienteRef = useRef<HTMLInputElement>(null)
  const [patenteSugerencias, setPatenteSugerencias] = useState<any[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [lookingUpPatente, setLookingUpPatente] = useState(false)
  const [plantillas, setPlantillas] = useState<{ id: string; nombre: string; cobros: any; costos: any }[]>([])
  const [plantillasOpen, setPlantillasOpen] = useState(false)
  const [guardarPlantillaOpen, setGuardarPlantillaOpen] = useState(false)
  const [nombreNuevaPlantilla, setNombreNuevaPlantilla] = useState("")
  const [savingPlantilla, setSavingPlantilla] = useState(false)

  const [formData, setFormData] = useState({
    fecha_ingreso: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}` })(),
    patente: "",
    marca: "",
    modelo: "",
    color: "",
    vin: "",
    kilometraje: undefined as number | undefined,
    año: undefined as number | undefined,
    cliente: "",
    telefono: "",
    observaciones: "",
    estado: "En Cola",
    iva: "sin",
    anticipo: 0,
  })

  const [cobros, setCobros] = useState<ItemsPorCategoria>({
    desmontar: [],
    desabolladura: [],
    reparar: [],
    pintura: [],
    mecanica: [],
    repuestos: [],
    otros: [],
  })

  const [costos, setCostos] = useState<ItemsPorCategoria>({
    desmontar: [],
    desabolladura: [],
    reparar: [],
    pintura: [],
    mecanica: [],
    repuestos: [],
    otros: [],
  })

  // Cargar precios de pintura y mano de obra config al montar
  useEffect(() => {
    loadPreciosYPiezasPintura()
    loadManoObraConfig()
    loadMaterialesConfig()
    api.plantillasServicio.getAll().then(setPlantillas).catch(() => {})
  }, [])

  const loadPreciosYPiezasPintura = async () => {
    try {
      const [precio, piezas] = await Promise.all([api.precioPintura.get(), api.piezasPintura.getAll()])

      // Guardar el precio global
      const precioGlobal = precio?.precio_por_pieza || 0
      setPrecioGlobalPintura(precioGlobal)
      setPreciosTemp([{ precio: precioGlobal }])

      // En modo edición, no sobrescribir las piezas — las carga cargarPiezasSeleccionadas
      if (servicioAEditar) return

      if (Array.isArray(piezas) && piezas.length > 0) {
        const piezasConPrecio = piezas.map((p) => ({
          nombre: p.nombre,
          precio: precioGlobal,
          cantidad_piezas: Number(p.cantidad_piezas) || 1,
          seleccionada: false,
        }))
        setPiezasSeleccionadas(piezasConPrecio)
      } else {
        setPiezasSeleccionadas([])
      }
    } catch (error) {
      console.error("Error loading piezas pintura:", error)
      if (!servicioAEditar) setPiezasSeleccionadas([])
    }
  }

  const loadManoObraConfig = () => {
    // Cargar valor guardado de mano de obra (localStorage como config simple)
    const saved = localStorage.getItem("mano_obra_pintura_default")
    if (saved) {
      setManoObraConfig(Number(saved))
    }
  }

  const saveManoObraConfig = () => {
    localStorage.setItem("mano_obra_pintura_default", manoObraConfig.toString())
    toast({ title: "Valor de mano de obra guardado" })
    setShowManoObraModal(false)
  }

  const loadMaterialesConfig = () => {
    // Cargar valor guardado de materiales (localStorage como config simple)
    const saved = localStorage.getItem("materiales_pintura_default")
    if (saved) {
      setMaterialesConfig(Number(saved))
    }
  }

  const saveMaterialesConfig = () => {
    localStorage.setItem("materiales_pintura_default", materialesConfig.toString())
    toast({ title: "Valor de materiales guardado" })
    setShowMaterialesModal(false)
  }

  const savePreciosPintura = async () => {
    try {
      const nuevoPrecio = preciosTemp[0]?.precio || 0
      
      if (nuevoPrecio <= 0) {
        toast({
          title: "Error",
          description: "El precio debe ser mayor a 0",
          variant: "destructive",
        })
        return
      }

      // Guardar el precio global
      await api.precioPintura.update(nuevoPrecio)

      // Actualizar las piezas seleccionadas con el nuevo precio
      setPiezasSeleccionadas((prev) =>
        prev.map((p) => ({ ...p, precio: nuevoPrecio })),
      )

      toast({ title: "Precio guardado", description: `Precio por pieza: $${nuevoPrecio.toLocaleString("es-CL")}` })
      setShowPreciosModal(false)
    } catch (error: any) {
      console.error("[v0] Error saving precio pintura:", error)
      toast({
        title: "Error al guardar precio",
        description: error.message,
        variant: "destructive",
      })
    }
  }



  useEffect(() => {
    if (servicioAEditar) {
      setFormData({
        fecha_ingreso: (() => {
          const v: any = servicioAEditar.fecha_ingreso
          if (v instanceof Date) {
            const y = v.getFullYear(), m = String(v.getMonth()+1).padStart(2,"0"), d = String(v.getDate()).padStart(2,"0")
            return `${y}-${m}-${d}`
          }
          return String(v).split("T")[0]
        })(),
        patente: servicioAEditar.patente,
        marca: servicioAEditar.marca || "",
        modelo: servicioAEditar.modelo || "",
        color: servicioAEditar.color || "",
        vin: (servicioAEditar as any).vin || "",
        kilometraje: servicioAEditar.kilometraje,
        año: servicioAEditar.año,
        cliente: servicioAEditar.cliente,
        telefono: servicioAEditar.telefono || "",
        observaciones: servicioAEditar.observaciones || "",
        estado: servicioAEditar.estado || "En Cola",
        iva: servicioAEditar.iva || "sin",
        anticipo: Number(servicioAEditar.anticipo) || 0,
      })

      // Cargar cobros por categoría
      const parseToFlatArray = (v: any): any[] => {
        let val = v
        // Unwrap all layers of JSON string encoding (data may be double/triple encoded)
        while (typeof val === "string" && val) {
          try { val = JSON.parse(val) } catch { return [] }
        }
        if (Array.isArray(val)) return val
        if (val && typeof val === "object") {
          // Old format: {pintura: [...], mecanica: [...]} → flatten to [{categoria, descripcion, monto}]
          return Object.entries(val).flatMap(([cat, items]: [string, any]) =>
            Array.isArray(items) ? items.map((i: any) => ({ ...i, categoria: cat })) : []
          )
        }
        return []
      }
      const cobrosData = parseToFlatArray(servicioAEditar.cobros)
      console.log("[v0] cobrosData from servicio:", cobrosData)
      const newCobros: ItemsPorCategoria = {
        desmontar: [],
        desabolladura: [],
        reparar: [],
        pintura: [],
        mecanica: [],
        repuestos: [],
        otros: [],
      }
      const normalizeCat = (raw: string | undefined): keyof ItemsPorCategoria => {
        if (!raw) return "otros"
        const s = raw.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const map: Record<string, keyof ItemsPorCategoria> = {
          desmontar: "desmontar", "desmontar y montar": "desmontar",
          desabolladura: "desabolladura",
          reparar: "reparar",
          pintura: "pintura",
          mecanica: "mecanica",
          repuestos: "repuestos",
          otros: "otros",
        }
        return map[s] ?? "otros"
      }
      cobrosData.forEach((c: { categoria?: string; descripcion: string; monto: number }) => {
        const cat = normalizeCat(c.categoria)
        newCobros[cat].push({ id: crypto.randomUUID(), descripcion: c.descripcion, monto: c.monto })
      })
      console.log("[v0] newCobros after mapping:", newCobros)
      setCobros(newCobros)

      // Cargar costos por categoría
      const costosData = parseToFlatArray(servicioAEditar.costos)
      console.log("[v0] costosData from servicio:", costosData)
      const newCostos: ItemsPorCategoria = {
        desmontar: [],
        desabolladura: [],
        reparar: [],
        pintura: [],
        mecanica: [],
        repuestos: [],
        otros: [],
      }
      costosData.forEach((c: { categoria?: string; descripcion: string; monto: number }) => {
        // Skip auto-generated pintura cost items — they'll be recalculated from selected piezas
        if (isAutoItem(c.descripcion)) return
        const cat = normalizeCat(c.categoria)
        newCostos[cat].push({ id: crypto.randomUUID(), descripcion: c.descripcion, monto: c.monto })
      })
      console.log("[v0] newCostos after mapping:", newCostos)
      setCostos(newCostos)

      // Cargar piezas de pintura seleccionadas
      const cargarPiezasSeleccionadas = async () => {
        try {
          const [precio, piezas] = await Promise.all([api.precioPintura.get(), api.piezasPintura.getAll()])
          const precioGlobal = precio?.precio_por_pieza || 0
          const piezasData = Array.isArray(servicioAEditar.piezas_pintura) ? servicioAEditar.piezas_pintura : (typeof servicioAEditar.piezas_pintura === "string" ? JSON.parse(servicioAEditar.piezas_pintura) : [])
          
          if (Array.isArray(piezas) && piezas.length > 0) {
            const piezasConPrecio = piezas.map((p) => {
              const saved = piezasData.find((pd: { nombre: string; cantidad: number }) => pd.nombre === p.nombre)
              return {
                nombre: p.nombre,
                precio: precioGlobal,
                cantidad_piezas: saved ? Number(saved.cantidad) || 1 : Number(p.cantidad_piezas) || 1,
                seleccionada: !!saved,
              }
            })
            setPiezasSeleccionadas(piezasConPrecio)
          }
        } catch (error) {
          console.error("Error loading piezas for edit:", error)
        }
      }
      
      cargarPiezasSeleccionadas()

      // Cargar fotos existentes
      const parseArr = (v: any) => Array.isArray(v) ? v : (typeof v === "string" && v ? JSON.parse(v) : [])
      setFotosIngreso(parseArr(servicioAEditar.fotos_ingreso))
      setFotosEntrega(parseArr(servicioAEditar.fotos_entrega))
    } else {
      setFotosIngreso([])
      setFotosEntrega([])
    }
  }, [servicioAEditar])

  const resetForm = () => {
    setFormData({
      fecha_ingreso: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}` })(),
      patente: "",
      marca: "",
      modelo: "",
      color: "",
      vin: "",
      kilometraje: undefined,
      año: undefined,
      cliente: "",
      telefono: "",
      observaciones: "",
      estado: "En Cola",
      iva: "sin",
      anticipo: 0,
    })
    setCobros({
      desmontar: [],
      desabolladura: [],
      reparar: [],
      pintura: [],
      mecanica: [],
      repuestos: [],
      otros: [],
    })
    setCostos({
      desmontar: [],
      desabolladura: [],
      reparar: [],
      pintura: [],
      mecanica: [],
      repuestos: [],
      otros: [],
    })
    setPiezasSeleccionadas((prev) => {
      if (Array.isArray(prev) && prev.length > 0) {
        return prev.map((p) => ({ ...p, seleccionada: false }))
      }
      return []
    })
    setFotosIngreso([])
    setFotosEntrega([])
    onClearEdit()
  }

  // Funciones para fotos
  const handleUploadFoto = async (file: File, tipo: "ingreso" | "entrega") => {
    const MAX = tipo === "ingreso" ? 5 : 2
    const current = tipo === "ingreso" ? fotosIngreso : fotosEntrega
    if (current.length >= MAX) {
      toast({ title: "Límite alcanzado", description: `Máximo ${MAX} fotos de ${tipo}`, variant: "destructive" })
      return
    }
    setUploadingFoto(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("upload_preset", "tallerpro")
      form.append("folder", `tallerpro/${tipo}`)
      // Upload directo a Cloudinary desde el navegador (unsigned preset)
      const res = await fetch("https://api.cloudinary.com/v1_1/dzjtujwor/image/upload", {
        method: "POST",
        body: form,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error?.message || "Upload failed")
      const setter = tipo === "ingreso" ? setFotosIngreso : setFotosEntrega
      setter((prev) => [...prev, { url: data.secure_url, publicId: data.public_id }])
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo subir la foto", variant: "destructive" })
    } finally {
      setUploadingFoto(false)
    }
  }

  const handleDeleteFoto = async (publicId: string, tipo: "ingreso" | "entrega") => {
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      })
      const setter = tipo === "ingreso" ? setFotosIngreso : setFotosEntrega
      setter((prev) => prev.filter((f) => f.publicId !== publicId))
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar la foto", variant: "destructive" })
    }
  }

  // Funciones para manejar cobros
  const addItemCobro = useCallback((categoria: keyof ItemsPorCategoria) => {
    const newId = crypto.randomUUID()
    const newItem = { id: newId, descripcion: "", monto: 0 }

    // Agregar en cobros
    setCobros((prev) => ({
      ...prev,
      [categoria]: [...prev[categoria], newItem],
    }))

    // Agregar automáticamente en costos con el mismo ID
    setCostos((prev) => ({
      ...prev,
      [categoria]: [...prev[categoria], { ...newItem }],
    }))
  }, [])

  const updateItemCobro = useCallback(
    (categoria: keyof ItemsPorCategoria, id: string, field: "descripcion" | "monto", value: string | number) => {
      setCobros((prev) => ({
        ...prev,
        [categoria]: prev[categoria].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
      }))

      if (field === "descripcion") {
        setCostos((prev) => ({
          ...prev,
          [categoria]: prev[categoria].map((item) =>
            item.id === id ? { ...item, descripcion: value as string } : item,
          ),
        }))
      }
    },
    [],
  )

  const removeItemCobro = useCallback((categoria: keyof ItemsPorCategoria, id: string) => {
    // Remover de cobros
    setCobros((prev) => ({
      ...prev,
      [categoria]: prev[categoria].filter((item) => item.id !== id),
    }))

    setCostos((prev) => ({
      ...prev,
      [categoria]: prev[categoria].filter((item) => item.id !== id),
    }))
  }, [])

  const upsertItemCostoByIndex = useCallback(
    (categoria: keyof ItemsPorCategoria, index: number, field: "descripcion" | "monto", value: string | number) => {
      setCostos((prev) => {
        const arr = [...prev[categoria]]
        if (arr[index]) {
          arr[index] = { ...arr[index], [field]: value }
        } else {
          while (arr.length < index) arr.push({ id: crypto.randomUUID(), descripcion: "", monto: 0 })
          arr[index] = { id: crypto.randomUUID(), descripcion: "", monto: field === "monto" ? (value as number) : 0 }
        }
        return { ...prev, [categoria]: arr }
      })
    },
    [],
  )



  const cargarPlantilla = (plantilla: { cobros: any; costos: any }) => {
    const emptyCategoria = (): ItemsPorCategoria => ({
      desmontar: [], desabolladura: [], reparar: [], pintura: [], mecanica: [], repuestos: [], otros: [],
    })
    const parsedCobros: ItemsPorCategoria = emptyCategoria()
    const parsedCostos: ItemsPorCategoria = emptyCategoria()
    const cats: (keyof ItemsPorCategoria)[] = ["desmontar", "desabolladura", "reparar", "pintura", "mecanica", "repuestos", "otros"]
    const items = Array.isArray(plantilla.cobros) ? plantilla.cobros : []
    items.forEach((c: any) => {
      const cat: keyof ItemsPorCategoria = cats.includes(c.categoria) ? c.categoria as keyof ItemsPorCategoria : "otros"
      parsedCobros[cat].push({ id: crypto.randomUUID(), descripcion: c.descripcion, monto: Number(c.monto) || 0 })
    })
    const costoItems = Array.isArray(plantilla.costos) ? plantilla.costos : []
    costoItems.forEach((c: any) => {
      if (c.isAuto) return
      const cat: keyof ItemsPorCategoria = cats.includes(c.categoria) ? c.categoria as keyof ItemsPorCategoria : "otros"
      parsedCostos[cat].push({ id: crypto.randomUUID(), descripcion: c.descripcion, monto: Number(c.monto) || 0 })
    })
    setCobros(parsedCobros)
    setCostos(parsedCostos)
    setPlantillasOpen(false)
    toast({ title: "Plantilla cargada" })
  }

  const handleGuardarPlantilla = async () => {
    if (!nombreNuevaPlantilla.trim()) return
    setSavingPlantilla(true)
    try {
      const cobrosArray: any[] = []
      const costosArray: any[] = []
      Object.entries(cobros).forEach(([cat, items]) => {
        items.forEach((i: ItemDetalle) => {
          if (i.descripcion || i.monto) cobrosArray.push({ categoria: cat, descripcion: i.descripcion, monto: i.monto })
        })
      })
      Object.entries(costos).forEach(([cat, items]) => {
        items.forEach((i: ItemDetalle) => {
          if (i.descripcion || i.monto) costosArray.push({ categoria: cat, descripcion: i.descripcion, monto: i.monto })
        })
      })
      const nueva = await api.plantillasServicio.create({ nombre: nombreNuevaPlantilla.trim(), cobros: cobrosArray, costos: costosArray })
      setPlantillas((prev) => [...prev, nueva])
      setGuardarPlantillaOpen(false)
      setNombreNuevaPlantilla("")
      toast({ title: "Plantilla guardada" })
    } catch {
      toast({ title: "Error guardando plantilla", variant: "destructive" })
    } finally {
      setSavingPlantilla(false)
    }
  }

  const handleEliminarPlantilla = async (id: string) => {
    try {
      await api.plantillasServicio.delete(id)
      setPlantillas((prev) => prev.filter((p) => p.id !== id))
      toast({ title: "Plantilla eliminada" })
    } catch {
      toast({ title: "Error eliminando plantilla", variant: "destructive" })
    }
  }



  // Calcular totales
  const totalPiezasPintura = Array.isArray(piezasSeleccionadas)
    ? piezasSeleccionadas
        .filter((p) => p.seleccionada)
        .reduce((sum, p) => sum + p.precio * (p.cantidad_piezas || 1), 0)
    : 0

  // Cantidad de piezas seleccionadas (suma de cantidad_piezas por pieza)
  // Usar Number() para garantizar aritmética numérica (DB puede retornar strings para decimales)
  const cantidadPiezasAuto = Array.isArray(piezasSeleccionadas)
    ? piezasSeleccionadas
        .filter((p) => p.seleccionada)
        .reduce((sum, p) => sum + (Number(p.cantidad_piezas) || 1), 0)
    : 0

  // Costos de mano de obra y materiales calculados automáticamente por pieza
  const autoCostoManoObra = cantidadPiezasAuto * (Number(manoObraConfig) || 0)
  const autoCostoMateriales = cantidadPiezasAuto * (Number(materialesConfig) || 0)

  const safeArr = (v: any): ItemDetalle[] => Array.isArray(v) ? v : []
  const totalCobros = Object.values(cobros)
    .flatMap((v) => safeArr(v))
    .reduce((sum, item) => sum + (Number(item.monto) || 0), 0)

  const costosOtros = [...safeArr(costos.desmontar), ...safeArr(costos.desabolladura), ...safeArr(costos.reparar), ...safeArr(costos.mecanica), ...safeArr(costos.repuestos), ...safeArr(costos.otros)]
    .reduce((sum, item) => sum + (Number(item.monto) || 0), 0)

  // costos.pintura nunca contiene auto-items (se filtran al cargar) — sumar manual + recalculado
  const costosManualPintura = safeArr(costos.pintura).reduce((sum, item) => sum + (Number(item.monto) || 0), 0)

  const totalCostos = costosManualPintura + costosOtros + autoCostoManoObra + autoCostoMateriales

  const cobroTotal = totalPiezasPintura + totalCobros
  const montoIVA = formData.iva === "con" ? roundMoney(cobroTotal * 0.19) : 0
  const montoConIva = cobroTotal + montoIVA
  const utilidad = cobroTotal - totalCostos

  const validateRequiredFields = () => {
    const errors: { patente?: boolean; cliente?: boolean } = {}
    if (!formData.patente) errors.patente = true
    if (!formData.cliente) errors.cliente = true
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const firstRef = errors.patente ? patenteRef : clienteRef
      firstRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      firstRef.current?.focus()
      return false
    }
    setFieldErrors({})
    return true
  }

  const buscarPatente = async (valor: string) => {
    if (valor.length < 3) { setPatenteSugerencias([]); setMostrarSugerencias(false); return }
    try {
      const res = await fetch(`/api/buscar-patente?q=${encodeURIComponent(valor)}`)
      const data = await res.json()
      setPatenteSugerencias(data)
      setMostrarSugerencias(data.length > 0)
    } catch { setPatenteSugerencias([]) }
  }

  const seleccionarSugerencia = (s: any) => {
    setFormData((prev) => ({
      ...prev,
      patente: s.patente,
      marca: s.marca || prev.marca,
      modelo: s.modelo || prev.modelo,
      color: s.color || prev.color,
      año: s.año ? Number(s.año) : prev.año,
      kilometraje: s.kilometraje ? Number(s.kilometraje) : prev.kilometraje,
      cliente: s.cliente || prev.cliente,
      telefono: s.telefono || prev.telefono,
    }))
    setPatenteSugerencias([])
    setMostrarSugerencias(false)
    if (fieldErrors.patente) setFieldErrors((prev) => ({ ...prev, patente: false }))
  }

  const handleSubmit = async () => {
    console.log("[v0] handleSubmit called")
    if (!validateRequiredFields()) return

    setLoading(true)
    try {
      console.log("[v0] Starting handleSubmit with formData:", formData)
      // Convertir cobros por categoría a array con descripción
      const cobrosArray: { categoria: string; descripcion: string; monto: number }[] = []
      Object.entries(cobros).forEach(([categoria, items]) => {
        safeArr(items).forEach((item) => {
          if (item.monto > 0 || item.descripcion) {
            cobrosArray.push({ categoria, descripcion: item.descripcion || categoria, monto: item.monto })
          }
        })
      })

      // Convertir costos por categoría a array con descripción
      // Para pintura: excluir items auto-gestionados (se recalculan abajo)
      const costosArray: { categoria: string; descripcion: string; monto: number; isAuto?: boolean }[] = []
      Object.entries(costos).forEach(([categoria, items]) => {
        safeArr(items).forEach((item) => {
          if (item.monto > 0 || item.descripcion) {
            if (categoria === "pintura" && isAutoItem(item.descripcion)) return
            costosArray.push({ categoria, descripcion: item.descripcion || categoria, monto: item.monto })
          }
        })
      })
      // Agregar costos auto-calculados de pintura basados en piezas seleccionadas
      const cantidadPiezasSave = piezasSeleccionadas
        .filter((p) => p.seleccionada)
        .reduce((sum, p) => sum + (Number(p.cantidad_piezas) || 1), 0)
      if (manoObraConfig > 0 && cantidadPiezasSave > 0) {
        costosArray.push({
          categoria: "pintura",
          descripcion: `Mano de Obra Pintura (${cantidadPiezasSave} pieza${cantidadPiezasSave !== 1 ? "s" : ""})`,
          monto: cantidadPiezasSave * manoObraConfig,
          isAuto: true,
        })
      }
      if (materialesConfig > 0 && cantidadPiezasSave > 0) {
        costosArray.push({
          categoria: "pintura",
          descripcion: `Materiales Pintura (${cantidadPiezasSave} pieza${cantidadPiezasSave !== 1 ? "s" : ""})`,
          monto: cantidadPiezasSave * materialesConfig,
          isAuto: true,
        })
      }

      const piezasPinturaArray = piezasSeleccionadas
        .filter((p) => p.seleccionada)
        .map((p) => ({
          nombre: p.nombre,
          cantidad: p.cantidad_piezas || 1,
          precio: p.precio * (p.cantidad_piezas || 1),
        }))

      const anticipoFinal = formData.anticipo || ((servicioAEditar && !servicioAEditar.isPresupuesto)
        ? Number(servicioAEditar.anticipo) || 0
        : 0)
      const saldoPendiente = Math.max(0, montoConIva - anticipoFinal)

      const servicioData = {
        fecha_ingreso: formData.fecha_ingreso,
        patente: formData.patente.toUpperCase(),
        marca: formData.marca,
        modelo: formData.modelo,
        color: formData.color,
        kilometraje: formData.kilometraje,
        año: formData.año,
        cliente: formData.cliente,
        telefono: formData.telefono,
        observaciones: formData.observaciones,
        mano_obra_pintura: manoObraConfig,
        cobros: cobrosArray,
        costos: costosArray,
        piezas_pintura: piezasPinturaArray,
        estado: formData.estado,
        iva: formData.iva,
        anticipo: anticipoFinal,
        saldo_pendiente: saldoPendiente,
        monto_total_sin_iva: cobroTotal,
        monto_total: montoConIva,
        observaciones_checkboxes: [],
        fotos_ingreso: fotosIngreso,
        fotos_entrega: fotosEntrega,
      }

      console.log("[v0] servicioData prepared:", servicioData)

      if (servicioAEditar && !servicioAEditar.isPresupuesto && servicioAEditar.id) {
        console.log("[v0] Updating existing servicio:", servicioAEditar.id)
        await api.servicios.update(servicioAEditar.id, servicioData)
        toast({ title: "Servicio actualizado" })
      } else {
        console.log("[v0] Creating new servicio")
        const newServicio = await api.servicios.create(
          servicioData as Omit<Servicio, "id" | "created_at" | "updated_at">,
        )
        console.log("[v0] Servicio created:", newServicio)

        if (servicioAEditar?.isPresupuesto && servicioAEditar.id) {
          console.log("[v0] Deleting presupuesto after conversion:", servicioAEditar.id)
          await api.presupuestos.delete(servicioAEditar.id)
        }

        toast({ title: "Servicio guardado" })
      }
      console.log("[v0] Calling onSaved")
      onSaved()
      resetForm()
    } catch (error) {
      console.error("[v0] Error saving:", error)
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handlePresupuesto = async () => {
    console.log("[v0] handlePresupuesto called")
    if (!validateRequiredFields()) return

    setLoading(true)
    try {
      console.log("[v0] Starting handlePresupuesto with formData:", formData)
      // Convertir cobros por categoría a array con descripción
      const cobrosArray: { categoria: string; descripcion: string; monto: number }[] = []
      Object.entries(cobros).forEach(([categoria, items]) => {
        safeArr(items).forEach((item) => {
          if (item.monto > 0 || item.descripcion) {
            cobrosArray.push({ categoria, descripcion: item.descripcion || categoria, monto: item.monto })
          }
        })
      })

      // Convertir costos por categoría a array con descripción
      // Para pintura: excluir items auto-gestionados (se recalculan abajo)
      const costosArray: { categoria: string; descripcion: string; monto: number; isAuto?: boolean }[] = []
      Object.entries(costos).forEach(([categoria, items]) => {
        safeArr(items).forEach((item) => {
          if (item.monto > 0 || item.descripcion) {
            if (categoria === "pintura" && isAutoItem(item.descripcion)) return
            costosArray.push({ categoria, descripcion: item.descripcion || categoria, monto: item.monto })
          }
        })
      })
      const cantidadPiezasSaveP = piezasSeleccionadas
        .filter((p) => p.seleccionada)
        .reduce((sum, p) => sum + (Number(p.cantidad_piezas) || 1), 0)
      if (manoObraConfig > 0 && cantidadPiezasSaveP > 0) {
        costosArray.push({
          categoria: "pintura",
          descripcion: `Mano de Obra Pintura (${cantidadPiezasSaveP} pieza${cantidadPiezasSaveP !== 1 ? "s" : ""})`,
          monto: cantidadPiezasSaveP * manoObraConfig,
          isAuto: true,
        })
      }
      if (materialesConfig > 0 && cantidadPiezasSaveP > 0) {
        costosArray.push({
          categoria: "pintura",
          descripcion: `Materiales Pintura (${cantidadPiezasSaveP} pieza${cantidadPiezasSaveP !== 1 ? "s" : ""})`,
          monto: cantidadPiezasSaveP * materialesConfig,
          isAuto: true,
        })
      }

      const piezasPinturaArray = piezasSeleccionadas
        .filter((p) => p.seleccionada)
        .map((p) => ({
          nombre: p.nombre,
          cantidad: p.cantidad_piezas || 1,
          precio: p.precio * (p.cantidad_piezas || 1),
        }))

      const presupuestoData = {
        fecha_ingreso: formData.fecha_ingreso,
        patente: formData.patente.toUpperCase(),
        marca: formData.marca,
        modelo: formData.modelo,
        color: formData.color,
        kilometraje: formData.kilometraje,
        año: formData.año,
        cliente: formData.cliente,
        telefono: formData.telefono,
        observaciones: formData.observaciones,
        mano_obra_pintura: manoObraConfig,
        cobros: cobrosArray,
        costos: costosArray,
        piezas_pintura: piezasPinturaArray,
        iva: formData.iva,
        monto_total: montoConIva,
        monto_total_sin_iva: cobroTotal,
        observaciones_checkboxes: [],
      }

      console.log("[v0] presupuestoData prepared:", presupuestoData)

      let newPresupuesto: Presupuesto
      if (servicioAEditar?.isPresupuesto && servicioAEditar.id) {
        newPresupuesto = await api.presupuestos.update(servicioAEditar.id, presupuestoData)
        toast({ title: "Presupuesto actualizado" })
      } else {
        newPresupuesto = await api.presupuestos.create(
          presupuestoData as Omit<Presupuesto, "id" | "created_at" | "updated_at">,
        )
        toast({ title: "Presupuesto creado" })
      }
      console.log("[v0] Presupuesto saved:", newPresupuesto)
      if (newPresupuesto) {
        setSavedPresupuesto(newPresupuesto)
        setPdfFormatDialog(true)
      }
      console.log("[v0] Calling onSaved")
      onSaved()
      resetForm()
    } catch (error) {
      console.error("[v0] Error saving presupuesto:", error)
      toast({ title: "Error", description: "No se pudo guardar el presupuesto", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <TooltipProvider>
      {/* PDF Preview Modal */}
      {pdfPreview && (
        <PDFPreviewModal
          url={pdfPreview.url}
          fileName={pdfPreview.fileName}
          onClose={() => setPdfPreview(null)}
        />
      )}

      {/* PDF format picker dialog */}
      <Dialog open={pdfFormatDialog} onOpenChange={setPdfFormatDialog}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Generar Presupuesto PDF</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Elige el formato del presupuesto:</p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={async () => {
                const { blobUrl, fileName } = await generarPDFPresupuesto(savedPresupuesto, false)
                setPdfPreview({ url: blobUrl, fileName })
                setPdfFormatDialog(false)
              }}
            >
              <AlignJustify className="w-6 h-6 text-primary" />
              <span className="font-semibold text-sm">Con detalle</span>
              <span className="text-xs text-muted-foreground text-center">Cada item con subtotal por categoría</span>
            </button>
            <button
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={async () => {
                const { blobUrl, fileName } = await generarPDFPresupuesto(savedPresupuesto, true)
                setPdfPreview({ url: blobUrl, fileName })
                setPdfFormatDialog(false)
              }}
            >
              <List className="w-6 h-6 text-primary" />
              <span className="font-semibold text-sm">Solo totales</span>
              <span className="text-xs text-muted-foreground text-center">Lista sin precios, total al final</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
          <h3 className="font-semibold text-base flex items-center gap-2">
            {servicioAEditar ? (
              servicioAEditar.isPresupuesto ? (
                <>
                  <FileText className="w-5 h-5 text-warning" />
                  Editar Presupuesto
                </>
              ) : (
                <>
                  <Wrench className="w-5 h-5 text-primary" />
                  Editar Servicio
                </>
              )
            ) : (
              <>
                <Wrench className="w-5 h-5 text-primary" />
                Nuevo Servicio / Presupuesto
              </>
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={showEditPiezasModal} onOpenChange={setShowEditPiezasModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                  <Paintbrush className="w-3.5 h-3.5 mr-1" />
                  Pintura
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Configurar Piezas de Pintura</DialogTitle>
                  <DialogDescription>
                    Edita la cantidad de piezas para cada elemento. El precio se calcula automáticamente.
                  </DialogDescription>
                </DialogHeader>
                
                {/* Botón para configurar precio global */}
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Precio Global por Pieza</p>
                      <p className="text-xs text-muted-foreground">Configure el precio base multiplicado por cantidad</p>
                    </div>
                    <Button
                      onClick={() => {
                        setShowPreciosModal(true)
                        setShowEditPiezasModal(false)
                      }}
                      className="h-8 text-xs"
                    >
                      Configurar
                    </Button>
                  </div>
                </div>

                {/* Lista de piezas */}
                <div className="grid grid-cols-1 gap-3 mt-4">
                  {piezasSeleccionadas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No hay piezas de pintura configuradas</p>
                      <p className="text-xs mt-2">Ve a Configuración para agregar piezas</p>
                    </div>
                  ) : (
                    piezasSeleccionadas.map((pieza) => {
                      const isSelected = pieza.seleccionada
                      return (
                        <div
                          key={pieza.nombre}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? "bg-primary/10 border-primary/30"
                              : "bg-secondary/10 border-border hover:bg-secondary/20"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              id={`edit-pieza-${pieza.nombre}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setPiezasSeleccionadas((prev) =>
                                  prev.map((p) =>
                                    p.nombre === pieza.nombre ? { ...p, seleccionada: checked as boolean } : p,
                                  ),
                                )
                              }}
                            />
                            <Label
                              htmlFor={`edit-pieza-${pieza.nombre}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {pieza.nombre}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Cantidad:</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={pieza.cantidad_piezas || 1}
                              onChange={(e) => {
                                setPiezasSeleccionadas((prev) =>
                                  prev.map((p) =>
                                    p.nombre === pieza.nombre
                                      ? { ...p, cantidad_piezas: Number(e.target.value) || 1 }
                                      : p,
                                  ),
                                )
                              }}
                              className="w-20 h-8 text-right text-sm"
                              disabled={!isSelected}
                            />
                          </div>
                          <span className="text-sm font-medium text-success ml-3 tabular-nums min-w-fit">
                            ${(pieza.precio * (pieza.cantidad_piezas || 1)).toLocaleString("es-CL")}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg mt-4">
                  <span className="font-semibold">Total Pintura</span>
                  <span className="text-lg font-bold text-success tabular-nums">
                    ${totalPiezasPintura.toLocaleString("es-CL")}
                  </span>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button onClick={() => setShowEditPiezasModal(false)}>Cerrar</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showPreciosModal} onOpenChange={setShowPreciosModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                  <Paintbrush className="w-3.5 h-3.5 mr-1" />
                  Precios Pintura
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle>Configurar Precio Global de Pintura</DialogTitle>
                  <DialogDescription>
                    Define el precio por pieza. Este valor se multiplicará por la cantidad de piezas de cada elemento.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 mt-6">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Precio por Pieza</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium">$</span>
                      <Input
                        type="number"
                        step="1000"
                        value={preciosTemp[0]?.precio || ""}
                        onChange={(e) => {
                          setPreciosTemp((prev) => [
                            {
                              ...prev[0],
                              precio: Number(e.target.value) || 0,
                            },
                          ])
                        }}
                        placeholder="90000"
                        className="flex-1 text-lg text-right"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Ejemplo: Si estableces $90.000 y el Capot tiene 2 piezas, el total será $180.000
                    </p>
                  </div>

                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Piezas Configuradas:</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {piezasSeleccionadas.map((pieza) => (
                        <div key={pieza.nombre} className="flex justify-between text-sm">
                          <span>{pieza.nombre}:</span>
                          <span className="font-medium">{pieza.cantidad_piezas || 1} piezas</span>
                        </div>
                      ))}
                      {piezasSeleccionadas.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Sin piezas configuradas</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setShowPreciosModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={savePreciosPintura}>Guardar Precio</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showManoObraModal} onOpenChange={setShowManoObraModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                  <Settings className="w-3.5 h-3.5 mr-1" />
                  Mano Obra
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Configurar Mano de Obra de Pintura</DialogTitle>
                  <DialogDescription>
                    Define el valor por defecto de mano de obra. Se agregará automáticamente a costos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Label>Valor por defecto:</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={manoObraConfig || ""}
                        onChange={(e) => setManoObraConfig(Number(e.target.value) || 0)}
                        className="w-32"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowManoObraModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={saveManoObraConfig}>Guardar</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showMaterialesModal} onOpenChange={setShowMaterialesModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                  <Settings className="w-3.5 h-3.5 mr-1" />
                  Materiales
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Configurar Costo de Materiales de Pintura</DialogTitle>
                  <DialogDescription>
                    Define el valor por defecto de materiales. Se agregará automáticamente a costos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Label>Valor por defecto:</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={materialesConfig || ""}
                        onChange={(e) => setMaterialesConfig(Number(e.target.value) || 0)}
                        className="w-32"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowMaterialesModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={saveMaterialesConfig}>Guardar</Button>
                </div>
              </DialogContent>
            </Dialog>

            {servicioAEditar && (
              <Button variant="ghost" size="icon" onClick={resetForm} className="h-8 w-8 hover:bg-secondary">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Grid de 2 columnas para datos básicos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna 1: Datos del Cliente y Vehículo */}
            <div className="space-y-4">
              {/* Vehicle Info */}
              <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/20">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" />
                  Vehículo
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 relative">
                    <Label className={`text-xs ${fieldErrors.patente ? "text-destructive" : ""}`}>Patente *</Label>
                    <div className="relative">
                      <Input
                        ref={patenteRef}
                        value={formData.patente}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase()
                          setFormData({ ...formData, patente: val })
                          if (fieldErrors.patente) setFieldErrors((prev) => ({ ...prev, patente: false }))
                          buscarPatente(val)
                        }}
                        onBlur={async () => {
                          setTimeout(() => setMostrarSugerencias(false), 150)
                          const patenteLimpia = formData.patente.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
                          if (patenteLimpia.length >= 6 && !formData.marca) {
                            setLookingUpPatente(true)
                            try {
                              const data = await lookupPatente(patenteLimpia)
                              if (data) {
                                setFormData((prev) => ({
                                  ...prev,
                                  marca: data.marca || prev.marca,
                                  modelo: data.modelo || prev.modelo,
                                  color: data.color || prev.color,
                                  año: data.año ? Number(data.año) : prev.año,
                                  vin: data.vin || prev.vin,
                                }))
                                const desc = [`${data.marca ?? ""} ${data.modelo ?? ""}`.trim(), data.mes_revision_tecnica ? `Rev. técnica: ${data.mes_revision_tecnica}` : ""].filter(Boolean).join(" · ")
                                toast({ title: "Vehículo encontrado", description: desc })
                              }
                            } catch {
                              // falla silenciosa — el usuario puede ingresar los datos manualmente
                            } finally {
                              setLookingUpPatente(false)
                            }
                          }
                        }}
                        onFocus={() => patenteSugerencias.length > 0 && setMostrarSugerencias(true)}
                        placeholder="ABCD12"
                        autoComplete="off"
                        className={`uppercase bg-background/50 h-9 pr-8 ${fieldErrors.patente ? "border-destructive ring-1 ring-destructive" : ""}`}
                      />
                      {lookingUpPatente && (
                        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {fieldErrors.patente && <p className="text-xs text-destructive">Requerido</p>}
                    {mostrarSugerencias && patenteSugerencias.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                        {patenteSugerencias.map((s) => (
                          <button
                            key={s.patente}
                            type="button"
                            onClick={() => seleccionarSugerencia(s)}
                            className="w-full text-left px-3 py-2.5 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm uppercase">{s.patente}</span>
                              <span className="text-xs text-muted-foreground">{s.marca} {s.modelo}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{s.cliente} · {s.telefono}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Marca</Label>
                    <Input
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      placeholder="Toyota"
                      className="bg-background/50 h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Modelo</Label>
                    <Input
                      value={formData.modelo}
                      onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                      placeholder="Corolla"
                      className="bg-background/50 h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kilometraje</Label>
                    <Input
                      type="number"
                      value={formData.kilometraje || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, kilometraje: e.target.value ? Number(e.target.value) : undefined })
                      }
                      placeholder="50000"
                      className="bg-background/50 h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Año</Label>
                    <Input
                      type="number"
                      value={formData.año || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, año: e.target.value ? Number(e.target.value) : undefined })
                      }
                      placeholder="2020"
                      className="bg-background/50 h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="Blanco"
                      className="bg-background/50 h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">VIN / Chasis</Label>
                    <Input
                      value={formData.vin}
                      onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                      placeholder="Auto-completado"
                      className="uppercase bg-background/50 h-9"
                      disabled={lookingUpPatente}
                    />
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/20">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Cliente
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className={`text-xs ${fieldErrors.cliente ? "text-destructive" : ""}`}>Nombre *</Label>
                    <Input
                      ref={clienteRef}
                      value={formData.cliente}
                      onChange={(e) => {
                        setFormData({ ...formData, cliente: e.target.value })
                        if (fieldErrors.cliente) setFieldErrors((prev) => ({ ...prev, cliente: false }))
                      }}
                      placeholder="Juan Pérez"
                      className={`bg-background/50 h-9 ${fieldErrors.cliente ? "border-destructive ring-1 ring-destructive" : ""}`}
                    />
                    {fieldErrors.cliente && <p className="text-xs text-destructive">Requerido</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+56 9 1234 5678"
                      className="bg-background/50 h-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Columna 2: Estado y Observaciones */}
            <div className="space-y-4">
              <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/20">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  Detalles del Servicio
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha Ingreso</Label>
                    <Input
                      type="date"
                      value={formData.fecha_ingreso}
                      onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                      className="bg-background/50 h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Select value={formData.estado} onValueChange={(v) => {
                      if (v === "Cerrado/Pagado" && formData.estado !== "Cerrado/Pagado") {
                        setFormData({ ...formData, estado: v, anticipo: montoConIva })
                      } else {
                        setFormData({ ...formData, estado: v })
                      }
                    }}>
                      <SelectTrigger className="bg-background/50 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {ESTADOS.map((estado) => (
                          <SelectItem key={estado} value={estado}>
                            {estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observaciones</Label>
                  <Textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Notas adicionales..."
                    className="bg-background/30 min-h-[80px] resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sección de Cobros y Costos Unificada */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/30">
                <TabsTrigger value="cobros">Detalles de Trabajo</TabsTrigger>
                <TabsTrigger value="fotos" className="flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  Fotos
                  {(fotosIngreso.length + fotosEntrega.length) > 0 && (
                    <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                      {fotosIngreso.length + fotosEntrega.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Tab: Fotos */}
              <TabsContent value="fotos" className="space-y-6 pt-2">
                {/* Fotos de Ingreso */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-medium">Fotos de Ingreso</h4>
                      <span className="text-xs text-muted-foreground">({fotosIngreso.length}/5)</span>
                    </div>
                    {fotosIngreso.length < 5 && (
                      <label className={`cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/50 text-primary hover:bg-primary/10 transition-colors ${uploadingFoto ? "opacity-50 pointer-events-none" : ""}`}>
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingFoto ? "Subiendo..." : "Agregar foto"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadFoto(file, "ingreso")
                            e.target.value = ""
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {fotosIngreso.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs border border-dashed border-border rounded-lg bg-secondary/20">
                      Sin fotos de ingreso. Máximo 5.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {fotosIngreso.map((foto) => (
                        <div key={foto.publicId} className="relative group rounded-lg overflow-hidden border border-border aspect-square">
                          <img src={foto.url} alt="Foto ingreso" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleDeleteFoto(foto.publicId, "ingreso")}
                            className="absolute top-1 right-1 w-6 h-6 bg-destructive/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fotos de Entrega */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-success" />
                      <h4 className="text-sm font-medium">Fotos de Entrega</h4>
                      <span className="text-xs text-muted-foreground">({fotosEntrega.length}/2)</span>
                    </div>
                    {fotosEntrega.length < 2 && (
                      <label className={`cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-success/50 text-success hover:bg-success/10 transition-colors ${uploadingFoto ? "opacity-50 pointer-events-none" : ""}`}>
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingFoto ? "Subiendo..." : "Agregar foto"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadFoto(file, "entrega")
                            e.target.value = ""
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {fotosEntrega.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs border border-dashed border-border rounded-lg bg-secondary/20">
                      Sin fotos de entrega. Máximo 2.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {fotosEntrega.map((foto) => (
                        <div key={foto.publicId} className="relative group rounded-lg overflow-hidden border border-border aspect-square">
                          <img src={foto.url} alt="Foto entrega" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleDeleteFoto(foto.publicId, "entrega")}
                            className="absolute top-1 right-1 w-6 h-6 bg-destructive/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Detalles de Trabajo (Cobros + Costos unificados) */}
              <TabsContent value="cobros" className="space-y-4">
                {/* Barra de plantillas */}
                <div className="flex items-center gap-2">
                  <Popover open={plantillasOpen} onOpenChange={setPlantillasOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-transparent h-8">
                        <BookMarked className="w-3.5 h-3.5" />
                        Cargar plantilla
                        {plantillas.length > 0 && (
                          <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{plantillas.length}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2 bg-card border-border" align="start">
                      {plantillas.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">Sin plantillas guardadas</p>
                      ) : (
                        <div className="space-y-1">
                          {plantillas.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-1 hover:bg-secondary/50 rounded px-2 py-1.5 group">
                              <button
                                type="button"
                                className="flex-1 text-left text-sm truncate"
                                onClick={() => cargarPlantilla(p)}
                              >
                                {p.nombre}
                              </button>
                              <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                                onClick={() => handleEliminarPlantilla(p.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs bg-transparent h-8"
                    onClick={() => { setNombreNuevaPlantilla(""); setGuardarPlantillaOpen(true) }}
                  >
                    <BookTemplate className="w-3.5 h-3.5" />
                    Guardar como plantilla
                  </Button>
                </div>

                <Tabs value={activeCobroTab} onValueChange={setActiveCobroTab}>
                  <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 bg-secondary/20 h-auto">
                    <TabsTrigger value="desmontar" className="text-xs py-2">Desmontar</TabsTrigger>
                    <TabsTrigger value="desabolladura" className="text-xs py-2">Desabolladura</TabsTrigger>
                    <TabsTrigger value="reparar" className="text-xs py-2">Reparar</TabsTrigger>
                    <TabsTrigger value="pintura" className="text-xs py-2">Pintura</TabsTrigger>
                    <TabsTrigger value="mecanica" className="text-xs py-2">Mecánica</TabsTrigger>
                    <TabsTrigger value="repuestos" className="text-xs py-2">Repuestos</TabsTrigger>
                    <TabsTrigger value="otros" className="text-xs py-2">Otros</TabsTrigger>
                  </TabsList>

                  {/* Tab Pintura - Con Piezas de Pintura */}
                  <TabsContent value="pintura" className="space-y-4">
                    <div className="space-y-3">
                      {/* Search Combobox */}
                      <div className="space-y-2 p-3 rounded-lg border border-border bg-background/30">
                        <Label className="text-xs font-medium flex items-center gap-1">
                          <Paintbrush className="w-3 h-3" />
                          Buscar y Agregar Piezas
                        </Label>
                        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={searchOpen}
                              className="w-full justify-between bg-transparent"
                            >
                              {searchValue
                                ? piezasSeleccionadas.find((p) => p.nombre === searchValue)?.nombre
                                : "Seleccionar pieza de pintura..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar pieza..." />
                              <CommandList>
                                <CommandEmpty>No se encontraron piezas.</CommandEmpty>
                                <CommandGroup>
                                  {piezasSeleccionadas
                                    .filter((pieza) => !pieza.seleccionada)
                                    .map((pieza) => (
                                      <CommandItem
                                        key={pieza.nombre}
                                        value={pieza.nombre}
                                        onSelect={() => {
                                          setPiezasSeleccionadas((prev) =>
                                            prev.map((p) =>
                                              p.nombre === pieza.nombre ? { ...p, seleccionada: true } : p
                                            )
                                          )
                                          setSearchOpen(false)
                                          setSearchValue("")
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            searchValue === pieza.nombre ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        <span className="flex-1">{pieza.nombre}</span>
                                        <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                                          ${(pieza.precio * (pieza.cantidad_piezas || 1)).toLocaleString("es-CL")}
                                        </span>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Selected Pieces List */}
                      <div className="space-y-2 p-3 rounded-lg border border-border bg-background/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <Paintbrush className="w-3 h-3" />
                            Piezas Seleccionadas
                          </Label>
                          <span className="text-sm font-semibold text-success tabular-nums">
                            ${totalPiezasPintura.toLocaleString("es-CL")}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                          {piezasSeleccionadas.filter((p) => p.seleccionada).length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              No hay piezas seleccionadas
                            </p>
                          ) : (
                            piezasSeleccionadas
                              .filter((p) => p.seleccionada)
                              .map((pieza) => (
                                <div
                                  key={pieza.nombre}
                                  className="flex items-center justify-between p-2 bg-secondary/20 hover:bg-secondary/40 rounded transition-colors"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
                                      onClick={() => {
                                        setPiezasSeleccionadas((prev) =>
                                          prev.map((p) =>
                                            p.nombre === pieza.nombre ? { ...p, seleccionada: false } : p
                                          )
                                        )
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs truncate flex-1">{pieza.nombre}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{pieza.nombre}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <span className="text-xs font-medium text-success ml-2 tabular-nums">
                                    ${(pieza.precio * (pieza.cantidad_piezas || 1)).toLocaleString("es-CL")}
                                  </span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tabla unificada de Cobros y Costos para Pintura */}
                    <div className="overflow-x-auto border border-border rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary/40 border-b border-border">
                            <th className="text-left p-3 font-semibold">Descripción</th>
                            <th className="text-right p-3 font-semibold">Cobrado Cliente</th>
                            <th className="text-right p-3 font-semibold">Costo Taller</th>
                            <th className="text-right p-3 font-semibold">Utilidad</th>
                            <th className="text-center p-3 font-semibold w-12">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {safeArr(cobros.pintura).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center p-4 text-muted-foreground text-xs">
                                Sin items adicionales. Usa el botón + para agregar.
                              </td>
                            </tr>
                          ) : (
                            safeArr(cobros.pintura).map((itemCobro, index) => {
                              const itemCosto = safeArr(costos.pintura)[index]
                              const cobro = Number(itemCobro.monto) || 0
                              const costo = itemCosto ? Number(itemCosto.monto) || 0 : 0
                              const utilidad = cobro - costo
                              return (
                                <tr key={itemCobro.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                                  <td className="p-3">
                                    <Input
                                      value={itemCobro.descripcion}
                                      onChange={(e) => updateItemCobro("pintura", itemCobro.id, "descripcion", e.target.value)}
                                      placeholder="Descripción..."
                                      className="bg-background/50 text-xs h-8 border-0"
                                    />
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-muted-foreground text-xs">$</span>
                                      <Input
                                        type="number"
                                        value={itemCobro.monto || ""}
                                        onChange={(e) => updateItemCobro("pintura", itemCobro.id, "monto", Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className="bg-background/50 text-xs h-8 border-0 text-right w-32"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-muted-foreground text-xs">$</span>
                                      <Input
                                        type="number"
                                        value={itemCosto?.monto || ""}
                                        onChange={(e) => upsertItemCostoByIndex("pintura", index, "monto", Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className="bg-background/50 text-xs h-8 border-0 text-right w-32"
                                      />
                                    </div>
                                  </td>
                                  <td className={`p-3 text-right font-semibold ${utilidad >= 0 ? "text-success" : "text-destructive"}`}>
                                    ${utilidad.toLocaleString("es-CL")}
                                  </td>
                                  <td className="p-3 text-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeItemCobro("pintura", itemCobro.id)}
                                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Botón para agregar item */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addItemCobro("pintura")}
                      className="w-full h-8 text-xs border-dashed bg-transparent"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar Item Adicional
                    </Button>

                    {/* Totales */}
                    {(() => {
                      const cobrosPintura = safeArr(cobros.pintura).reduce((sum, item) => sum + (Number(item.monto) || 0), 0)
                      // Costos manuales (excluir auto-gestionados para evitar doble conteo)
                      const costosManual = costos.pintura
                        .filter((item) => !isAutoItem(item.descripcion))
                        .reduce((sum, item) => sum + (Number(item.monto) || 0), 0)
                      const costosPintura = costosManual + autoCostoManoObra + autoCostoMateriales
                      const totalCobradoPintura = totalPiezasPintura + cobrosPintura
                      const utilidadPintura = totalCobradoPintura - costosPintura
                      return (
                        <div className="space-y-2">
                          {/* Detalle de costos auto-calculados */}
                          {(autoCostoManoObra > 0 || autoCostoMateriales > 0) && (
                            <div className="text-xs text-muted-foreground px-3 space-y-0.5">
                              {autoCostoManoObra > 0 && (
                                <div className="flex justify-between">
                                  <span>Mano de Obra ({cantidadPiezasAuto} piezas × ${manoObraConfig.toLocaleString("es-CL")})</span>
                                  <span className="text-warning">${autoCostoManoObra.toLocaleString("es-CL")}</span>
                                </div>
                              )}
                              {autoCostoMateriales > 0 && (
                                <div className="flex justify-between">
                                  <span>Materiales ({cantidadPiezasAuto} piezas × ${materialesConfig.toLocaleString("es-CL")})</span>
                                  <span className="text-warning">${autoCostoMateriales.toLocaleString("es-CL")}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-secondary/20 border border-border">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Cobrado</p>
                              <p className="text-lg font-bold text-success">
                                ${totalCobradoPintura.toLocaleString("es-CL")}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total Costo</p>
                              <p className="text-lg font-bold text-warning">
                                ${costosPintura.toLocaleString("es-CL")}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Utilidad</p>
                              <p className={`text-lg font-bold ${utilidadPintura >= 0 ? "text-info" : "text-destructive"}`}>
                                ${utilidadPintura.toLocaleString("es-CL")}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </TabsContent>

                  {/* Tabs para otras categorías - Con Textarea para descripción */}
                  {["desmontar", "desabolladura", "reparar", "mecanica", "repuestos", "otros"].map((categoria) => (
                    <TabsContent key={categoria} value={categoria} className="space-y-3">
                      {/* Tabla unificada de Cobros y Costos */}
                      <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-secondary/40 border-b border-border">
                              <th className="text-left p-3 font-semibold">Descripción</th>
                              <th className="text-right p-3 font-semibold">Cobrado Cliente</th>
                              <th className="text-right p-3 font-semibold">Costo Taller</th>
                              <th className="text-right p-3 font-semibold">Utilidad</th>
                              <th className="text-center p-3 font-semibold w-12">Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {safeArr(cobros[categoria as keyof ItemsPorCategoria]).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center p-4 text-muted-foreground text-xs">
                                  Sin items. Usa el botón + para agregar.
                                </td>
                              </tr>
                            ) : (
                              safeArr(cobros[categoria as keyof ItemsPorCategoria]).map((itemCobro, index) => {
                                const itemCosto = safeArr(costos[categoria as keyof ItemsPorCategoria])[index]
                                const cobro = Number(itemCobro.monto) || 0
                                const costo = itemCosto ? Number(itemCosto.monto) || 0 : 0
                                const utilidad = cobro - costo
                                return (
                                  <tr key={itemCobro.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                                    <td className="p-3 min-w-[300px]">
                                      <Textarea
                                        value={itemCobro.descripcion}
                                        onChange={(e) => updateItemCobro(categoria as keyof ItemsPorCategoria, itemCobro.id, "descripcion", e.target.value)}
                                        placeholder="Descripción..."
                                        className="bg-background/50 text-xs border-0 resize-none min-h-[60px]"
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-muted-foreground text-xs">$</span>
                                        <Input
                                          type="number"
                                          value={itemCobro.monto || ""}
                                          onChange={(e) => updateItemCobro(categoria as keyof ItemsPorCategoria, itemCobro.id, "monto", Number(e.target.value) || 0)}
                                          placeholder="0"
                                          className="bg-background/50 text-xs h-8 border-0 text-right w-32"
                                        />
                                      </div>
                                    </td>
                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-muted-foreground text-xs">$</span>
                                        <Input
                                          type="number"
                                          value={itemCosto?.monto || ""}
                                          onChange={(e) => upsertItemCostoByIndex(categoria as keyof ItemsPorCategoria, index, "monto", Number(e.target.value) || 0)}
                                          placeholder="0"
                                          className="bg-background/50 text-xs h-8 border-0 text-right w-32"
                                        />
                                      </div>
                                    </td>
                                    <td className={`p-3 text-right font-semibold ${utilidad >= 0 ? "text-success" : "text-destructive"}`}>
                                      ${utilidad.toLocaleString("es-CL")}
                                    </td>
                                    <td className="p-3 text-center">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeItemCobro(categoria as keyof ItemsPorCategoria, itemCobro.id)}
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Botón para agregar item */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addItemCobro(categoria as keyof ItemsPorCategoria)}
                        className="w-full h-8 text-xs border-dashed bg-transparent"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar Item
                      </Button>

                      {/* Totales por categoría */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-secondary/20 border border-border">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Cobrado</p>
                          <p className="text-lg font-bold text-success">
                            ${Object.values(cobros[categoria as keyof ItemsPorCategoria]).reduce((sum, item) => sum + (Number(item.monto) || 0), 0).toLocaleString("es-CL")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Costo</p>
                          <p className="text-lg font-bold text-warning">
                            ${safeArr(costos[categoria as keyof ItemsPorCategoria]).reduce((sum, item) => sum + (Number(item.monto) || 0), 0).toLocaleString("es-CL")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Utilidad</p>
                          <p className={`text-lg font-bold ${(safeArr(cobros[categoria as keyof ItemsPorCategoria]).reduce((sum, item) => sum + (Number(item.monto) || 0), 0) - safeArr(costos[categoria as keyof ItemsPorCategoria]).reduce((sum, item) => sum + (Number(item.monto) || 0), 0)) >= 0 ? "text-info" : "text-destructive"}`}>
                            ${(safeArr(cobros[categoria as keyof ItemsPorCategoria]).reduce((sum, item) => sum + (Number(item.monto) || 0), 0) - safeArr(costos[categoria as keyof ItemsPorCategoria]).reduce((sum, item) => sum + (Number(item.monto) || 0), 0)).toLocaleString("es-CL")}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </TabsContent>
            </Tabs>
          </div>

          {/* Resumen y Totales */}
          <div className="p-4 rounded-lg border border-border bg-gradient-to-r from-primary/5 to-info/5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IVA</Label>
                <Select value={formData.iva} onValueChange={(v) => setFormData({ ...formData, iva: v })}>
                  <SelectTrigger className="bg-background/50 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sin">Sin IVA</SelectItem>
                    <SelectItem value="con">Con IVA (19%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Anticipo / Abono</Label>
                <Input
                  type="number"
                  value={formData.anticipo || ""}
                  onChange={(e) => setFormData({ ...formData, anticipo: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="bg-background/50 h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Saldo Pendiente</Label>
                <div className={`text-lg font-bold ${montoConIva - (formData.anticipo || 0) <= 0 ? "text-success" : "text-warning"}`}>
                  ${Math.max(0, montoConIva - (formData.anticipo || 0)).toLocaleString("es-CL")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Total a Cobrar</Label>
                <div className="text-xl font-bold text-success">${montoConIva.toLocaleString("es-CL")}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Utilidad Estimada</Label>
                <div className={`text-xl font-bold ${utilidad >= 0 ? "text-info" : "text-destructive"}`}>
                  ${utilidad.toLocaleString("es-CL")}
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handlePresupuesto}
              variant="outline"
              disabled={loading}
              className="flex-1 h-11 border-warning text-warning hover:bg-warning/10 bg-transparent"
            >
              <FileText className="w-4 h-4 mr-2" />
              {servicioAEditar?.isPresupuesto ? "Actualizar Presupuesto" : "Crear Presupuesto"}
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-11 bg-primary hover:bg-primary/90">
              <Save className="w-4 h-4 mr-2" />
              {servicioAEditar && !servicioAEditar.isPresupuesto ? "Actualizar Servicio" : "Guardar Servicio"}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog: Guardar como plantilla */}
      <Dialog open={guardarPlantillaOpen} onOpenChange={setGuardarPlantillaOpen}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookTemplate className="w-4 h-4" />
              Guardar como plantilla
            </DialogTitle>
            <DialogDescription>
              Los cobros y costos actuales se guardarán como plantilla reutilizable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre de la plantilla *</Label>
              <Input
                value={nombreNuevaPlantilla}
                onChange={(e) => setNombreNuevaPlantilla(e.target.value)}
                placeholder="Ej: Choque frontal estándar"
                className="bg-secondary/50 border-border"
                onKeyDown={(e) => e.key === "Enter" && handleGuardarPlantilla()}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setGuardarPlantillaOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleGuardarPlantilla} disabled={savingPlantilla || !nombreNuevaPlantilla.trim()}>
                {savingPlantilla ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  )
}
