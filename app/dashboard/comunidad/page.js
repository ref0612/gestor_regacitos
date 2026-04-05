'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import es from 'date-fns/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'

// Configuración al español para el calendario
const locales = { 'es': es }
const localizer = dateFnsLocalizer({
  format, parse, getDay, locales,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }) // Semana inicia en lunes
})

const mensajesEspañol = {
  allDay: 'Todo el día', previous: 'Anterior', next: 'Siguiente', today: 'Hoy',
  month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda', date: 'Fecha',
  time: 'Hora', event: 'Evento', noEventsInRange: 'No hay eventos en este rango.',
  showMore: total => `+ Ver más (${total})`
}

export default function ComunidadPage() {
  const [perfil, setPerfil] = useState(null)
  const [anuncios, setAnuncios] = useState([])
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  const [mostrarFormAnuncio, setMostrarFormAnuncio] = useState(false)
  const [nuevoAnuncio, setNuevoAnuncio] = useState({ titulo: '', contenido: '' })

  // --- ESTADOS PARA EL MODAL DEL CALENDARIO ---
  const [eventoModal, setEventoModal] = useState(null) // null = cerrado, object = abierto
  const [guardandoEvento, setGuardandoEvento] = useState(false)

  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
      setPerfil(p)
    }

    const { data: dataAnuncios } = await supabase.from('comunidad_anuncios').select('*').order('fecha_publicacion', { ascending: false })
    const { data: dataEventos } = await supabase.from('comunidad_eventos').select('*')
    
    const eventosFormateados = (dataEventos || []).map(ev => ({
      id: ev.id,
      title: ev.titulo,
      descripcion: ev.descripcion || '',
      start: new Date(ev.fecha_inicio),
      end: new Date(ev.fecha_fin),
      tipo: ev.tipo
    }))

    setAnuncios(dataAnuncios || [])
    setEventos(eventosFormateados)
    setLoading(false)
  }

  // --- LÓGICA DE CARTELERA ---
  async function handleCrearAnuncio(e) {
    e.preventDefault()
    if (!nuevoAnuncio.titulo || !nuevoAnuncio.contenido) return
    await supabase.from('comunidad_anuncios').insert({
      titulo: nuevoAnuncio.titulo, contenido: nuevoAnuncio.contenido, autor: perfil?.nombre_completo || 'Administración'
    })
    setNuevoAnuncio({ titulo: '', contenido: '' })
    setMostrarFormAnuncio(false)
    fetchData()
  }

  // --- LÓGICA DEL CALENDARIO (Google Calendar Style) ---
  const esAdmin = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero'

  // Al hacer clic en un cuadro de un día vacío
  const handleSelectSlot = ({ start }) => {
    if (!esAdmin) return;
    setEventoModal({
      isNew: true,
      titulo: '',
      descripcion: '',
      tipo: 'Actividad',
      fecha: format(start, 'yyyy-MM-dd')
    });
  }

  // Al hacer clic en un evento ya creado
  const handleSelectEvent = (event) => {
    setEventoModal({
      isNew: false,
      id: event.id,
      titulo: event.title, // <--- AQUÍ ESTÁ LA MAGIA: pasamos 'title' a 'titulo'
      descripcion: event.descripcion,
      tipo: event.tipo,
      fecha: format(event.start, 'yyyy-MM-dd')
    });
  }

  // Guardar o Actualizar Evento
  const handleGuardarEvento = async (e) => {
    e.preventDefault()
    setGuardandoEvento(true)
    
    // Configurar fechas para que abarquen todo el día seleccionado
    const fechaInicio = new Date(`${eventoModal.fecha}T00:00:00`).toISOString();
    const fechaFin = new Date(`${eventoModal.fecha}T23:59:59`).toISOString();

    if (eventoModal.isNew) {
      await supabase.from('comunidad_eventos').insert({
        titulo: eventoModal.titulo,
        descripcion: eventoModal.descripcion,
        tipo: eventoModal.tipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      });
    } else {
      await supabase.from('comunidad_eventos').update({
        titulo: eventoModal.titulo,
        descripcion: eventoModal.descripcion,
        tipo: eventoModal.tipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      }).eq('id', eventoModal.id);
    }
    
    setEventoModal(null)
    setGuardandoEvento(false)
    fetchData()
  }

  // Borrar evento
  const handleBorrarEvento = async () => {
    if(!confirm('¿Estás seguro de eliminar esta actividad?')) return;
    await supabase.from('comunidad_eventos').delete().eq('id', eventoModal.id);
    setEventoModal(null);
    fetchData();
  }

  // Colores dinámicos para los eventos
  const eventStyleGetter = (event) => {
    let backgroundColor = '#2D8465' // brand-500
    if (event.tipo === 'Feriado') backgroundColor = '#ef4444' // rojo
    if (event.tipo === 'Reunión') backgroundColor = '#f59e0b' // ambar
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.95,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '11px',
        fontWeight: 'bold',
        padding: '3px 6px',
        margin: '1px 3px'
      }
    }
  }

  // Add state for controlling calendar navigation
  const [fechaCalendario, setFechaCalendario] = useState(new Date());

  if (loading) return <div className="p-10 text-center animate-pulse text-brand-500 font-bold">Cargando comunidad...</div>

  return (
    <div className="max-w-7xl mx-auto pb-20">
      
      {/* ESTILOS CSS INYECTADOS PARA TRANSFORMAR EL CALENDARIO */}
      <style dangerouslySetInnerHTML={{ __html: `
        .rbc-calendar { font-family: inherit; min-height: 700px; }
        .rbc-month-view { border: 1px solid #f3f4f6; border-radius: 1.5rem; overflow: hidden; background: white; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
        .rbc-header { padding: 12px 0; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; color: #9ca3af; border-bottom: 1px solid #f3f4f6; border-left: none; }
        .rbc-day-bg { border-left: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: all 0.2s; }
        .rbc-day-bg:hover { background-color: #f8fafc; }
        .rbc-today { background-color: #f0fdf4; }
        .rbc-toolbar { margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
        .rbc-toolbar button { border-radius: 0.75rem; border: 1px solid #e5e7eb; color: #4b5563; font-weight: 600; padding: 0.5rem 1rem; transition: all 0.2s; background: white; }
        .rbc-toolbar button:hover { background-color: #f3f4f6; }
        .rbc-toolbar button.rbc-active { background-color: #f3f4f6; color: #111827; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05); }
        .rbc-toolbar-label { font-weight: 900; font-size: 1.25rem; color: #1f2937; text-transform: capitalize; }
        .rbc-date-cell { font-weight: 700; font-size: 0.85rem; padding: 8px; color: #4b5563; }
        .rbc-off-range-bg { background-color: #fafafa; }
        .rbc-off-range .rbc-date-cell { color: #d1d5db; }
        .rbc-event-content { text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
      `}} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Comunidad Regacitos</h1>
        <p className="text-gray-500 text-sm mt-1">Cartelera informativa y calendario de actividades</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* =========================================
            COLUMNA IZQUIERDA: CARTELERA (4/12)
        ========================================== */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-black text-gray-800 flex items-center gap-2">
              <span>📌</span> Cartelera
            </h2>
            {esAdmin && (
              <button 
                onClick={() => setMostrarFormAnuncio(!mostrarFormAnuncio)}
                className="bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors border border-brand-100"
              >
                + Nuevo Aviso
              </button>
            )}
          </div>

          {mostrarFormAnuncio && (
            <form onSubmit={handleCrearAnuncio} className="bg-white p-5 rounded-3xl border border-brand-200 shadow-lg shadow-brand-100 mb-6 animate-in fade-in slide-in-from-top-4">
              <input 
                type="text" placeholder="Título del aviso..." required
                value={nuevoAnuncio.titulo} onChange={e => setNuevoAnuncio({...nuevoAnuncio, titulo: e.target.value})}
                className="w-full mb-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
              <textarea 
                rows="3" placeholder="Contenido o descripción..." required
                value={nuevoAnuncio.contenido} onChange={e => setNuevoAnuncio({...nuevoAnuncio, contenido: e.target.value})}
                className="w-full mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setMostrarFormAnuncio(false)} className="flex-1 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shadow-md transition-colors">Publicar</button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {anuncios.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200">No hay avisos recientes.</p>
            ) : (
              anuncios.map(anuncio => (
                <div key={anuncio.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-black text-gray-800 text-sm mb-2">{anuncio.titulo}</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed mb-4">{anuncio.contenido}</p>
                  <div className="pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
                    <span className="flex items-center gap-1">✍️ {anuncio.autor}</span>
                    <span>{new Date(anuncio.fecha_publicacion).toLocaleDateString('es-CL')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* =========================================
            COLUMNA DERECHA: CALENDARIO (8/12)
        ========================================== */}
        <div className="lg:col-span-8">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h2 className="font-black text-gray-800 flex items-center gap-2">
                <span>📅</span> Calendario Interactivo
              </h2>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span> Actividad</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Reunión</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Feriado</span>
              </div>
            </div>

            {/* El calendario en sí */}
            <div className="font-sans">
              <Calendar
                localizer={localizer}
                events={eventos}
                startAccessor="start"
                endAccessor="end"
                culture="es"
                messages={mensajesEspañol}
                eventPropGetter={eventStyleGetter}
                views={['month']} // Limitamos a mes para mantenerlo simple como un mural
                defaultView="month"
                selectable={true}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                // Pass the date and navigation handler
                date={fechaCalendario}
                onNavigate={(nuevaFecha) => setFechaCalendario(nuevaFecha)}
              />
            </div>

          </div>
        </div>
      </div>

      {/* =========================================
          MODAL DE EVENTO (Crear / Editar / Ver)
      ========================================== */}
      {eventoModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="bg-brand-50 p-6 border-b border-brand-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-brand-800">
                {eventoModal.isNew ? 'Agendar Nueva Actividad' : 'Detalles de la Actividad'}
              </h2>
              <button onClick={() => setEventoModal(null)} className="text-gray-400 hover:text-gray-600 font-black text-xl">✕</button>
            </div>
            
            <form onSubmit={handleGuardarEvento} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Título del Evento</label>
                  <input 
                    type="text" required disabled={!esAdmin}
                    value={eventoModal.titulo} onChange={e => setEventoModal({...eventoModal, titulo: e.target.value})} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-white" 
                    placeholder="Ej: Día del Carabinero"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Fecha</label>
                  <input 
                    type="date" required disabled={!esAdmin}
                    value={eventoModal.fecha} onChange={e => setEventoModal({...eventoModal, fecha: e.target.value})} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-white" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tipo</label>
                  <select 
                    value={eventoModal.tipo} disabled={!esAdmin}
                    onChange={e => setEventoModal({...eventoModal, tipo: e.target.value})} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-white"
                  >
                    <option value="Actividad">Actividad Regular</option>
                    <option value="Reunión">Reunión Apoderados</option>
                    <option value="Feriado">Feriado / Suspensión</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Descripción / Detalles</label>
                <textarea 
                  rows="3" disabled={!esAdmin}
                  value={eventoModal.descripcion} onChange={e => setEventoModal({...eventoModal, descripcion: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none disabled:bg-white" 
                  placeholder="Detalles sobre vestimenta, materiales a llevar, etc..."
                ></textarea>
              </div>

              {/* Botones según rol */}
              <div className="pt-4 border-t border-gray-100 flex gap-3">
                {esAdmin ? (
                  <>
                    {!eventoModal.isNew && (
                      <button type="button" onClick={handleBorrarEvento} className="py-3 px-4 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors border border-red-100">
                        🗑️
                      </button>
                    )}
                    <button type="button" onClick={() => setEventoModal(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={guardandoEvento} className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-xl transition-all shadow-md">
                      {guardandoEvento ? 'Guardando...' : 'Guardar Evento'}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setEventoModal(null)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                    Cerrar
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}