'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function ConfiguracionPage() {
  const [config, setConfig]       = useState({ valor_cuota_total: 4000, monto_dejando_huellas: 1000, anio_actual: new Date().getFullYear() })
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]     = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [nuevaCat, setNuevaCat]   = useState('')
  const [msgConfig, setMsgConfig] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: cfg }  = await supabase.from('configuracion').select('*').single()
    const { data: cats } = await supabase.from('categorias_gastos').select('*').order('nombre')
    if (cfg) setConfig(cfg)
    setCategorias(cats || [])
    setLoading(false)
  }

  async function guardarConfig(e) {
    e.preventDefault()
    if (Number(config.monto_dejando_huellas) >= Number(config.valor_cuota_total)) {
      alert('El monto Huellas no puede ser mayor o igual a la cuota total.')
      return
    }
    setGuardando(true)
    const { error } = await supabase.from('configuracion').upsert({
      id:                     1,
      valor_cuota_total:      Number(config.valor_cuota_total),
      monto_dejando_huellas:  Number(config.monto_dejando_huellas),
      anio_actual:            Number(config.anio_actual),
    })
    setGuardando(false)
    if (error) { alert('Error: ' + error.message); return }
    setMsgConfig('✅ Configuración guardada')
    setTimeout(() => setMsgConfig(''), 3000)
  }

  async function agregarCategoria(e) {
    e.preventDefault()
    if (!nuevaCat.trim()) return
    const { error } = await supabase.from('categorias_gastos').insert([{ nombre: nuevaCat.trim() }])
    if (error) { alert('Error: ' + error.message); return }
    setNuevaCat('')
    fetchAll()
  }

  async function eliminarCategoria(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return
    await supabase.from('categorias_gastos').delete().eq('id', id)
    fetchAll()
  }

  const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const montoGeneral = Number(config.valor_cuota_total) - Number(config.monto_dejando_huellas)

  if (loading) return <div className="flex justify-center items-center h-64 text-4xl animate-spin">🌱</div>

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Ajustes globales del sistema</p>
      </div>

      <div className="space-y-6">
        {/* Montos */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-1">Distribución de la cuota mensual</h2>
          <p className="text-gray-400 text-xs mb-5">Al marcar una cuota como pagada, el sistema la divide automáticamente entre la caja general y el Fondo Dejando Huellas.</p>
          <form onSubmit={guardarConfig} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Valor total cuota ($)</label>
                <input type="number" min="1000" required className="input"
                  value={config.valor_cuota_total}
                  onChange={e => setConfig(c => ({ ...c, valor_cuota_total: e.target.value }))} />
              </div>
              <div>
                <label className="label">Monto al Fondo Huellas ($)</label>
                <input type="number" min="0" required className="input"
                  value={config.monto_dejando_huellas}
                  onChange={e => setConfig(c => ({ ...c, monto_dejando_huellas: e.target.value }))} />
              </div>
              <div>
                <label className="label">Año en curso</label>
                <input type="number" min="2024" required className="input"
                  value={config.anio_actual}
                  onChange={e => setConfig(c => ({ ...c, anio_actual: e.target.value }))} />
              </div>
            </div>

            {/* Preview split */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Distribución por cuota pagada</p>
              <div className="flex items-center gap-2 mb-2 h-4">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(montoGeneral / config.valor_cuota_total) * 100}%`, minWidth: 2 }} />
                <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${(config.monto_dejando_huellas / config.valor_cuota_total) * 100}%`, minWidth: 2 }} />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>💰 Caja General: <strong className="text-brand-700">{fmt(montoGeneral)}</strong></span>
                <span>🌟 Fondo Huellas: <strong className="text-blue-700">{fmt(config.monto_dejando_huellas)}</strong></span>
              </div>
            </div>

            {msgConfig && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">{msgConfig}</div>}
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </form>
        </div>

        {/* Categorías */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-1">Categorías de gastos</h2>
          <p className="text-gray-400 text-xs mb-5">Etiquetas para clasificar los egresos del jardín.</p>
          <form onSubmit={agregarCategoria} className="flex gap-3 mb-5">
            <input type="text" required className="input" placeholder="Nueva categoría (ej: Emergencias)"
              value={nuevaCat} onChange={e => setNuevaCat(e.target.value)} />
            <button type="submit" className="btn-primary flex-shrink-0">+ Agregar</button>
          </form>
          {categorias.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No hay categorías. Crea la primera.</p>
          ) : (
            <div className="space-y-2">
              {categorias.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-gray-800">{cat.nombre}</span>
                      {cat.descripcion && <p className="text-xs text-gray-400">{cat.descripcion}</p>}
                    </div>
                  </div>
                  <button onClick={() => eliminarCategoria(cat.id, cat.nombre)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-sm px-2">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
