'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function GastosPage() {
  const [movimientos, setMovimientos] = useState([])
  const [categorias, setCategorias]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    tipo: 'Egreso', monto: '', descripcion: '',
    id_categoria: '', destino: 'General', comprobante: null,
  })
  const [fotoPreview, setFotoPreview] = useState(null)
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: movs } = await supabase
      .from('movimientos')
      .select('*, categorias_gastos(nombre)')
      .order('fecha', { ascending: false })
      .limit(50)
    const { data: cats } = await supabase.from('categorias_gastos').select('*').order('nombre')
    setMovimientos(movs || [])
    setCategorias(cats || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.monto || Number(form.monto) <= 0) { alert('Ingresa un monto válido'); return }
    setGuardando(true)
    try {
      let comprobante_url = null
      if (form.comprobante) {
        const ext  = form.comprobante.name.split('.').pop()
        const path = `${Date.now()}.${ext}`

        const { error: upErr } = await supabase.storage
          .from('comprobantes')
          .upload(path, form.comprobante)

        if (upErr) throw new Error('Error al subir imagen: ' + upErr.message)

        const { data: urlData } = supabase.storage
          .from('comprobantes')
          .getPublicUrl(path)

        comprobante_url = urlData.publicUrl
      }
      const payload = {
        tipo:        form.tipo,
        monto:       Number(form.monto),
        descripcion: form.descripcion,
        destino:     form.destino,
        fecha:       new Date().toISOString(),
        comprobante_url,
      }
      if (form.id_categoria) payload.id_categoria = Number(form.id_categoria)
      const { error } = await supabase.from('movimientos').insert([payload])
      if (error) throw error
      setForm({ tipo: 'Egreso', monto: '', descripcion: '', id_categoria: '', destino: 'General', comprobante: null })
      setFotoPreview(null)
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este movimiento?')) return
    await supabase.from('movimientos').delete().eq('id', id)
    fetchAll()
  }

  const fmt     = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  const totalEgresos  = movimientos.filter(m => m.tipo === 'Egreso').reduce((a, m) => a + Number(m.monto), 0)
  const totalIngresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((a, m) => a + Number(m.monto), 0)

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gastos e Ingresos</h1>
        <p className="text-gray-500 text-sm mt-1">Registro de movimientos de caja</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-1">
          <div className="card sticky top-6">
            <h2 className="font-bold text-gray-800 mb-4">Nuevo movimiento</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div>
                <label className="label">Monto ($)</label>
                <input type="number" required min="1" className="input" placeholder="0"
                  value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
              </div>
              <div>
                <label className="label">Descripción</label>
                <input type="text" required className="input" placeholder="Ej: Compra materiales de aseo"
                  value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div>
                <label className="label">Categoría (opcional)</label>
                <select className="input" value={form.id_categoria} onChange={e => setForm(f => ({ ...f, id_categoria: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
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
              <div>
                <label className="label">Foto comprobante (opcional)</label>
                <input type="file" accept="image/*" className="input text-xs py-1.5"
                  onChange={e => {
                    const f = e.target.files[0]
                    setForm(prev => ({ ...prev, comprobante: f }))
                    if (f) setFotoPreview(URL.createObjectURL(f))
                  }} />
                {fotoPreview && <img src={fotoPreview} alt="preview" className="mt-2 w-full rounded-lg object-cover max-h-32" />}
              </div>
              <button type="submit" disabled={guardando} className="btn-primary w-full">
                {guardando ? 'Guardando...' : 'Registrar movimiento'}
              </button>
            </form>
          </div>
        </div>

        {/* Lista */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="card bg-red-50 border-red-200 p-4">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1">Total egresos</p>
              <p className="text-2xl font-bold text-red-700">{fmt(totalEgresos)}</p>
            </div>
            <div className="card bg-emerald-50 border-emerald-200 p-4">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-1">Ingresos extra</p>
              <p className="text-2xl font-bold text-emerald-700">{fmt(totalIngresos)}</p>
            </div>
          </div>
          <div className="card p-0">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Historial</h3>
            </div>
            {loading ? <div className="text-center py-12 text-2xl animate-spin">🌱</div>
            : movimientos.length === 0 ? <p className="text-center py-12 text-gray-400">Sin movimientos registrados</p>
            : (
              <div className="divide-y divide-gray-50">
                {movimientos.map(m => (
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
                        <a href={m.comprobante_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">🖼</a>
                      )}
                      <span className={`text-sm font-bold tabular-nums ${m.tipo === 'Egreso' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {m.tipo === 'Egreso' ? '-' : '+'}{fmt(m.monto)}
                      </span>
                      <button onClick={() => eliminar(m.id)} className="text-gray-300 hover:text-red-500 transition-colors text-sm">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
