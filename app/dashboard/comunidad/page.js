'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function ComunidadPage() {
  const [noticias, setNoticias] = useState([])
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const supabase = createClient()

  useEffect(() => { fetchDatos() }, [])

  async function fetchDatos() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
    setPerfil(p)

    const { data: n } = await supabase.from('cartelera').select('*').order('fecha_publicacion', { ascending: false })
    const { data: e } = await supabase.from('actividades').select('*').order('fecha_inicio', { ascending: true })
    
    setNoticias(n || [])
    setEventos(e || [])
    setLoading(false)
  }

  const esAdmin = perfil?.rol === 'Admin'

  if (loading) return <div className="p-10 text-center animate-pulse">Cargando comunidad...</div>

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* SECCIÓN 1: CARTELERA INFORMATIVA */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📢</span> Cartelera de Avisos
          </h2>
          {esAdmin && <button className="bg-accent-500 text-white px-4 py-2 rounded-xl text-xs font-bold">+ Nuevo Aviso</button>}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {noticias.map(noticia => (
            <div key={noticia.id} className="bg-white p-6 rounded-2xl border border-luna-100 shadow-sm relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${noticia.prioridad === 'Urgente' ? 'bg-red-500' : 'bg-brand-500'}`} />
              <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(noticia.fecha_publicacion).toLocaleDateString()}</span>
              <h3 className="font-bold text-gray-800 text-lg mt-1">{noticia.titulo}</h3>
              <p className="text-gray-600 text-sm mt-2">{noticia.contenido}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN 2: CALENDARIO / PRÓXIMAS ACTIVIDADES */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>📅</span> Calendario Escolar
        </h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {eventos.map(evento => (
              <div key={evento.id} className="flex items-center p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center justify-center bg-brand-50 rounded-xl w-14 h-14 border border-brand-100 mr-4">
                  <span className="text-[10px] font-bold text-brand-600 uppercase">{new Date(evento.fecha_inicio).toLocaleString('es', { month: 'short' })}</span>
                  <span className="text-xl font-black text-brand-700">{new Date(evento.fecha_inicio).getDate()}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">{evento.titulo}</h4>
                  <p className="text-xs text-gray-500">{evento.descripcion}</p>
                </div>
                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-full font-bold text-gray-400 uppercase">
                  {evento.tipo}
                </span>
              </div>
            ))}
            {eventos.length === 0 && <p className="p-8 text-center text-gray-400">No hay actividades programadas.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}