'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const FORM_VACIO = {
  tipo: 'Egreso', monto: '', descripcion: '',
  id_categoria: '', destino: 'General',
  fecha: new Date().toISOString().split('T')[0],  // fecha manual
  comprobante: null,
}

// ── Función de Compresión de Imágenes (La magia para no gastar espacio) ──────
const comprimirImagen = (file) => {
  return new Promise((resolve) => {
    // Si por alguna razón el usuario sube un archivo que no es imagen (ej: PDF), lo dejamos pasar tal cual
    if (!file.type.startsWith('image/')) {
      resolve(file)
      return
    }

    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      const canvas = document.createElement('canvas')
      
      const MAX_WIDTH = 800 // Resolución ideal para leer documentos
      let width = img.width
      let height = img.height

      // Achicamos la imagen manteniendo las proporciones
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width)
        width = MAX_WIDTH
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Exportamos a JPG comprimido al 60% de calidad
      canvas.toBlob((blob) => {
        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
          type: 'image/jpeg'
        })
        resolve(newFile)
      }, 'image/jpeg', 0.6) 
    }
  })
}

// ── Modal Crear / Editar ─────────────────────────────────────────────────────
function ModalMovimiento({ mov, categorias, onClose, onGuardado }) {
  const esEdicion = !!mov
  const [form, setForm] = useState(esEdicion ? {
    tipo:         mov.tipo         || 'Egreso',
    monto:        mov.monto        || '',
    descripcion:  mov.descripcion  || '',
    id_categoria: mov.id_categoria || '',
    destino:      mov.destino      || 'General',
    fecha:        mov.fecha ? mov.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
    comprobante:  null,
  } : FORM_VACIO)
  const [fotoPreview, setFotoPreview] = useState(mov?.comprobante_url || null)
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')
  const supabase = createClient()

  function set(campo) { return e => setForm(f => ({ ...f, [campo]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresa un monto válido'); return }
    if (!form.fecha) { setError('Selecciona una fecha'); return }
    setGuardando(true)
    setError('')
    try {
      let comprobante_url = mov?.comprobante_url || null

      if (form.comprobante) {
        // 🚨 AQUÍ COMPRIMIMOS LA IMAGEN ANTES DE SUBIRLA 🚨
        const archivoComprimido = await comprimirImagen(form.comprobante)
        
        const ext  = archivoComprimido.name.split('.').pop()
        const path = `comprimido_${Date.now()}.${ext}`
        
        const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, archivoComprimido)
        if (upErr) throw new Error('Error al subir imagen: ' + upErr.message)
        
        const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
        comprobante_url = urlData.publicUrl
      }

      const payload = {
        tipo:           form.tipo,
        monto:          Number(form.monto),
        descripcion:    form.descripcion,
        destino:        form.destino,
        fecha:          new Date(form.fecha + 'T12:00:00').toISOString(),  // mediodía para evitar desfase de zona horaria
        comprobante_url,
        id_categoria:   form.id_categoria ? Number(form.id_categoria) : null,
      }

      const { error } = esEdicion
        ? await supabase.from('movimientos').update(payload).eq('id', mov.id)
        : await supabase.from('movimientos').insert([payload])
      if (error) throw error
      onGuardado()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">
            {esEdicion ? 'Editar movimiento' : 'Nuevo movimiento'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {/* Tipo */}
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {['Egreso','Ingreso'].map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    form.tipo === t
                      ? t === 'Egreso' ? 'bg-red-600 border-red-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {t === 'Egreso' ? '📤 Egreso' : '📥 Ingreso'}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha manual */}
          <div>
            <label className="label">Fecha del movimiento</label>
            <input type="date" required className="input"
              value={form.fecha} onChange={set('fecha')} />
            <p className="text-xs text-gray-400 mt-1">
              Ingresa la fecha real del gasto para que aparezca en el mes correcto
            </p>
          </div>

          {/* Monto */}
          <div>
            <label className="label">Monto ($)</label>
            <input type="number" required min="1" className="input" placeholder="0"
              value={form.monto} onChange={set('monto')} />
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción</label>
            <input type="text" required className="input" placeholder="Ej: Compra materiales de aseo"
              value={form.descripcion} onChange={set('descripcion')} />
          </div>

          {/* Categoría */}
          <div>
            <label className="label">Categoría (opcional)</label>
            <select className="input" value={form.id_categoria} onChange={set('id_categoria')}>
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Destino */}
          <div>
            <label className="label">Destino</label>
            <div className="grid grid-cols-2 gap-2">
              {['General','Huellas'].map(d => (
                <button key={d} type="button" onClick={() => setForm(f => ({ ...f, destino: d }))}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    form.destino === d
                      ? d === 'General' ? 'bg-brand-700 border-brand-700 text-white' : 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {d === 'General' ? '💰 General' : '🌟 Huellas'}
                </button>
              ))}
            </div>
          </div>

          {/* Comprobante */}
          <div>
            <label className="label">Foto comprobante (opcional)</label>
            <input type="file" accept="image/*" className="input text-xs py-1.5"
              onChange={e => {
                const f = e.target.files[0]
                setForm(prev => ({ ...prev, comprobante: f }))
                if (f) setFotoPreview(URL.createObjectURL(f))
              }} />
            {fotoPreview && (
              <a href={fotoPreview} target="_blank" rel="noopener noreferrer">
                <img src={fotoPreview} alt="preview" className="mt-2 w-full rounded-lg object-cover max-h-32 cursor-pointer hover:opacity-80 transition-opacity" />
              </a>
            )}
            <p className="text-xs text-gray-400 mt-1 font-semibold">
              ✨ La imagen se comprimirá automáticamente para ahorrar espacio.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1">
              {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function GastosPage() {
  const [movimientos, setMovimientos] = useState([])
  const [categorias, setCategorias]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(null)  // null | 'nuevo' | objeto mov para editar
  const [filtroTipo, setFiltroTipo]   = useState('Todos')
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: movs } = await supabase
      .from('movimientos').select('*, categorias_gastos(nombre)')
      .order('fecha', { ascending: false }).limit(100)
    const { data: cats } = await supabase.from('categorias_gastos').select('*').order('nombre')
    setMovimientos(movs || [])
    setCategorias(cats || [])
    setLoading(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este movimiento?')) return
    await supabase.from('movimientos').delete().eq('id', id)
    fetchAll()
  }

  const fmt     = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

  const filtrados     = filtroTipo === 'Todos' ? movimientos : movimientos.filter(m => m.tipo === filtroTipo)
  const totalEgresos  = movimientos.filter(m => m.tipo === 'Egreso').reduce((a, m)  => a + Number(m.monto), 0)
  const totalIngresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((a, m) => a + Number(m.monto), 0)

  return (
    <div className="max-w-5xl">
      {modal !== null && (
        <ModalMovimiento
          mov={modal === 'nuevo' ? null : modal}
          categorias={categorias}
          onClose={() => setModal(null)}
          onGuardado={fetchAll}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos e Ingresos</h1>
          <p className="text-gray-500 text-sm mt-1">Registro de movimientos de caja</p>
        </div>
        <button onClick={() => setModal('nuevo')} className="btn-primary flex items-center gap-2">
          + Nuevo movimiento
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card bg-red-50 border-red-200 p-4">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1">Total egresos</p>
          <p className="text-2xl font-bold text-red-700">{fmt(totalEgresos)}</p>
        </div>
        <div className="card bg-emerald-50 border-emerald-200 p-4">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-1">Ingresos extra</p>
          <p className="text-2xl font-bold text-emerald-700">{fmt(totalIngresos)}</p>
        </div>
      </div>

      {/* Historial */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h3 className="font-bold text-gray-800">Historial</h3>
          <div className="flex gap-2">
            {['Todos','Egreso','Ingreso'].map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                  filtroTipo === t ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}>{t}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-2xl animate-spin">🌱</div>
        ) : filtrados.length === 0 ? (
          <p className="text-center py-12 text-gray-400">Sin movimientos registrados</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtrados.map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{m.tipo === 'Egreso' ? '📤' : '📥'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {m.categorias_gastos?.nombre ? `${m.categorias_gastos.nombre} · ` : ''}
                      <span className={m.destino === 'Huellas' ? 'text-blue-500' : 'text-brand-600'}>{m.destino}</span>
                      {' · '}{fmtDate(m.fecha)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  {m.comprobante_url && (
                    <a href={m.comprobante_url} target="_blank" rel="noopener noreferrer"
                      className="text-gray-400 hover:text-brand-600 transition-colors text-sm" title="Ver comprobante">🖼</a>
                  )}
                  <span className={`text-sm font-bold tabular-nums ${m.tipo === 'Egreso' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {m.tipo === 'Egreso' ? '-' : '+'}{fmt(m.monto)}
                  </span>
                  <button onClick={() => setModal(m)} title="Editar"
                    className="text-gray-300 hover:text-brand-600 transition-colors text-sm">✏️</button>
                  <button onClick={() => eliminar(m.id)} title="Eliminar"
                    className="text-gray-300 hover:text-red-500 transition-colors text-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}