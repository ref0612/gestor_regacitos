'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ROLES = ['Admin', 'Tesorero', 'Apoderado']

const ROL_STYLE = {
  Admin:     'bg-amber-100 text-amber-800',
  Tesorero:  'bg-blue-100 text-blue-800',
  Apoderado: 'bg-emerald-100 text-emerald-800',
}

function ModalCrear({ onClose, onCreado }) {
  const [form, setForm]       = useState({ email: '', nombre_completo: '', rut: '', rol: 'Tesorero' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]     = useState('')
  const supabase = createClient()

  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      const { data, error: authErr } = await supabase.auth.signUp({
        email: form.email, password: '123456',
      })
      if (authErr) throw authErr
      if (!data.user) throw new Error('No se pudo crear el usuario')
      const { error: perfilErr } = await supabase.from('perfiles').insert([{
        id: data.user.id, nombre_completo: form.nombre_completo,
        rut: form.rut, rol: form.rol, email: form.email,
        creado_at: new Date().toISOString(),
      }])
      if (perfilErr) throw perfilErr
      onCreado()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-lg">Nuevo usuario</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input required className="input" placeholder="María González"
              value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">RUT</label>
              <input className="input" placeholder="12.345.678-9"
                value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Email (para login)</label>
            <input required type="email" className="input" placeholder="maria@jardin.cl"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span>🔑</span>
            <p className="text-sm text-amber-800">Contraseña inicial: <strong className="font-mono">123456</strong></p>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1 bg-accent-500 hover:bg-accent-600 text-white">
              {guardando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalReset({ usuario, onClose }) {
  const [nuevaPassword, setNuevaPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')

  async function handleReset(e) {
    e.preventDefault()
    if (nuevaPassword.length < 6) { setMsg('Mínimo 6 caracteres'); return }
    setLoading(true)
    const res  = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: usuario.id, nuevaPassword }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setMsg('Error: ' + data.error); return }
    setMsg('✅ Contraseña actualizada')
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Restablecer contraseña</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{usuario.nombre_completo} · <span className="text-gray-400">{usuario.email}</span></p>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="label">Nueva contraseña</label>
            <input type="text" required minLength={6} className="input font-mono"
              value={nuevaPassword} onChange={e => setNuevaPassword(e.target.value)} />
          </div>
          {msg && <p className={`text-sm p-3 rounded-xl ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [usuarios, setUsuarios]       = useState([])
  const [ninos, setNinos]             = useState([])   // para saber el representado
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filtroRol, setFiltroRol]     = useState('Todos')
  const [modalCrear, setModalCrear]   = useState(false)
  const [usuarioReset, setUsuarioReset] = useState(null)
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: u } = await supabase.from('perfiles').select('*').order('nombre_completo')
    const { data: n } = await supabase.from('ninos').select('id, nombres, apellidos, id_apoderado').eq('activo', true)
    setUsuarios(u || [])
    setNinos(n || [])
    setLoading(false)
  }

  async function cambiarRol(userId, nuevoRol) {
    await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', userId)
    fetchAll()
  }

  async function eliminar(userId, nombre) {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return
    await supabase.from('perfiles').delete().eq('id', userId)
    fetchAll()
  }

  // Mapa: apoderado_id → niño
  const ninosPorApoderado = {}
  ninos.forEach(n => { if (n.id_apoderado) ninosPorApoderado[n.id_apoderado] = n })

  const filtered = usuarios.filter(u => {
    const matchSearch = `${u.nombre_completo} ${u.email} ${u.rut}`.toLowerCase().includes(search.toLowerCase())
    const matchRol    = filtroRol === 'Todos' || u.rol === filtroRol
    return matchSearch && matchRol
  })

  const conteo = { Todos: usuarios.length, ...Object.fromEntries(ROLES.map(r => [r, usuarios.filter(u => u.rol === r).length])) }

  return (
    <div className="max-w-6xl">
      {modalCrear    && <ModalCrear onClose={() => setModalCrear(false)} onCreado={fetchAll} />}
      {usuarioReset  && <ModalReset usuario={usuarioReset} onClose={() => setUsuarioReset(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">Contraseña inicial: <code className="bg-gray-100 px-1.5 rounded font-mono text-brand-700">123456</code></p>
        </div>
        <button onClick={() => setModalCrear(true)} className="btn-primary flex items-center gap-2">
          <span>+</span> Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input className="input max-w-xs" placeholder="🔍  Buscar por nombre, email o RUT..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2">
          {['Todos', ...ROLES].map(r => (
            <button key={r} onClick={() => setFiltroRol(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                filtroRol === r ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {r} <span className="opacity-60">({conteo[r] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Usuario</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">RUT</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Rol</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Representado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr><td colSpan={5} className="text-center py-12 text-2xl animate-spin">🌱</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Sin resultados</td></tr>
            )}
            {filtered.map(u => {
              const nino = ninosPorApoderado[u.id]
              return (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  {/* Usuario */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs flex-shrink-0">
                        {(u.nombre_completo || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{u.nombre_completo}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  {/* RUT */}
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{u.rut || '—'}</td>
                  {/* Rol */}
                  <td className="px-4 py-3">
                    <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 ${ROL_STYLE[u.rol]}`}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  {/* Representado */}
                  <td className="px-4 py-3">
                    {nino ? (
                      <span className="text-xs text-gray-700 font-medium">
                        {nino.nombres} {nino.apellidos}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setUsuarioReset(u)}
                        title="Restablecer contraseña"
                        className="text-xs text-gray-400 hover:text-brand-600 transition-colors font-medium">
                        🔑
                      </button>
                      <button onClick={() => eliminar(u.id, u.nombre_completo)}
                        title="Eliminar usuario"
                        className="text-xs text-gray-300 hover:text-red-500 transition-colors">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Info roles */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { rol: 'Admin',     desc: 'Control total del sistema' },
          { rol: 'Tesorero',  desc: 'Registra pagos y gastos' },
          { rol: 'Apoderado', desc: 'Solo ve la ficha de su hijo' },
        ].map(({ rol, desc }) => (
          <div key={rol} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-100 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${ROL_STYLE[rol]}`}>{rol}</span>
            <span className="text-gray-500">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}