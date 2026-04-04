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
    <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-brand-500 rounded-full blur-[120px] opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-accent-500 rounded-full blur-[120px] opacity-20"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-4 rounded-3xl shadow-xl mb-4 transform hover:rotate-3 transition-transform">
            <img 
              src="/logo_regacitos.png" 
              alt="Logo Regacitos" 
              className="w-24 h-24 object-contain"
            />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Jardín Infantil Regacito</h1>
          <p className="text-brand-200 font-medium">Medio Menor "B"</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[2.5rem] shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Iniciar sesión</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm">{error}</div>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-brand-200 uppercase tracking-widest mb-2 ml-1">Correo</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
                placeholder="nombre@jardin.cl"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-brand-200 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-accent-500 hover:bg-accent-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-accent-900/20 transform active:scale-95 transition-all mt-4"
            >
              ENTRAR
            </button>
          </form>
        </div>

        <p className="text-center text-brand-300/50 text-[10px] mt-8 uppercase font-bold tracking-[0.2em]">
          Jardín Infantil Regacitos • 2026
        </p>
      </div>
    </div>
  )
}
