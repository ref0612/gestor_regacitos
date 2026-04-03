'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 flex items-center justify-center p-4">
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <span className="text-3xl">🌱</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Regacitos</h1>
          <p className="text-brand-200 text-sm mt-1">Sistema de Gestión</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-white font-semibold text-lg mb-6">Iniciar sesión</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm">{error}</div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-brand-200 text-xs font-semibold uppercase tracking-wide mb-1.5">Correo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@jardin.cl"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-brand-200 text-xs font-semibold uppercase tracking-wide mb-1.5">Contraseña</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-brand-950 font-bold py-3 rounded-xl transition-colors duration-150 text-sm mt-2">
              {loading ? 'Ingresando...' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-brand-300/60 text-xs mt-6">Jardín Infantil Regacitos · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
