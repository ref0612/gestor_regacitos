'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ── Constantes ───────────────────────────────────────────────────────────────
const ESTADOS = [
  { v: 'Excelente', e: '😄', bg: 'bg-emerald-400', light: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
  { v: 'Bien',      e: '🙂', bg: 'bg-green-400',   light: 'bg-green-50 border-green-300 text-green-700' },
  { v: 'Regular',   e: '😐', bg: 'bg-yellow-400',  light: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
  { v: 'Dificil',   e: '😢', bg: 'bg-orange-400',  light: 'bg-orange-50 border-orange-300 text-orange-700' },
  { v: 'Irritable', e: '😤', bg: 'bg-red-400',     light: 'bg-red-50 border-red-300 text-red-700' },
  { v: 'Cansado',   e: '😴', bg: 'bg-blue-400',    light: 'bg-blue-50 border-blue-300 text-blue-700' },
  { v: 'Ansioso',   e: '😰', bg: 'bg-purple-400',  light: 'bg-purple-50 border-purple-300 text-purple-700' },
]

const COMIDA_ACTITUD = [
  { v: 'Comio bien', e: '😋' },
  { v: 'Normal',     e: '😐' },
  { v: 'Sin apetito',e: '😖' },
]

const TAGS_RAPIDOS = [
  '😊 Muy activo','😴 Durmió poco','🍽 Poco apetito','😭 Lloró mucho',
  '🤝 Socializó bien','🎮 Jugó mucho','📅 Día tranquilo','🤕 Se lastimó',
  '🤒 Fiebre','😤 No quiso comer','💪 Participó bien','🏃 Corrió mucho',
  '🌧 Día difícil','😊 Muy cariñoso','🎨 Muy creativo','😮 Le costó adaptarse',
  '🤧 Mocos/resfrío','😬 Problema con pares','🌟 Día excepcional','🚀 Muy curioso',
]

const DURACION_SIESTA = [
  { label: '15 min', val: 15 }, { label: '30 min', val: 30 },
  { label: '45 min', val: 45 }, { label: '1 hora',  val: 60 },
  { label: '1h 30m', val: 90 }, { label: '2 horas', val: 120 },
]

// Función helper para obtener la fecha local correcta
const getFechaLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FORM_VACIO = {
  fecha: getFechaLocal(), // Usamos la función local aquí
  estado_animo: '',
  panales: 0, orinas: 0, deposiciones: 0,
  desayuno: '', desayuno_actitud: '',
  almuerzo: '', almuerzo_actitud: '',
  once: '',    once_actitud: '',
  siesta: false, duracion_siesta: 0, siesta_calidad: '',
  observaciones: '', medicamento: '',
}

// ── Componentes UI ─────────────────────────────────────────────────────────
function BolitasComida({ value, onChange, disabled }) {
  const opciones = ['Nada','1/2','3/4','Todo']
  const colores  = { 'Nada':'bg-red-400','1/2':'bg-yellow-400','3/4':'bg-lime-400','Todo':'bg-emerald-500' }
  return (
    <div className="flex items-center gap-2.5">
      {opciones.map((op, i) => (
        <button key={op} type="button" disabled={disabled}
          onClick={() => onChange(value === op ? '' : op)} title={op}
          className={`w-8 h-8 rounded-full border-2 transition-all duration-150 flex-shrink-0 ${
            value && opciones.indexOf(value) >= i
              ? `${colores[op]} border-transparent shadow-sm scale-110`
              : 'bg-gray-100 border-gray-200 hover:border-gray-300'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'}`} />
      ))}
      {value && <span className="text-xs font-bold text-gray-500 ml-1">{value}</span>}
    </div>
  )
}

function ActitudComida({ value, onChange, disabled }) {
  return (
    <div className="flex gap-2">
      {COMIDA_ACTITUD.map(a => (
        <button key={a.v} type="button" disabled={disabled}
          onClick={() => onChange(value === a.v ? '' : a.v)} title={a.v}
          className={`text-2xl transition-all duration-150 rounded-full w-10 h-10 flex items-center justify-center ${
            value === a.v ? 'bg-brand-100 scale-125 shadow-sm ring-2 ring-brand-300' : 'opacity-35 hover:opacity-70'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
          {a.e}
        </button>
      ))}
    </div>
  )
}

function Contador({ label, icon, value, onChange, disabled, color = 'sky' }) {
  const colors = {
    sky:   { bg: 'bg-sky-50',   text: 'text-sky-500',   num: 'text-sky-700' },
    teal:  { bg: 'bg-teal-50',  text: 'text-teal-500',  num: 'text-teal-700' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-500', num: 'text-amber-700' },
  }
  const c = colors[color] || colors.sky
  return (
    <div className={`flex flex-col items-center gap-2 p-4 ${c.bg} rounded-2xl border border-white shadow-sm`}>
      <span className="text-2xl">{icon}</span>
      <p className={`text-[10px] font-black ${c.text} uppercase tracking-wider`}>{label}</p>
      <div className="flex items-center gap-3">
        <button type="button" disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-full bg-white hover:bg-red-50 text-gray-400 hover:text-red-400 font-black text-lg transition-all shadow-sm disabled:opacity-30 disabled:cursor-default">−</button>
        <span className={`text-3xl font-black ${c.num} w-8 text-center tabular-nums`}>{value}</span>
        <button type="button" disabled={disabled}
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full bg-white hover:bg-emerald-50 text-gray-400 hover:text-emerald-400 font-black text-lg transition-all shadow-sm disabled:opacity-30 disabled:cursor-default">+</button>
      </div>
    </div>
  )
}

// ── Selector de Fecha Premium ────────────────────────────────────────────────
function CalendarioElegante({ fechaActual, onChange, onClose }) {
  const [viewDate, setViewDate] = useState(new Date(fechaActual + 'T12:00:00'));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Cálculos del mes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Lunes como primer día

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  const navMes = (dir) => setViewDate(new Date(year, month + dir, 1));
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  function seleccionarDia(dia) {
    const m = String(month + 1).padStart(2, '0');
    const d = String(dia).padStart(2, '0');
    onChange(`${year}-${m}-${d}`);
    onClose();
  }

  return (
    <>
      {/* Fondo invisible para cerrar al hacer clic afuera */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Popover del calendario */}
      <div className="absolute top-full left-0 md:left-auto right-0 mt-3 bg-white border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded-3xl p-5 w-[300px] z-50 origin-top animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header: Mes y Año */}
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => navMes(-1)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <span className="font-bold text-lg leading-none">‹</span>
          </button>
          <p className="font-black text-gray-800 text-sm">{MESES[month]} <span className="font-normal text-gray-400">{year}</span></p>
          <button type="button" onClick={() => navMes(1)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <span className="font-bold text-lg leading-none">›</span>
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-[10px] font-black text-gray-400 uppercase">{d}</div>
          ))}
        </div>

        {/* Cuadrícula de días */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = currentStr === fechaActual;
            const isToday = currentStr === hoyStr;

            return (
              <button
                key={d}
                type="button"
                onClick={() => seleccionarDia(d)}
                className={`w-full aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 ${
                  isSelected 
                    ? 'bg-brand-600 text-white shadow-md scale-105' 
                    : isToday
                      ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Modal formulario ──────────────────────────────────────────────────────────
function ModalRegistro({ idNino, registro, nombreNino, onClose, onGuardado }) {
  const esEdicion = !!registro

  const [showCalendar, setShowCalendar] = useState(false)

  const [form, setForm] = useState(esEdicion ? {
    fecha:             registro.fecha,
    estado_animo:      registro.estado_animo    || '',
    panales:           registro.panales         ?? 0,
    orinas:            registro.orinas          ?? 0,
    deposiciones:      registro.deposiciones    ?? 0,
    desayuno:          registro.desayuno        || '',
    desayuno_actitud:  registro.desayuno_actitud|| '',
    almuerzo:          registro.almuerzo        || '',
    almuerzo_actitud:  registro.almuerzo_actitud|| '',
    once:              registro.once            || '',
    once_actitud:      registro.once_actitud    || '',
    siesta:            registro.siesta          ?? false,
    duracion_siesta:   registro.duracion_siesta ?? 0,
    siesta_calidad:    registro.siesta_calidad  || '',
    observaciones:     registro.observaciones   || '',
    medicamento:       registro.medicamento     || '',
  } : { ...FORM_VACIO, fecha: getFechaLocal() }); // Actualizamos la fecha al momento exacto del clic

  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const supabase = createClient()

  const set = (campo) => (val) => setForm(f => ({ ...f, [campo]: val }))

  function toggleTag(tag) {
    const obs = form.observaciones
    if (obs.includes(tag)) {
      setForm(f => ({ ...f, observaciones: obs.replace(tag, '').replace(/\s·\s·\s/g, ' · ').replace(/^[\s·]+|[\s·]+$/g, '') }))
    } else {
      setForm(f => ({ ...f, observaciones: obs ? obs + ' · ' + tag : tag }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()

    // 1. Armamos los datos en crudo
    const payloadBruto = { ...form, id_nino: idNino, educador_id: user?.id }

    // 2. MAGIA AQUÍ: Convertimos los strings vacíos ('') a null
    // Esto evita que PostgreSQL colapse con campos opcionales o ENUMs vacíos
    const payloadLimpio = Object.fromEntries(
      Object.entries(payloadBruto).map(([key, value]) => [
        key, 
        value === '' ? null : value 
      ])
    )

    // 3. Enviamos los datos limpios a Supabase
    const { error: err } = esEdicion
      ? await supabase.from('cuaderno_diario').update(payloadLimpio).eq('id', registro.id)
      : await supabase.from('cuaderno_diario').insert([payloadLimpio])
    
    setGuardando(false)
    
    if (err) { 
      console.error("Error exacto de Supabase:", err); // Útil por si falla de nuevo
      setError(err.message); 
      return; 
    }
    
    onGuardado(); onClose()
  }

  const estadoSeleccionado = ESTADOS.find(e => e.v === form.estado_animo)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-gray-50 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b transition-colors flex-shrink-0 ${estadoSeleccionado ? estadoSeleccionado.light : 'bg-white border-gray-100'}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{esEdicion ? 'Editar registro' : 'Nuevo registro'}</p>
            <p className="font-black text-gray-900 text-lg leading-tight">{nombreNino}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center text-gray-600 hover:bg-black/20 transition-colors font-bold text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6 pb-28">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

            {/* Fecha - Estilo Premium */}
            <div className="relative z-50">
              <label className="label">📅 Fecha del Registro</label>
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full sm:w-2/3 flex items-center justify-between bg-white border-2 border-gray-100 p-3 sm:p-4 rounded-2xl hover:border-brand-300 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-brand-50 text-brand-600 p-2.5 rounded-xl group-hover:bg-brand-100 transition-colors shadow-sm">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Día seleccionado</p>
                    <p className="text-sm font-bold text-gray-700 capitalize">
                      {new Date(form.fecha + 'T12:00:00').toLocaleDateString('es-CL', { 
                        weekday: 'long', day: 'numeric', month: 'long' 
                      })}
                    </p>
                  </div>
                </div>
                <span className="text-brand-600 font-black text-sm px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">
                  Cambiar
                </span>
              </button>

              {/* Nuestro nuevo Calendario Elegante */}
              {showCalendar && (
                <CalendarioElegante 
                  fechaActual={form.fecha} 
                  onChange={(nuevaFecha) => setForm(f => ({ ...f, fecha: nuevaFecha }))}
                  onClose={() => setShowCalendar(false)} 
                />
              )}
            </div>

            {/* Estado de ánimo */}
            <div>
              <label className="label">¿Cómo estuvo hoy?</label>
              <div className="flex flex-wrap gap-2">
                {ESTADOS.map(est => (
                  <button key={est.v} type="button"
                    onClick={() => set('estado_animo')(form.estado_animo === est.v ? '' : est.v)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 text-sm font-bold transition-all duration-150 ${
                      form.estado_animo === est.v ? est.light + ' scale-105 shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <span className="text-xl">{est.e}</span> {est.v}
                  </button>
                ))}
              </div>
            </div>

            {/* Higiene */}
            <div>
              <label className="label">🚿 Higiene</label>
              <div className="grid grid-cols-3 gap-3">
                <Contador label="Pañales"      icon="🩲" value={form.panales}      onChange={set('panales')}      color="sky" />
                <Contador label="Orinas"       icon="💧" value={form.orinas}       onChange={set('orinas')}       color="teal" />
                <Contador label="Deposiciones" icon="💩" value={form.deposiciones} onChange={set('deposiciones')} color="amber" />
              </div>
            </div>

            {/* Alimentación — grid 3 columnas en desktop */}
            <div>
              <label className="label">🍽 Alimentación</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'desayuno', label: '🍳 Desayuno', hora: '9:00 hrs.' },
                  { key: 'almuerzo', label: '🥗 Almuerzo', hora: '11:50 hrs.' },
                  { key: 'once',     label: '🫖 Once',     hora: '15:00 hrs.' },
                ].map(({ key, label, hora }) => (
                  <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-700">{label}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{hora}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Cantidad</p>
                      <BolitasComida value={form[key]} onChange={set(key)} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Actitud</p>
                      <ActitudComida value={form[key + '_actitud']} onChange={set(key + '_actitud')} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Siesta */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between bg-indigo-50">
                <p className="text-sm font-black text-indigo-700">😴 Siesta</p>
                <button type="button" onClick={() => setForm(f => ({ ...f, siesta: !f.siesta }))}
                  className={`w-14 h-7 rounded-full transition-all duration-300 relative flex-shrink-0 ${form.siesta ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${form.siesta ? 'left-8' : 'left-1'}`} />
                </button>
              </div>
              {form.siesta && (
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Duración</p>
                    <div className="flex flex-wrap gap-2">
                      {DURACION_SIESTA.map(d => (
                        <button key={d.val} type="button"
                          onClick={() => set('duracion_siesta')(d.val)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                            form.duracion_siesta === d.val ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                          }`}>{d.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Calidad del sueño</p>
                    <div className="flex gap-3">
                      {[{ v:'Profundo', e:'😌' }, { v:'Normal', e:'😐' }, { v:'Inquieto', e:'😣' }].map(c => (
                        <button key={c.v} type="button"
                          onClick={() => set('siesta_calidad')(form.siesta_calidad === c.v ? '' : c.v)}
                          className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                            form.siesta_calidad === c.v ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'
                          }`}>
                          <span className="text-2xl">{c.e}</span>
                          <span className="text-[10px] font-bold text-gray-500">{c.v}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Medicamento */}
            <div>
              <label className="label">💊 Medicamento (opcional)</label>
              <input className="input bg-white" placeholder="Ej: Ibuprofeno 100mg — según receta médica"
                value={form.medicamento} onChange={e => setForm(f => ({ ...f, medicamento: e.target.value }))} />
            </div>

            {/* Observaciones + tags rápidos */}
            <div>
              <label className="label">📝 Observaciones del día</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {TAGS_RAPIDOS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                      form.observaciones.includes(tag) ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300'
                    }`}>{tag}</button>
                ))}
              </div>
              <textarea rows={3} className="input bg-white resize-none"
                placeholder="Notas adicionales, incidencias del día..."
                value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
            </div>
          </div>

          {/* Footer fijo */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1 py-3 font-black text-base">
              {guardando ? 'Guardando...' : '✓ ' + (esEdicion ? 'Guardar cambios' : 'Guardar día')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tarjeta de registro ───────────────────────────────────────────────────────
function RegistroCard({ reg, idApoderado, perfil, onEditar, onEliminar }) {
  const [marcando, setMarcando] = useState(false)
  const [lecturas, setLecturas] = useState(reg.cuaderno_lecturas || [])
  const supabase = createClient()

  const estado    = ESTADOS.find(e => e.v === reg.estado_animo)
  const yaLeyo    = lecturas.some(l => l.id_apoderado === idApoderado)
  const vecesLeyo = lecturas.length

  async function marcarLeido() {
    if (yaLeyo || perfil?.rol !== 'Apoderado') return
    setMarcando(true)
    const { data } = await supabase.from('cuaderno_lecturas')
      .insert([{ id_registro: reg.id, id_apoderado: idApoderado }])
      .select().single()
    if (data) setLecturas(prev => [...prev, data])
    setMarcando(false)
  }

  const puedeEditar   = perfil?.rol === 'Admin' || (perfil?.rol === 'Educador' && reg.educador_id === idApoderado)
  const puedeEliminar = perfil?.rol === 'Admin' || puedeEditar

  const fechaObj  = new Date(reg.fecha + 'T12:00:00')
  const diaNombre = fechaObj.toLocaleDateString('es-CL', { weekday: 'long' })
  const diaNum    = fechaObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' })
  const fmt = (min) => min >= 60 ? `${Math.floor(min/60)}h${min%60>0?' '+min%60+'m':''}` : `${min}m`
  const coloresComida = { 'Nada':'bg-red-400','1/2':'bg-yellow-400','3/4':'bg-lime-400','Todo':'bg-emerald-500' }
  const opciones = ['Nada','1/2','3/4','Todo']

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

      {/* Header Responsivo */}
      <div className={`flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b ${estado ? estado.light : 'border-gray-100'}`}>
        <div>
          <p className="text-[10px] sm:text-xs font-bold text-gray-500 capitalize leading-none mb-1">{diaNombre}</p>
          <p className="font-black text-gray-900 text-base sm:text-lg capitalize leading-none">{diaNum}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {estado && (
            <span className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs sm:text-sm font-bold ${estado.light}`}>
              <span className="text-base leading-none">{estado.e}</span> 
              <span>{estado.v}</span>
            </span>
          )}
          {puedeEditar   && <button onClick={() => onEditar(reg)} className="w-7 h-7 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors flex items-center justify-center text-sm">✏️</button>}
          {puedeEliminar && <button onClick={() => onEliminar(reg.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex items-center justify-center text-xs font-bold">✕</button>}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">

        {/* Higiene — Optimizada para Móviles */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 bg-sky-50 rounded-xl p-2 sm:p-3 text-center sm:text-left">
            <span className="text-xl sm:text-2xl leading-none">🩲</span>
            <div>
              <p className="text-[8px] sm:text-[10px] font-black text-sky-500 uppercase tracking-tight">Pañales</p>
              <p className="text-lg sm:text-2xl font-black text-sky-700 leading-none mt-0.5">{reg.panales ?? 0}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 bg-teal-50 rounded-xl p-2 sm:p-3 text-center sm:text-left">
            <span className="text-xl sm:text-2xl leading-none">💧</span>
            <div>
              <p className="text-[8px] sm:text-[10px] font-black text-teal-500 uppercase tracking-tight">Orinas</p>
              <p className="text-lg sm:text-2xl font-black text-teal-700 leading-none mt-0.5">{reg.orinas ?? 0}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 bg-amber-50 rounded-xl p-2 sm:p-3 text-center sm:text-left">
            <span className="text-xl sm:text-2xl leading-none">💩</span>
            <div>
              {/* En móviles dice "Depos.", en PC "Deposiciones" */}
              <p className="text-[8px] sm:text-[10px] font-black text-amber-500 uppercase tracking-tight">
                <span className="sm:hidden">Deposiciones</span>
                <span className="hidden sm:inline">Deposiciones</span>
              </p>
              <p className="text-lg sm:text-2xl font-black text-amber-700 leading-none mt-0.5">{reg.deposiciones ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Alimentación — Lista en móvil, Grilla en PC */}
        {(reg.desayuno || reg.almuerzo || reg.once) && (
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <p className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">🍽 Alimentación</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {[
                { label: '🍳 Desayuno', val: reg.desayuno, actitud: reg.desayuno_actitud },
                { label: '🥗 Almuerzo', val: reg.almuerzo, actitud: reg.almuerzo_actitud },
                { label: '🫖 Once',     val: reg.once,     actitud: reg.once_actitud },
              ].map(({ label, val, actitud }) => {
                const actitudEmoji = COMIDA_ACTITUD.find(a => a.v === actitud)
                return (
                  <div key={label} className="px-4 py-3 sm:px-3 sm:py-3 flex items-center justify-between sm:flex-col sm:justify-center">
                    <p className="text-[10px] font-bold text-gray-500 sm:text-gray-400 sm:mb-2">{label}</p>
                    
                    {val ? (
                      <div className="flex items-center sm:flex-col justify-end sm:justify-center gap-3 sm:gap-1">
                        <div className="flex gap-1">
                          {opciones.map((op, i) => (
                            <div key={op} className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ${opciones.indexOf(val) >= i ? coloresComida[val] : 'bg-gray-200'}`} />
                          ))}
                        </div>
                        {/* El texto (1/2, 3/4) se oculta en móvil para dejar solo los colores y el emoji */}
                        <p className="text-[10px] font-bold text-gray-500 hidden sm:block">{val}</p>
                        {actitudEmoji && <span className="text-lg leading-none">{actitudEmoji.e}</span>}
                      </div>
                    ) : <p className="text-gray-300 text-xs">—</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Siesta */}
        {reg.siesta && (
          <div className="flex items-center gap-3 bg-indigo-50 rounded-xl px-4 py-3">
            <span className="text-2xl leading-none">😴</span>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-tight">Siesta</p>
              <p className="text-sm font-bold text-indigo-800">
                {reg.duracion_siesta ? fmt(reg.duracion_siesta) : 'Tomó siesta'}
                {reg.siesta_calidad && <span className="ml-2 font-normal text-indigo-600">· {reg.siesta_calidad}</span>}
              </p>
            </div>
          </div>
        )}

        {/* Medicamento */}
        {reg.medicamento && (
          <div className="flex items-start gap-3 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
            <span className="text-xl leading-none mt-0.5">💊</span>
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-tight">Medicamento</p>
              <p className="text-sm font-semibold text-amber-800">{reg.medicamento}</p>
            </div>
          </div>
        )}

        {/* Observaciones */}
        {reg.observaciones && (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight mb-1">📝 Observaciones</p>
            <p className="text-sm text-gray-700 leading-relaxed">{reg.observaciones}</p>
          </div>
        )}

        <p className="text-[9px] text-gray-400 text-right sm:text-left">
          Registrado por <strong>{reg.perfiles?.nombre_completo || 'Educador'}</strong>
        </p>
      </div>

      {/* Footer lectura */}
      <div className="px-4 sm:px-5 py-3 border-t border-gray-50 bg-gray-50 flex items-center justify-between">
        {perfil?.rol === 'Apoderado' ? (
          yaLeyo
            ? <span className="text-[10px] sm:text-xs font-bold text-emerald-600">✓ Visto · <span className="text-gray-400 font-normal">{vecesLeyo} {vecesLeyo === 1 ? 'vez' : 'veces'}</span></span>
            : <button onClick={marcarLeido} disabled={marcando}
                className="text-[10px] sm:text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors disabled:opacity-50">
                {marcando ? '...' : '👁 Marcar como leído'}
              </button>
        ) : (
          <span className="text-[10px] sm:text-xs text-gray-400">
            {vecesLeyo > 0 ? `👁 Revisado ${vecesLeyo} ${vecesLeyo === 1 ? 'vez' : 'veces'}` : '⏳ Apoderado aún no revisó'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CuadernoDiario({ idNino, nombreNino, perfil, idUsuario }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)

  // NUEVO: Navegación por fecha exacta
  const hoyStr = new Date().toISOString().split('T')[0]
  const [fechaVista, setFechaVista] = useState(hoyStr) 

  const supabase = createClient()
  const puedeRegistrar = ['Admin','Educador','Tesorero'].includes(perfil?.rol)
  const esApoderado    = perfil?.rol === 'Apoderado'

  const MESES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  useEffect(() => { fetchRegistros() }, [idNino])

  async function fetchRegistros() {
    setLoading(true)
    const { data } = await supabase
      .from('cuaderno_diario')
      .select('*, perfiles(nombre_completo), cuaderno_lecturas(id, id_apoderado, leido_at)')
      .eq('id_nino', idNino)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setRegistros(data || [])
    setLoading(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('cuaderno_diario').delete().eq('id', id)
    fetchRegistros()
  }

  // --- LÓGICA DE DÍAS ---
  function moverDias(cantidad) {
    const d = new Date(fechaVista + 'T12:00:00')
    d.setDate(d.getDate() + cantidad)
    setFechaVista(d.toISOString().split('T')[0])
  }

  // Generar la semana actual a partir de la fecha seleccionada (lunes a domingo)
  function getDiasSemana(fechaReferenciaStr) {
    const d = new Date(fechaReferenciaStr + 'T12:00:00')
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Ajustar cuando el día es domingo (0)
    const lunes = new Date(d.setDate(diff))
    
    return Array.from({length: 5}).map((_, i) => { // Solo mostramos Lunes a Viernes (5 días)
      const date = new Date(lunes)
      date.setDate(lunes.getDate() + i)
      return {
        str: date.toISOString().split('T')[0],
        nombre: date.toLocaleDateString('es-CL', { weekday: 'short' }),
        num: date.getDate()
      }
    })
  }

  const diasMostrados = getDiasSemana(fechaVista)
  const fechaObj = new Date(fechaVista + 'T12:00:00')

  // Filtrar SOLAMENTE el día seleccionado
  const registrosFiltrados = registros.filter(r => r.fecha === fechaVista)

  // Contar pendientes totales del niño (no solo del día) para alertar al apoderado
  const pendientesTotales = esApoderado
    ? registros.filter(r => !r.cuaderno_lecturas?.some(l => l.id_apoderado === idUsuario)).length
    : 0

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header General */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-900 to-brand-700">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="w-7 h-7 flex-shrink-0" fill="none">
            <rect x="10" y="6" width="40" height="52" rx="4" fill="#e53e3e"/>
            <rect x="10" y="6" width="8" height="52" rx="2" fill="#c53030"/>
            <line x1="22" y1="20" x2="46" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="22" y1="28" x2="46" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="22" y1="36" x2="38" y2="36" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <div>
            <p className="font-black text-white text-sm uppercase tracking-wide">Cuaderno de comunicaciones</p>
            {pendientesTotales > 0 && (
              <p className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded-md inline-block mt-1 uppercase tracking-widest">
                {pendientesTotales} sin leer en total
              </p>
            )}
          </div>
        </div>
        {puedeRegistrar && (
          <button onClick={() => setModal('nuevo')}
            className="bg-white text-brand-800 font-black text-xs px-4 py-2 rounded-xl hover:bg-brand-50 transition-colors shadow-sm">
            + Registrar día
          </button>
        )}
      </div>

      {/* NUEVO: Navegador Horizontal por Semana */}
      <div className="bg-gray-50 border-b border-gray-100 p-4">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => moverDias(-7)} className="text-gray-400 hover:text-brand-600 font-bold p-1 transition-colors">« Sem. anterior</button>
          <span className="font-black text-gray-800 capitalize">{MESES_NOMBRES[fechaObj.getMonth()]} {fechaObj.getFullYear()}</span>
          <button onClick={() => moverDias(7)} disabled={fechaObj > new Date()} className="text-gray-400 hover:text-brand-600 font-bold p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Sem. siguiente »</button>
        </div>

        <div className="flex justify-between items-center gap-2">
          {diasMostrados.map((dia) => {
            const isSelected = dia.str === fechaVista;
            const hasRecord = registros.some(r => r.fecha === dia.str);
            const isToday = dia.str === hoyStr;

            return (
              <button 
                key={dia.str} 
                onClick={() => setFechaVista(dia.str)}
                className={`flex-1 flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-200 border-2 ${
                  isSelected 
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md scale-105' 
                    : isToday
                      ? 'bg-brand-50 text-brand-800 border-brand-200'
                      : 'bg-white text-gray-500 border-transparent hover:border-gray-200'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider mb-1">{dia.nombre}</span>
                <span className="text-xl font-black leading-none">{dia.num}</span>
                {/* Puntito indicador si hay un registro guardado ese día */}
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${hasRecord ? (isSelected ? 'bg-white' : 'bg-brand-500') : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Modales */}
      {modal !== null && (
        <ModalRegistro idNino={idNino} nombreNino={nombreNino} registro={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} onGuardado={fetchRegistros} />
      )}

      {/* Área de visualización */}
      <div className="p-5 space-y-4">
        {loading && <div className="text-center py-12 text-3xl animate-spin">🌱</div>}

        {/* Día sin registros */}
        {!loading && registrosFiltrados.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl mb-2">😊</div>
            <p className="font-black text-gray-500 text-lg">Nada registrado este día</p>
            <p className="text-xs text-gray-400 capitalize">
              {fechaObj.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            
            {/* Mostrar botón rápido para ir al último día registrado si este está vacío */}
            {registros.length > 0 && (
               <button onClick={() => setFechaVista(registros[0].fecha)} className="mt-4 px-4 py-2 bg-brand-50 text-brand-700 text-xs font-bold rounded-xl hover:bg-brand-100 transition-colors inline-block">
                 Ir al último registro: {new Date(registros[0].fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
               </button>
            )}
          </div>
        )}

        {/* Día con registros */}
        {!loading && registrosFiltrados.map(reg => (
          <RegistroCard key={reg.id} reg={reg} idApoderado={idUsuario} perfil={perfil} onEditar={r => setModal(r)} onEliminar={eliminar} />
        ))}
      </div>
    </div>
  )
}