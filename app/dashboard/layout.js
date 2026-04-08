'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/dashboard',                     label: 'Resumen',        icon: '📊', roles: ['Admin','Tesorero','Secretario','Apoderado'] },
  { href: '/dashboard/ninos',               label: 'Niñas y Niños',  icon: '👧', roles: ['Admin','Tesorero','Secretario','Educador','Apoderado'] },
  { href: '/dashboard/gastos',              label: 'Finanzas',       icon: '🧾', roles: ['Admin','Tesorero'] },
  { href: '/dashboard/resumen',             label: 'Reporte Mensual',icon: '📋', roles: ['Admin','Tesorero','Secretario'] },
  { href: '/dashboard/comunidad',           label: 'Comunidad',      icon: '📢', roles: ['Admin','Tesorero','Secretario','Educador','Apoderado'] },
  { href: '/dashboard/admin',               label: 'Usuarios',       icon: '👥', roles: ['Admin','Secretario'] },
  { href: '/dashboard/admin/configuracion', label: 'Configuración',  icon: '⚙️', roles: ['Admin'] },
]

function RolBadge({ rol }) {
  const cls = {
    Admin:      'bg-brand-100 text-brand-800',
    Tesorero:   'bg-blue-100 text-blue-800',
    Secretario: 'bg-violet-100 text-violet-800',
    Educador:   'bg-orange-100 text-orange-800',
    Apoderado:  'bg-emerald-100 text-emerald-800',
  }[rol] || 'bg-gray-100 text-gray-600'
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{rol}</span>
}


// ── Modal cambiar contraseña (disponible para todos los roles) ───────────────
function ModalCambiarPassword({ onClose }) {
  const [form, setForm]     = useState({ nueva: '', confirmar: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]       = useState('')
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMsg('')
    if (form.nueva.length < 6)            { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (form.nueva !== form.confirmar)    { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const supabase = createClient()
    // updateUser actúa sobre el usuario actualmente autenticado, no requiere service role
    const { error: err } = await supabase.auth.updateUser({ password: form.nueva })
    setLoading(false)
    if (err) { setError(err.message); return }
    setMsg('✅ Contraseña actualizada correctamente')
    setTimeout(onClose, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900">Cambiar contraseña</h3>
            <p className="text-xs text-gray-400 mt-0.5">Mínimo 6 caracteres</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nueva contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              className="input font-mono"
              placeholder="••••••••"
              value={form.nueva}
              onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              className="input font-mono"
              placeholder="••••••••"
              value={form.confirmar}
              onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}
          {msg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">{msg}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Buscador global ──────────────────────────────────────────────────────────
function BuscadorGlobal({ onClose }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState({ ninos: [], movimientos: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (query.trim().length < 2) { setResults({ ninos: [], movimientos: [] }); return }
    const timer = setTimeout(() => buscar(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  async function buscar(q) {
    setLoading(true)
    const [{ data: ninos }, { data: movs }] = await Promise.all([
      supabase.from('ninos').select('id, nombres, apellidos, rut')
        .or(`nombres.ilike.%${q}%,apellidos.ilike.%${q}%,rut.ilike.%${q}%`)
        .eq('activo', true).limit(6),
      supabase.from('movimientos').select('id, descripcion, monto, tipo, fecha')
        .ilike('descripcion', `%${q}%`).order('fecha', { ascending: false }).limit(4),
    ])
    setResults({ ninos: ninos || [], movimientos: movs || [] })
    setLoading(false)
  }

  const fmt     = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const isEmpty = results.ninos.length === 0 && results.movimientos.length === 0
  const hasQuery = query.trim().length >= 2

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar niños, movimientos..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
            className="flex-1 text-gray-900 text-sm placeholder-gray-400 outline-none bg-transparent"
          />
          {loading && <span className="text-sm animate-spin">⟳</span>}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm font-bold">ESC</button>
        </div>

        {/* Resultados */}
        <div className="max-h-96 overflow-y-auto">
          {!hasQuery && (
            <p className="text-center text-gray-400 text-sm py-8">Escribe al menos 2 caracteres...</p>
          )}
          {hasQuery && isEmpty && !loading && (
            <p className="text-center text-gray-400 text-sm py-8">Sin resultados para "{query}"</p>
          )}

          {results.ninos.length > 0 && (
            <div>
              <p className="px-5 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Niños</p>
              {results.ninos.map(n => (
                <button key={n.id}
                  onClick={() => { router.push(`/dashboard/ninos/${n.id}`); onClose() }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs flex-shrink-0">
                    {n.nombres?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{n.nombres} {n.apellidos}</p>
                    {n.rut && <p className="text-xs text-gray-400 font-mono">{n.rut}</p>}
                  </div>
                  <span className="ml-auto text-gray-300 text-xs">→</span>
                </button>
              ))}
            </div>
          )}

          {results.movimientos.length > 0 && (
            <div className="border-t border-gray-100">
              <p className="px-5 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Movimientos</p>
              {results.movimientos.map(m => (
                <button key={m.id}
                  onClick={() => { router.push('/dashboard/gastos'); onClose() }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                  <span className="text-lg">{m.tipo === 'Egreso' ? '📤' : '📥'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(m.fecha).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${m.tipo === 'Egreso' ? 'text-red-500' : 'text-emerald-600'}`}>
                    {fmt(m.monto)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Layout principal ─────────────────────────────────────────────────────────
export default function DashboardLayout({ children }) {
  const [perfil, setPerfil]         = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [buscadorOpen, setBuscadorOpen]         = useState(false)
  const [cambiarPasswordOpen, setCambiarPasswordOpen] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
      setPerfil(data)
    })
  }, [])

  // Atajos de teclado: Cmd+K / Ctrl+K abre el buscador
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (!['Apoderado'].includes(perfil?.rol)) setBuscadorOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [perfil])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItems = NAV.filter(item => !perfil || item.roles.includes(perfil.rol))

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <img src="/logo_regacitos.png" alt="Logo" className="w-12 h-12 object-contain" />
          <div className="min-w-0">
            <p className="font-bold text-white text-base leading-none truncate">Jardín Regacito</p>
            <p className="text-brand-100 text-[11px] mt-0.5 uppercase font-medium tracking-wider">Gestión {new Date().getFullYear()}</p>
          </div>
        </Link>
      </div>

      {/* Buscador rápido — solo roles con acceso amplio */}
      {!['Apoderado'].includes(perfil?.rol) && (
        <div className="px-3 pt-3 pb-1">
          <button onClick={() => { setBuscadorOpen(true); setSidebarOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-brand-200 text-sm transition-colors">
            <span>🔍</span>
            <span className="flex-1 text-left text-xs">Buscar...</span>
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</span>
          </button>
        </div>
      )}

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active ? 'bg-white/15 text-white' : 'text-brand-200 hover:bg-white/10 hover:text-white'
              }`}>
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 pb-5 pt-4 border-t border-white/10">
        {perfil && (
          <div className="mb-3 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{perfil.nombre_completo}</p>
            <div className="mt-1"><RolBadge rol={perfil.rol} /></div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <button onClick={() => { setCambiarPasswordOpen(true); setSidebarOpen(false) }}
            className="flex items-center gap-2 text-brand-300 hover:text-white text-xs transition-colors">
            <span>🔑</span> Cambiar contraseña
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-brand-300 hover:text-white text-xs transition-colors">
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {buscadorOpen && <BuscadorGlobal onClose={() => setBuscadorOpen(false)} />}
      {cambiarPasswordOpen && <ModalCambiarPassword onClose={() => setCambiarPasswordOpen(false)} />}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-brand-900 fixed inset-y-0 left-0 z-30 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-60 bg-brand-900 h-full shadow-xl z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 md:ml-60 flex flex-col min-h-screen w-full">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-xl">☰</button>
          <span className="font-bold text-brand-900">Regacitos</span>
          {!['Apoderado'].includes(perfil?.rol)
            ? <button onClick={() => setBuscadorOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">🔍</button>
            : <div className="w-9" />
          }
        </header>

        <main className="flex-1 p-3 sm:p-5 md:p-8 w-full max-w-full overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}