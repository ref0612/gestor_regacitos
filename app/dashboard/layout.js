'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/dashboard',         label: 'Resumen',      icon: '📊', roles: ['Admin','Tesorero','Apoderado'] },
  { href: '/dashboard/ninos',   label: 'Niños',        icon: '👧', roles: ['Admin','Tesorero','Apoderado'] },
  { href: '/dashboard/gastos',  label: 'Finanzas',     icon: '🧾', roles: ['Admin','Tesorero'] },
  { href: '/dashboard/admin',   label: 'Usuarios',     icon: '👥', roles: ['Admin'] },
  { href: '/dashboard/admin/configuracion', label: 'Configuración', icon: '⚙️', roles: ['Admin'] },
]

function RolBadge({ rol }) {
  const cls = {
    Admin:    'bg-amber-100 text-amber-800',
    Tesorero: 'bg-blue-100 text-blue-800',
    Apoderado:'bg-emerald-100 text-emerald-800',
  }[rol] || 'bg-gray-100 text-gray-600'
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{rol}</span>
}

export default function DashboardLayout({ children }) {
  const [perfil, setPerfil] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItems = NAV.filter(item => !perfil || item.roles.includes(perfil.rol))

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <span className="text-2xl">🌱</span>
        <div>
          <p className="font-bold text-white text-base leading-none">Jardín Regacito - Medio Menor "B"</p>
          <p className="text-brand-300 text-xs mt-0.5">Gestión 2026</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
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
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-brand-300 hover:text-white text-xs transition-colors">
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
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

      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-xl">☰</button>
          <span className="font-bold text-brand-900">Regacitos</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-5 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
