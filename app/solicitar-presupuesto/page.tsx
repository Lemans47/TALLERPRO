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
  publicId: string
  name: string
}

// ── Paleta Sarmiento ──────────────────────────────────────────────────
const NAVY        = "#0d2a5e"
const NAVY_DARK   = "#0a1e44"
const NAVY_CARD   = "#102a5f"
const NAVY_INPUT  = "#0f2554"
const NAVY_BORDER = "#1c3a7a"
const YELLOW      = "#f5c518"
const BLUE_BTN    = "#1A56A8"
const BLUE_BTN_HI = "#2a6fd6"
const TXT_LABEL   = "#a8bbd9"
const TXT_MUTED   = "#7a8db0"

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
  const [lookingUp, setLookingUp]     = useState(false)
  const [lookupMsg, setLookupMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const galleryRef                    = useRef<HTMLInputElement>(null)
  const cameraRef                     = useRef<HTMLInputElement>(null)
  const lastLookupRef                 = useRef<string>("")

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

  const lookupPatente = async () => {
    const clean = form.patente.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    if (clean.length < 4) return
    if (clean === lastLookupRef.current) return
    lastLookupRef.current = clean
    setLookupMsg(null)
    setLookingUp(true)
    try {
      const res = await fetch(`/api/lookup-patente?patente=${encodeURIComponent(clean)}`)
      const data = await res.json()
      if (!res.ok) {
        setLookupMsg({ type: "err", text: res.status === 404 ? "No encontramos esta patente. Completa los datos manualmente." : (data?.error || "No se pudo consultar la patente") })
        return
      }
      setForm(f => ({
        ...f,
        marca:  data.marca  ? String(data.marca).toUpperCase()  : f.marca,
        modelo: data.modelo ? String(data.modelo).toUpperCase() : f.modelo,
        año:    data.año    ? String(data.año)                  : f.año,
        color:  data.color  ? String(data.color)                : f.color,
      }))
      setErrors(er => ({ ...er, marca:"", modelo:"" }))
      setLookupMsg({ type: "ok", text: data.fromCache ? "Datos recuperados de tu historial ✓" : "Datos completados automáticamente ✓" })
    } catch {
      setLookupMsg({ type: "err", text: "No se pudo consultar la patente" })
    } finally {
      setLookingUp(false)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (photos.length + files.length > 15) { setUploadError("Máximo 15 archivos"); return }
    setUploadError("")
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("upload_preset", "tallerpro")
        fd.append("folder", "tallerpro/solicitudes")
        const res = await fetch("https://api.cloudinary.com/v1_1/dzjtujwor/image/upload", { method: "POST", body: fd })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        setPhotos(p => [...p, { url: data.secure_url, publicId: data.public_id, name: file.name }])
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
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patente:              form.patente.trim().toUpperCase(),
          marca:                form.marca.trim(),
          modelo:               form.modelo.trim(),
          color:                form.color.trim() || null,
          año:                  form.año ? parseInt(form.año) : null,
          cliente:              form.cliente.trim(),
          telefono:             form.telefono.trim(),
          observaciones:        form.observaciones.trim(),
          fotos_ingreso:        photos.map(p => ({ url: p.url, publicId: p.publicId })),
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
        <div style={{ minHeight:"100vh", background:`linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Manrope, sans-serif" }}>
          <div style={{ background:NAVY_CARD, border:`1px solid ${NAVY_BORDER}`, padding:48, maxWidth:480, width:"100%", textAlign:"center", borderRadius:8 }}>
            <div style={{ width:72, height:72, background:"rgba(245,197,24,.1)", border:"1px solid rgba(245,197,24,.4)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px" }}>
              <span className="material-symbols-outlined" style={{ color:YELLOW, fontSize:36 }}>check_circle</span>
            </div>
            <h2 style={{ color:"#fff", fontSize:28, fontWeight:900, fontFamily:"Space Grotesk, sans-serif", textTransform:"uppercase", letterSpacing:"-0.03em", marginBottom:12 }}>
              Solicitud enviada
            </h2>
            <p style={{ color:TXT_LABEL, fontSize:14, lineHeight:1.7, marginBottom:32 }}>
              Tu solicitud fue recibida. Nos comunicaremos contigo al número{" "}
              <strong style={{ color:YELLOW }}>{form.telefono}</strong> a la brevedad.
            </p>
            <button
              onClick={() => { setSubmitted(false); setForm({ cliente:"",telefono:"",patente:"",marca:"",modelo:"",año:"",color:"",observaciones:"" }); setPhotos([]) }}
              style={{ background:BLUE_BTN, color:"#fff", border:"none", padding:"14px 32px", fontFamily:"Space Grotesk, sans-serif", fontWeight:700, fontSize:12, letterSpacing:"0.15em", textTransform:"uppercase", cursor:"pointer", borderRadius:999 }}
            >
              Nueva solicitud
            </button>
          </div>
        </div>
      </>
    )
  }

  const errStyle: React.CSSProperties = { color:YELLOW, fontSize:10, marginTop:6, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }
  const labelStyle: React.CSSProperties = { display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:TXT_LABEL, marginBottom:8, fontFamily:"Space Grotesk, sans-serif" }
  const baseInputStyle: React.CSSProperties = { width:"100%", background:NAVY_INPUT, border:`1px solid ${NAVY_BORDER}`, color:"#fff", padding:"14px 16px", outline:"none", fontFamily:"Manrope, sans-serif", fontSize:14, boxSizing:"border-box", borderRadius:6 }
  const sectionStyle: React.CSSProperties = { background:NAVY_CARD, border:`1px solid ${NAVY_BORDER}`, padding:"24px 28px", position:"relative", overflow:"hidden", borderRadius:10 }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Manrope:wght@200..800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      <style>{`
        body { background:${NAVY} !important; }
        .ms { font-family:'Material Symbols Outlined'; font-size:20px; line-height:1; }
        .inp:focus { border-color:${YELLOW} !important; background:${NAVY_DARK} !important; box-shadow:0 0 0 2px rgba(245,197,24,0.15); }
        .photo-slot:hover { border-color:${YELLOW} !important; }
        .btn-submit:hover { background:${BLUE_BTN_HI} !important; transform:translateY(-1px); box-shadow:0 8px 30px rgba(26,86,168,0.4) !important; }
        .btn-submit:active { transform:translateY(0); }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>

      <div style={{ background:`linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`, minHeight:"100vh", fontFamily:"Manrope, sans-serif", color:"#e5e2e1" }}>

        {/* ── HEADER ── */}
        <header style={{ borderBottom:`1px solid ${NAVY_BORDER}`, background:"rgba(10,30,68,0.6)" }}>
          <div style={{ maxWidth:960, margin:"0 auto", padding:"16px 32px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
              <span style={{ fontFamily:"Space Grotesk, sans-serif", fontWeight:900, fontSize:34, color:"#fff", letterSpacing:"-0.02em" }}>SARMIENTO</span>
              <div style={{ height:3, background:YELLOW, marginTop:4, marginBottom:6, width:"100%" }} />
              <span style={{ fontFamily:"Space Grotesk, sans-serif", fontWeight:500, fontSize:12, color:"#a8c4ff", letterSpacing:"0.45em" }}>AUTOMOTRIZ</span>
            </div>
            <a href="https://wa.me/56991390267" target="_blank" rel="noopener noreferrer"
              style={{ color:"#fff", textDecoration:"none", fontSize:12, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", fontFamily:"Space Grotesk, sans-serif", padding:"10px 22px", background:BLUE_BTN, borderRadius:999 }}>
              Contactar
            </a>
          </div>
        </header>

        {/* ── MAIN ── */}
        <main>
          <div style={{ maxWidth:960, margin:"0 auto", padding:"40px 32px 56px" }}>

            {/* Hero */}
            <div style={{ marginBottom:32 }}>
              <h1 style={{ fontSize:"clamp(38px,5.5vw,64px)", fontWeight:900, fontFamily:"Space Grotesk, sans-serif", letterSpacing:"-0.03em", lineHeight:1.05, margin:0, color:"#fff" }}>
                Solicitar <span style={{ color:YELLOW, position:"relative" }}>presupuesto<span style={{ position:"absolute", left:0, right:0, bottom:-4, height:3, background:YELLOW }} /></span>
              </h1>
              <p style={{ color:TXT_LABEL, fontSize:15, lineHeight:1.6, marginTop:20, maxWidth:620 }}>
                Ingresa los datos de tu vehículo y describe el trabajo. Te contactaremos por WhatsApp a la brevedad con el presupuesto.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

                {/* Datos de Contacto */}
                <section style={sectionStyle}>
                  <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:YELLOW }} />
                  <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
                    <span className="ms" style={{ color:YELLOW, fontSize:22 }}>contact_page</span>
                    <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.01em", color:"#fff" }}>Datos de contacto</h3>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
                    <div>
                      <label style={labelStyle}>Nombre completo <span style={{ color:YELLOW }}>*</span></label>
                      <input className="inp" style={baseInputStyle} placeholder="Ej: Juan Pérez" value={form.cliente} onChange={set("cliente")} />
                      {errors.cliente && <p style={errStyle}>{errors.cliente}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}>Teléfono <span style={{ color:YELLOW }}>*</span></label>
                      <input className="inp" style={baseInputStyle} placeholder="+56 9 1234 5678" type="tel" value={form.telefono} onChange={set("telefono")} />
                      {errors.telefono && <p style={errStyle}>{errors.telefono}</p>}
                    </div>
                  </div>
                </section>

                {/* Datos del Vehículo */}
                <section style={sectionStyle}>
                  <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:YELLOW }} />
                  <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
                    <span className="ms" style={{ color:YELLOW, fontSize:22 }}>directions_car</span>
                    <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.01em", color:"#fff" }}>Datos del vehículo</h3>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:18 }}>
                    {/* Patente con lookup automático */}
                    <div>
                      <label style={labelStyle}>Patente <span style={{ color:YELLOW }}>*</span></label>
                      <div style={{ position:"relative" }}>
                        <input
                          className="inp"
                          style={{ ...baseInputStyle, fontFamily:"monospace", textTransform:"uppercase", paddingRight:40 }}
                          placeholder="AB-CD-12"
                          value={form.patente}
                          onChange={set("patente")}
                          onBlur={lookupPatente}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupPatente() } }}
                        />
                        {lookingUp ? (
                          <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", width:16, height:16, border:`2px solid ${YELLOW}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
                        ) : (
                          <button
                            type="button"
                            onClick={lookupPatente}
                            title="Buscar datos de la patente"
                            style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", color:YELLOW, cursor:"pointer", padding:6, display:"flex", alignItems:"center", justifyContent:"center" }}
                          >
                            <span className="ms" style={{ fontSize:20 }}>search</span>
                          </button>
                        )}
                      </div>
                      {errors.patente && <p style={errStyle}>{errors.patente}</p>}
                      {lookupMsg && !errors.patente && (
                        <p style={{ ...errStyle, color: lookupMsg.type === "ok" ? "#4ade80" : YELLOW }}>{lookupMsg.text}</p>
                      )}
                    </div>
                    {/* Marca y Modelo */}
                    {[
                      { label:"Marca",  key:"marca"  as keyof FormData, placeholder:"Audi", required:true },
                      { label:"Modelo", key:"modelo" as keyof FormData, placeholder:"A4",   required:true },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={labelStyle}>{f.label} <span style={{ color:YELLOW }}>*</span></label>
                        <input
                          className="inp"
                          style={baseInputStyle}
                          placeholder={f.placeholder}
                          value={form[f.key]}
                          onChange={set(f.key)}
                        />
                        {errors[f.key] && <p style={errStyle}>{errors[f.key]}</p>}
                      </div>
                    ))}
                    <div>
                      <label style={labelStyle}>Año</label>
                      <input className="inp" style={baseInputStyle} placeholder="2024" type="number" value={form.año} onChange={set("año")} />
                    </div>
                    <div style={{ gridColumn:"span 2" }}>
                      <label style={labelStyle}>Color</label>
                      <input className="inp" style={baseInputStyle} placeholder="Gris Nardo" value={form.color} onChange={set("color")} />
                    </div>
                  </div>
                </section>

                {/* Descripción del Trabajo */}
                <section style={sectionStyle}>
                  <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:YELLOW }} />
                  <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
                    <span className="ms" style={{ color:YELLOW, fontSize:22 }}>description</span>
                    <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.01em", color:"#fff" }}>Descripción del trabajo</h3>
                  </div>
                  <textarea
                    className="inp"
                    style={{ ...baseInputStyle, resize:"vertical", minHeight:140 }}
                    placeholder="Cuéntanos qué necesitas: pintura, desabolladura, mecánica, mantención..."
                    rows={5}
                    value={form.observaciones}
                    onChange={set("observaciones")}
                  />
                  {errors.observaciones && <p style={errStyle}>{errors.observaciones}</p>}
                </section>

                {/* Registro Fotográfico */}
                <section style={sectionStyle}>
                  <div style={{ position:"absolute", top:0, right:0, width:96, height:4, background:YELLOW }} />
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                      <span className="ms" style={{ color:YELLOW, fontSize:22 }}>photo_camera</span>
                      <h3 style={{ margin:0, fontSize:18, fontFamily:"Space Grotesk, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"-0.01em", color:"#fff" }}>Fotos del vehículo</h3>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.2em", color:TXT_MUTED }}>Máx 15 archivos</span>
                  </div>
                  <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={e => { handleFiles(e.target.files); e.target.value = "" }} />
                  <input ref={cameraRef}  type="file" accept="image/*" capture="environment" hidden onChange={e => { handleFiles(e.target.files); e.target.value = "" }} />

                  {photos.length < 15 && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => !uploading && galleryRef.current?.click()}
                        style={{
                          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                          padding:"14px 16px", background:"transparent", border:`1px solid ${YELLOW}`, color:YELLOW,
                          fontFamily:"Space Grotesk, sans-serif", fontWeight:700, fontSize:12, letterSpacing:"0.15em",
                          textTransform:"uppercase", cursor: uploading ? "not-allowed" : "pointer", borderRadius:6,
                          opacity: uploading ? 0.5 : 1,
                        }}
                      >
                        <span className="ms" style={{ fontSize:18 }}>collections</span>
                        {uploading ? "Subiendo..." : "Agregar fotos"}
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => !uploading && cameraRef.current?.click()}
                        style={{
                          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                          padding:"14px 16px", background:"transparent", border:`1px solid ${YELLOW}`, color:YELLOW,
                          fontFamily:"Space Grotesk, sans-serif", fontWeight:700, fontSize:12, letterSpacing:"0.15em",
                          textTransform:"uppercase", cursor: uploading ? "not-allowed" : "pointer", borderRadius:6,
                          opacity: uploading ? 0.5 : 1,
                        }}
                      >
                        <span className="ms" style={{ fontSize:18 }}>photo_camera</span>
                        Tomar foto
                      </button>
                    </div>
                  )}

                  {photos.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"24px", border:`1px dashed ${NAVY_BORDER}`, borderRadius:6, background:NAVY_DARK, color:TXT_MUTED, fontSize:12 }}>
                      Sin fotos aún. Puedes subir hasta 15 archivos.
                    </div>
                  ) : (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))", gap:12 }}>
                      {photos.map((p, i) => (
                        <div key={i} style={{ aspectRatio:"1", position:"relative", border:`1px solid ${NAVY_BORDER}`, overflow:"hidden", borderRadius:6 }}
                          onMouseEnter={e => { (e.currentTarget.querySelector(".overlay") as HTMLElement)!.style.opacity = "1" }}
                          onMouseLeave={e => { (e.currentTarget.querySelector(".overlay") as HTMLElement)!.style.opacity = "0" }}
                        >
                          <img src={p.url} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          <div className="overlay" style={{ position:"absolute", inset:0, background:"rgba(245,197,24,0.85)", opacity:0, transition:"opacity .2s", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
                            onClick={() => setPhotos(ph => ph.filter((_, idx) => idx !== i))}>
                            <span className="ms" style={{ color:NAVY_DARK, fontSize:26 }}>delete</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploadError && <p style={{ ...errStyle, marginTop:12 }}>{uploadError}</p>}
                </section>

                {/* Submit */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:32, padding:"16px 0", flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, color:TXT_MUTED, fontSize:12 }}>
                    <span className="ms" style={{ fontSize:16, color:YELLOW }}>verified_user</span>
                    Tus datos viajan encriptados.
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || uploading}
                    className="btn-submit"
                    style={{
                      background: submitting ? NAVY_BORDER : BLUE_BTN,
                      color:"#fff", border:"none", padding:"18px 44px",
                      fontFamily:"Space Grotesk, sans-serif", fontWeight:700, fontSize:12,
                      letterSpacing:"0.2em", textTransform:"uppercase", cursor: submitting ? "not-allowed" : "pointer",
                      display:"flex", alignItems:"center", gap:10, transition:"all .25s",
                      boxShadow:"0 4px 20px rgba(26,86,168,0.35)", whiteSpace:"nowrap", borderRadius:999,
                    }}
                  >
                    {submitting ? (
                      <>
                        <div style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar solicitud
                        <span className="ms" style={{ fontSize:18 }}>arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ── FOOTER ── */}
          <footer style={{ borderTop:`1px solid ${NAVY_BORDER}`, padding:"24px 32px", textAlign:"center" }}>
            <p style={{ color:TXT_MUTED, fontSize:12, margin:0 }}>
              © {new Date().getFullYear()} Sarmiento Automotriz — Franklin 605, Santiago, Chile
            </p>
          </footer>
        </main>
      </div>
    </>
  )
}
