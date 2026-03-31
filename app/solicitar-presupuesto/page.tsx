"use client"

import { useState, useRef } from "react"

interface FormData {
  cliente: string
  telefono: string
  patente: string
  marca: string
  modelo: string
  año: string
  color: string
  observaciones: string
}

interface UploadedPhoto {
  url: string
  name: string
}

export default function SolicitarPresupuestoPage() {
  const [form, setForm] = useState<FormData>({
    cliente: "", telefono: "", patente: "", marca: "",
    modelo: "", año: "", color: "", observaciones: "",
  })
  const [photos, setPhotos]           = useState<UploadedPhoto[]>([])
  const [uploading, setUploading]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)
  const [errors, setErrors]           = useState<Partial<FormData>>({})
  const [uploadError, setUploadError] = useState("")
  const fileRef                       = useRef<HTMLInputElement>(null)

  const set = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [k]: e.target.value }))
      setErrors(er => ({ ...er, [k]: "" }))
    }

  const validate = () => {
    const e: Partial<FormData> = {}
    if (!form.cliente.trim())       e.cliente       = "Requerido"
    if (!form.telefono.trim())      e.telefono      = "Requerido"
    if (!form.patente.trim())       e.patente       = "Requerido"
    if (!form.marca.trim())         e.marca         = "Requerido"
    if (!form.modelo.trim())        e.modelo        = "Requerido"
    if (!form.observaciones.trim()) e.observaciones = "Requerido"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (photos.length + files.length > 5) { setUploadError("Máximo 5 archivos"); return }
    setUploadError("")
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("folder", "tallerpro/solicitudes")
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        if (!res.ok) throw new Error()
        const { url } = await res.json()
        setPhotos(p => [...p, { url, name: file.name }])
      }
    } catch {
      setUploadError("No se pudo subir la foto. Intenta de nuevo.")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const obs = photos.length > 0
        ? `${form.observaciones.trim()}\n\n📸 Fotos:\n${photos.map(p => p.url).join("\n")}`
        : form.observaciones.trim()

      const res = await fetch("/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_ingreso:        new Date().toISOString().split("T")[0],
          patente:              form.patente.trim().toUpperCase(),
          marca:                form.marca.trim(),
          modelo:               form.modelo.trim(),
          color:                form.color.trim() || null,
          año:                  form.año ? parseInt(form.año) : null,
          kilometraje:          null,
          cliente:              form.cliente.trim(),
          telefono:             form.telefono.trim(),
          observaciones:        obs,
          iva:                  "sin",
          mano_obra_pintura:    0,
          cobros:               [],
          costos:               [],
          piezas_pintura:       [],
          observaciones_checkboxes: [],
          monto_total:          0,
          monto_total_sin_iva:  0,
        }),
      })
      if (!res.ok) throw new Error()
      setSubmitted(true)
    } catch {
      alert("Error al enviar la solicitud. Por favor intenta nuevamente.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Pantalla de éxito ─────────────────────────────────────────────────
  if (submitted) {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Manrope:wght@200..800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        <div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Manrope, sans-serif" }}>
          <div style={{ background:"#09090b", border:"1px solid #18181b", padding:48, maxWidth:480, width:"100%", textAlign:"center" }}>
            <div style={{ width:72, height:72, background:"rgba(230,0,0,.1)", border:"1px solid rgba(230,0,0,.3)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px" }}>
              <span className="material-symbols-outlined" style={{ color:"#E60000", fontSize:36 }}>check_circle</span>
            </div>
            <h2 style={{ color:"#fff", fontSize:28, fontWeight:900, fontFamily:"Space Grotesk, sans-serif", textTransform:"uppercase", letterSpacing:"-0.03em", marginBottom:12 }}>
              SOLICITUD ENVIADA
            </h2>
            <p style={{ color:"#71717a", fontSize:14, lineHeight:1.7, marginBottom:32 }}>
              Tu solicitud fue recibida. Nos comunicaremos contigo al número{" "}
              <strong style={{ color:"#E60000" }}>{form.telefono}</strong> a la brevedad.
            </p>
            <button
              onClick={() => { setSubmitted(false); setForm({ cliente:"",telefono:"",patente:"",marca:"",modelo:"",año:"",color:"",observaciones:"" }); setPhotos([]) }}
              style={{ background:"linear-gradient(135deg,#E60000,#900000)", color:"#fff", border:"none", padding:"14px 32px", fontFamily:"Space Grotesk, sans-serif", fontWeight:900, fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", cursor:"pointer" }}
            >
              NUEVA SOLICITUD
            </button>
          </div>
        </div>
      </>
    )
  }

  const inputClass = "w-full bg-zinc-900 border-0 border-b border-zinc-800 text-white py-4 px-4 outline-none transition-all duration-200 placeholder-zinc-700 font-body uppercase text-sm"
  const errStyle: React.CSSProperties = { color:"#E60000", fontSize:10, marginTop:4, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Manrope:wght@200..800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      <style>{`
        body { background:#000 !important; }
        .ms { font-family:'Material Symbols Outlined'; font-size:20px; line-height:1; }
        .inp:focus { border-bottom-color:#E60000 !important; background:#111 !important; }
        .photo-slot:hover { border-color:#E60000 !important; }
        .btn-submit:hover { transform:scale(1.02); box-shadow:0 8px 40px rgba(230,0,0,0.3) !important; }
        .btn-submit:active { transform:scale(0.97); }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>

      <div style={{ background:"#000", minHeight:"100vh", fontFamily:"Manrope, sans-serif", color:"#e5e2e1" }}>

        {/* ── MAIN ── */}
        <main style={{ minHeight:"100vh" }}>
          <div style={{ maxWidth:800, margin:"0 auto", padding:"48px 32px" }}>

            {/* Hero */}
            <div style={{ marginBottom:64 }}>
              <p style={{ color:"#E60000", fontSize:11, fontWeight:700, fontFamily:"Space Grotesk, sans-serif", textTransform:"uppercase", letterSpacing:"0.3em", marginBottom:8 }}>AUTOMOTORA RS</p>
              <h1 style={{ fontSize:"clamp(52px,8vw,96px)", fontWeight:900, fontFamily:"Space Grotesk, sans-serif", textTransform:"uppercase", letterSpacing:"-0.04em", lineHeight:1, margin:0, color:"#fff" }}>
                SOLICITAR <br />
                <span style={{ color:"#E60000" }}>PRESUPUESTO</span>
              </h1>
            </div>

            <form onSubmit={handleSubmit} noValidate>
                <div style={{ display:"flex", flexDirection:"column", gap:48 }}>

                  {/* Datos de Contacto */}
                  <section style={{ background:"#09090b", border:"1px solid #18181b", padding:32, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:"#E60000" }} />
                    <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:32 }}>
                      <span className="ms" style={{ color:"#E60000", fontSize:22 }}>contact_page</span>
                      <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.02em", color:"#fff" }}>Datos de Contacto</h3>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
                      <div>
                        <label style={{ display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:"#52525b", marginBottom:8, fontFamily:"Space Grotesk, sans-serif" }}>
                          Nombre completo <span style={{ color:"#E60000" }}>*</span>
                        </label>
                        <input className="inp" style={{ ...{}, width:"100%", background:"#18181b", border:"none", borderBottom:"1px solid #27272a", color:"#fff", padding:"16px", outline:"none", fontFamily:"Manrope, sans-serif", fontSize:13, textTransform:"uppercase", boxSizing:"border-box" }} placeholder="EJ: JUAN PÉREZ" value={form.cliente} onChange={set("cliente")} />
                        {errors.cliente && <p style={errStyle}>{errors.cliente}</p>}
                      </div>
                      <div>
                        <label style={{ display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:"#52525b", marginBottom:8, fontFamily:"Space Grotesk, sans-serif" }}>
                          Teléfono <span style={{ color:"#E60000" }}>*</span>
                        </label>
                        <input className="inp" style={{ width:"100%", background:"#18181b", border:"none", borderBottom:"1px solid #27272a", color:"#fff", padding:"16px", outline:"none", fontFamily:"Manrope, sans-serif", fontSize:13, boxSizing:"border-box" }} placeholder="+56 9 1234 5678" type="tel" value={form.telefono} onChange={set("telefono")} />
                        {errors.telefono && <p style={errStyle}>{errors.telefono}</p>}
                      </div>
                    </div>
                  </section>

                  {/* Datos del Vehículo */}
                  <section style={{ background:"#09090b", border:"1px solid #18181b", padding:32, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:"#E60000" }} />
                    <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:32 }}>
                      <span className="ms" style={{ color:"#E60000", fontSize:22 }}>directions_car</span>
                      <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.02em", color:"#fff" }}>Datos del Vehículo</h3>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:32 }}>
                      {[
                        { label:"Patente", key:"patente" as keyof FormData, placeholder:"AB-CD-12", mono:true, required:true },
                        { label:"Marca",   key:"marca"   as keyof FormData, placeholder:"AUDI",    required:true },
                        { label:"Modelo",  key:"modelo"  as keyof FormData, placeholder:"A4",      required:true },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:"#52525b", marginBottom:8, fontFamily:"Space Grotesk, sans-serif" }}>
                            {f.label} {f.required && <span style={{ color:"#E60000" }}>*</span>}
                          </label>
                          <input
                            className="inp"
                            style={{ width:"100%", background:"#18181b", border:"none", borderBottom:"1px solid #27272a", color:"#fff", padding:"16px", outline:"none", fontFamily: f.mono ? "monospace" : "Manrope, sans-serif", fontSize:13, textTransform:"uppercase", boxSizing:"border-box" }}
                            placeholder={f.placeholder}
                            value={form[f.key]}
                            onChange={set(f.key)}
                          />
                          {errors[f.key] && <p style={errStyle}>{errors[f.key]}</p>}
                        </div>
                      ))}
                      <div>
                        <label style={{ display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:"#52525b", marginBottom:8, fontFamily:"Space Grotesk, sans-serif" }}>Año</label>
                        <input className="inp" style={{ width:"100%", background:"#18181b", border:"none", borderBottom:"1px solid #27272a", color:"#fff", padding:"16px", outline:"none", fontFamily:"Manrope, sans-serif", fontSize:13, boxSizing:"border-box" }} placeholder="2024" type="number" value={form.año} onChange={set("año")} />
                      </div>
                      <div style={{ gridColumn:"span 2" }}>
                        <label style={{ display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:"#52525b", marginBottom:8, fontFamily:"Space Grotesk, sans-serif" }}>Color</label>
                        <input className="inp" style={{ width:"100%", background:"#18181b", border:"none", borderBottom:"1px solid #27272a", color:"#fff", padding:"16px", outline:"none", fontFamily:"Manrope, sans-serif", fontSize:13, textTransform:"uppercase", boxSizing:"border-box" }} placeholder="GRIS NARDO" value={form.color} onChange={set("color")} />
                      </div>
                    </div>
                  </section>

                  {/* Descripción del Trabajo */}
                  <section style={{ background:"#09090b", border:"1px solid #18181b", padding:32, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:"#E60000" }} />
                    <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:32 }}>
                      <span className="ms" style={{ color:"#E60000", fontSize:22 }}>description</span>
                      <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.02em", color:"#fff" }}>Descripción del Trabajo</h3>
                    </div>
                    <textarea
                      className="inp"
                      style={{ width:"100%", background:"#18181b", border:"none", borderBottom:"1px solid #27272a", color:"#fff", padding:"16px", outline:"none", fontFamily:"Manrope, sans-serif", fontSize:13, resize:"vertical", minHeight:120, boxSizing:"border-box", textTransform:"none" }}
                      placeholder="DESCRIPCIÓN TÉCNICA DEL REQUERIMIENTO..."
                      rows={5}
                      value={form.observaciones}
                      onChange={set("observaciones")}
                    />
                    {errors.observaciones && <p style={errStyle}>{errors.observaciones}</p>}
                  </section>

                  {/* Registro Fotográfico */}
                  <section style={{ background:"#09090b", border:"1px solid #18181b", padding:32, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:"#E60000" }} />
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                        <span className="ms" style={{ color:"#E60000", fontSize:22 }}>photo_camera</span>
                        <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.02em", color:"#fff" }}>Registro Fotográfico</h3>
                      </div>
                      <span style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:"#3f3f46" }}>MÁX 5 ARCHIVOS</span>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16 }}>
                      {/* Botón añadir */}
                      <div
                        className="photo-slot"
                        onClick={() => !uploading && photos.length < 5 && fileRef.current?.click()}
                        style={{
                          aspectRatio:"1", background:"#18181b", border:"1px solid #27272a",
                          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                          gap:8, cursor: photos.length >= 5 ? "not-allowed" : "pointer", transition:"border-color .2s",
                        }}
                      >
                        {uploading ? (
                          <div style={{ width:20, height:20, border:"2px solid #E60000", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
                        ) : (
                          <>
                            <span className="ms" style={{ color:"#3f3f46", fontSize:24 }}>add_a_photo</span>
                            <span style={{ fontSize:9, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.15em" }}>Añadir</span>
                          </>
                        )}
                      </div>
                      {/* Fotos subidas */}
                      {photos.map((p, i) => (
                        <div key={i} style={{ aspectRatio:"1", position:"relative", border:"1px solid #27272a", overflow:"hidden" }}
                          onMouseEnter={e => { (e.currentTarget.querySelector(".overlay") as HTMLElement)!.style.opacity = "1" }}
                          onMouseLeave={e => { (e.currentTarget.querySelector(".overlay") as HTMLElement)!.style.opacity = "0" }}
                        >
                          <img src={p.url} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover", filter:"grayscale(100%)" }} />
                          <div className="overlay" style={{ position:"absolute", inset:0, background:"rgba(230,0,0,0.6)", opacity:0, transition:"opacity .2s", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
                            onClick={() => setPhotos(ph => ph.filter((_, idx) => idx !== i))}>
                            <span className="ms" style={{ color:"#fff", fontSize:24 }}>delete</span>
                          </div>
                        </div>
                      ))}
                      {/* Slots vacíos */}
                      {Array.from({ length: Math.max(0, 3 - photos.length) }).map((_, i) => (
                        <div key={`empty-${i}`} style={{ aspectRatio:"1", background:"#09090b", border:"1px solid #18181b" }} />
                      ))}
                    </div>
                    {uploadError && <p style={{ ...errStyle, marginTop:12 }}>{uploadError}</p>}
                  </section>

                  {/* Submit */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:32, padding:"24px 0" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, color:"#3f3f46", fontStyle:"italic", fontSize:11 }}>
                      <span className="ms" style={{ fontSize:14 }}>verified_user</span>
                      Encriptación de datos de nivel industrial (AES-256).
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || uploading}
                      className="btn-submit"
                      style={{
                        background: submitting ? "#3f3f46" : "linear-gradient(135deg,#E60000,#900000)",
                        color:"#fff", border:"none", padding:"20px 48px",
                        fontFamily:"Space Grotesk, sans-serif", fontWeight:900, fontSize:11,
                        letterSpacing:"0.2em", textTransform:"uppercase", cursor: submitting ? "not-allowed" : "pointer",
                        display:"flex", alignItems:"center", gap:8, transition:"all .3s",
                        boxShadow:"0 4px 24px rgba(230,0,0,0.2)", whiteSpace:"nowrap",
                      }}
                    >
                      {submitting ? (
                        <>
                          <div style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
                          ENVIANDO...
                        </>
                      ) : (
                        <>
                          ENVIAR SOLICITUD
                          <span className="ms" style={{ fontSize:18 }}>double_arrow</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

            </form>
          </div>
        </main>

      </div>
    </>
  )
}
