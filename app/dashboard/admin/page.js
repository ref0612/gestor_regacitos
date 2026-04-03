'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ROLES = ['Admin', 'Tesorero', 'Apoderado']

function RolBadge({ rol }) {
  const cls = { Admin: 'badge-amber', Tesorero: 'badge-blue', Apoderado: 'badge-green' }[rol] || 'badge-gray'
  return <span className={`badge ${cls}`}>{rol}</span>
}

export default function AdminPage() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', nombre_completo: '', rut: '', rol: 'Tesorero' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchUsuarios() }, [])

  async function fetchUsuarios() {
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('*').order('nombre_completo')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function crearUsuario(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setExito('')
    try {
      // Crear en Supabase Auth
      const { data, error: authErr } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` }
      })
      if (authErr) throw authErr
      if (!data.user) throw new Error('No se pudo crear el usuario')

      // Crear perfil
      const { error: perfilErr } = await supabase.from('perfiles').insert([{
        id:              data.user.id,
        nombre_completo: form.nombre_completo,
        rut:             form.rut,
        rol:             form.rol,
      }])
      if (perfilErr) throw perfilErr

      setExito(`✅ Usuario ${form.email} creado correctamente`)
      setForm({ email: '', password: '', nombre_completo: '', rut: '', rol: 'Tesorero' })
      fetchUsuarios()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarRol(userId, nuevoRol) {
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', userId)
    if (error) { alert('Error: ' + error.message); return }
    fetchUsuarios()
  }

  async function eliminarUsuario(userId, nombre) {
    if (!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return
    await supabase.from('perfiles').delete().eq('id', userId)
    fetchUsuarios()
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <p className="text-gray-500 text-sm mt-1">Administra los accesos al sistema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario nuevo usuario */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Crear usuario</h2>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
            {exito && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">{exito}</div>}

            <form onSubmit={crearUsuario} className="space-y-4">
              <div>
                <label className="label">Nombre completo</label>
                <input required className="input" placeholder="María González"
                  value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))} />
              </div>
              <div>
                <label className="label">RUT</label>
                <input className="input" placeholder="12.345.678-9"
                  value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input required type="email" className="input" placeholder="maria@jardin.cl"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Contraseña inicial</label>
                <input required type="password" minLength={6} className="input" placeholder="Mínimo 6 caracteres"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="label">Rol</label>
                <select className="input" value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {form.rol === 'Admin' && 'Acceso total al sistema'}
                  {form.rol === 'Tesorero' && 'Puede registrar pagos y gastos'}
                  {form.rol === 'Apoderado' && 'Solo ve la ficha de su hijo'}
                </p>
              </div>
              <button type="submit" disabled={guardando} className="btn-primary w-full">
                {guardando ? 'Creando...' : 'Crear usuario'}
              </button>
            </form>
          </div>

          {/* Resumen de roles */}
          <div className="card mt-4">
            <h3 className="font-bold text-gray-800 mb-3">Permisos por rol</h3>
            <div className="space-y-3 text-xs text-gray-600">
              <div>
                <div className="flex items-center gap-2 mb-1"><RolBadge rol="Admin" /> <span className="font-semibold">Admin</span></div>
                <p className="text-gray-500">Control total. Crea usuarios, configura montos y categorías.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1"><RolBadge rol="Tesorero" /> <span className="font-semibold">Tesorero</span></div>
                <p className="text-gray-500">Registra pagos, cuotas y gastos. Ve el Dashboard financiero.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1"><RolBadge rol="Apoderado" /> <span className="font-semibold">Apoderado</span></div>
                <p className="text-gray-500">Solo ve la ficha de su hijo y el estado del Fondo Huellas.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista usuarios */}
        <div className="lg:col-span-2">
          <div className="card p-0">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Usuarios registrados ({usuarios.length})</h3>
            </div>
            {loading ? (
              <div className="text-center py-12 text-2xl animate-spin">🌱</div>
            ) : usuarios.length === 0 ? (
              <p className="text-center py-12 text-gray-400">No hay usuarios</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {usuarios.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                        {(u.nombre_completo || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{u.nombre_completo}</p>
                        <p className="text-xs text-gray-400 truncate">{u.rut}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <select value={u.rol}
                        onChange={e => cambiarRol(u.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500">
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={() => eliminarUsuario(u.id, u.nombre_completo)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-sm">✕</button>
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
