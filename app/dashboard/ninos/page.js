'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MESES_STR   = ['3','4','5','6','7','8','9','10','11','12']
const MESES_LABEL = { '3':'Marzo','4':'Abril','5':'Mayo','6':'Junio','7':'Julio','8':'Agosto','9':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre' }
const ANIO_ACTUAL = new Date().getFullYear()

const FORM_VACIO = { nombres: '', apellidos: '', rut: '', fecha_nacimiento: '', seguro_medico: '', info_contacto: '', id_apoderado: '', genero: '' }

// ─── Modal: Crear / Editar niño ─────────────────────────────────────────────
function ModalNino({ nino, apoderados, onClose, onGuardado }) {
  const esEdicion = !!nino
  const [form, setForm]       = useState(esEdicion ? {
    nombres:          nino.nombres          || '',
    apellidos:        nino.apellidos        || '',
    rut:              nino.rut              || '',
    fecha_nacimiento: nino.fecha_nacimiento || '',
    seguro_medico:    nino.seguro_medico    || '',
    info_contacto:    nino.info_contacto    || '',
    id_apoderado:     nino.id_apoderado     || '',
    genero:            nino.genero            || '',
  } : FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const supabase = createClient()

  function set(campo) { return e => setForm(f => ({ ...f, [campo]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombres.trim() || !form.apellidos.trim()) { setError('Nombres y apellidos son obligatorios'); return }
    setGuardando(true)
    setError('')
    const payload = {
      nombres:          form.nombres.trim(),
      apellidos:        form.apellidos.trim(),
      rut:              form.rut.trim()              || null,
      fecha_nacimiento: form.fecha_nacimiento        || null,
      seguro_medico:    form.seguro_medico.trim()    || null,
      info_contacto:    form.info_contacto.trim()    || null,
      id_apoderado:     form.id_apoderado            || null,
      genero:            form.genero            || null,
      activo:           true,
    }
    const { error: err } = esEdicion
      ? await supabase.from('ninos').update(payload).eq('id', nino.id)
      : await supabase.from('ninos').insert([payload])
    setGuardando(false)
    if (err) { setError(err.message); return }
    onGuardado()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">{esEdicion ? 'Editar niño' : 'Registrar niño'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombres *</label>
              <input required className="input" placeholder="María José"
                value={form.nombres} onChange={set('nombres')} />
            </div>
            <div>
              <label className="label">Apellidos *</label>
              <input required className="input" placeholder="González Pérez"
                value={form.apellidos} onChange={set('apellidos')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">RUT</label>
              <input className="input" placeholder="12.345.678-9"
                value={form.rut} onChange={set('rut')} />
            </div>
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input type="date" className="input"
                value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} />
            </div>
          </div>

          <div>
            <label className="label">Seguro médico</label>
            <input className="input" placeholder="Ej: Fonasa A, Isapre Cruz Blanca"
              value={form.seguro_medico} onChange={set('seguro_medico')} />
          </div>

          <div>
            <label className="label">Contacto de emergencia</label>
            <input className="input" placeholder="Mamá: +56 9 1234 5678"
              value={form.info_contacto} onChange={set('info_contacto')} />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Género</label>
            <select value={form.genero || ''} onChange={set('genero')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">Seleccionar</option>
              <option value="Niña">Niña 👧</option>
              <option value="Niño">Niño 👦</option>
            </select>
          </div>

          <div>
            <label className="label">Apoderado (opcional)</label>
            <select className="input" value={form.id_apoderado} onChange={set('id_apoderado')}>
              <option value="">Sin apoderado asignado</option>
              {apoderados.map(a => (
                <option key={a.id} value={a.id}>{a.nombre_completo}{a.email ? ` · ${a.email}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1">
              {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar niño'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Importar Excel ──────────────────────────────────────────────────
function ModalImportar({ onClose, onImportado }) {
  const [step, setStep]           = useState('upload')
  const [filas, setFilas]         = useState([])
  const [errores, setErrores]     = useState([])
  const [progreso, setProgreso]   = useState(0)
  const [resultado, setResultado] = useState({ ok: 0, fail: 0 })
  const fileRef = useRef()
  const supabase = createClient()

  function descargarPlantilla() {
    const csv = 'nombres,apellidos,rut,fecha_nacimiento,seguro_medico,info_contacto\n' +
                'María José,González Pérez,12.345.678-9,2019-03-15,Fonasa A,Mamá: +56 9 1234 5678'
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = 'plantilla_ninos.csv'
    a.click()
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const XLSX = await import('xlsx')
    const wb   = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 0, defval: '' })
    const parsed = rows.map((r, i) => {
      const norm = {}
      Object.keys(r).forEach(k => { norm[k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] = r[k] })
      return {
        _fila:            i + 2,
        nombres:          norm['nombres']           || norm['nombre']   || '',
        apellidos:        norm['apellidos']         || norm['apellido'] || '',
        rut:              norm['rut']               || '',
        fecha_nacimiento: norm['fecha_nacimiento']  || norm['fecha nacimiento'] || null,
        seguro_medico:    norm['seguro_medico']     || norm['seguro medico']    || '',
        info_contacto:    norm['info_contacto']     || norm['contacto']         || '',
      }
    })
    setFilas(parsed)
    setErrores(parsed.filter(r => !r.nombres || !r.apellidos).map(r => `Fila ${r._fila}: faltan nombres o apellidos`))
    setStep('preview')
  }

  async function confirmarImportacion() {
    setStep('importing')
    const validos = filas.filter(r => r.nombres && r.apellidos)
    let ok = 0, fail = 0
    for (let i = 0; i < validos.length; i++) {
      const { _fila, ...payload } = validos[i]
      payload.activo = true
      if (!payload.fecha_nacimiento) payload.fecha_nacimiento = null
      const { error } = await supabase.from('ninos').insert([payload])
      error ? fail++ : ok++
      setProgreso(Math.round(((i + 1) / validos.length) * 100))
    }
    setResultado({ ok, fail })
    setStep('done')
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">Importar desde Excel / CSV</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                <p className="font-semibold mb-2">Columnas requeridas:</p>
                <div className="flex flex-wrap gap-2">
                  {[['nombres','req'],['apellidos','req'],['rut','opt'],['fecha_nacimiento','opt'],['seguro_medico','req'],['info_contacto','opt']].map(([c,t]) => (
                    <span key={c} className={`px-2 py-0.5 rounded font-mono text-xs ${t==='req' ? 'bg-blue-200 font-bold' : 'bg-white border border-blue-200'}`}>{c}{t==='req'?' *':''}</span>
                  ))}
                </div>
                <p className="text-xs mt-2 text-blue-600">* obligatorios</p>
              </div>
              <button onClick={descargarPlantilla} className="btn-secondary flex items-center gap-2 text-sm">
                📥 Descargar plantilla CSV
              </button>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-brand-400 transition-colors cursor-pointer"
                onClick={() => fileRef.current.click()}>
                <p className="text-4xl mb-3">📂</p>
                <p className="font-semibold text-gray-700">Haz clic para seleccionar el archivo</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-800">{filas.length} filas detectadas</p>
                <div className="flex gap-2">
                  <span className="badge badge-green">{filas.filter(r => r.nombres && r.apellidos).length} válidas</span>
                  {errores.length > 0 && <span className="badge badge-red">{errores.length} con error</span>}
                </div>
              </div>
              {errores.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                  {errores.map((e, i) => <p key={i}>⚠ {e}</p>)}
                  <p className="font-semibold mt-1">Las filas con error serán omitidas.</p>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['#','Nombres','Apellidos','RUT','Seguro','Estado'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filas.map((r, i) => {
                      const ok = r.nombres && r.apellidos
                      return (
                        <tr key={i} className={ok ? '' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-gray-400">{r._fila}</td>
                          <td className="px-3 py-2 font-medium">{r.nombres || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2">{r.apellidos || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{r.rut || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.seguro_medico || '—'}</td>
                          <td className="px-3 py-2">{ok ? <span className="badge badge-green">✓</span> : <span className="badge badge-red">✕</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setStep('upload'); setFilas([]); setErrores([]) }} className="btn-secondary flex-1">← Volver</button>
                <button onClick={confirmarImportacion}
                  disabled={!filas.some(r => r.nombres && r.apellidos)}
                  className="btn-primary flex-1">
                  Importar {filas.filter(r => r.nombres && r.apellidos).length} niños
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-10 space-y-4">
              <p className="text-4xl animate-spin inline-block">🌱</p>
              <p className="font-semibold text-gray-700">Importando... {progreso}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-brand-600 h-2 rounded-full transition-all" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <p className="text-5xl">{resultado.fail === 0 ? '🎉' : '⚠️'}</p>
              <div>
                <p className="font-bold text-gray-900 text-lg">Importación completada</p>
                <p className="text-emerald-600 text-sm mt-1">✓ {resultado.ok} niños importados</p>
                {resultado.fail > 0 && <p className="text-red-500 text-sm">✕ {resultado.fail} con error</p>}
              </div>
              <button onClick={() => { onImportado(); onClose() }} className="btn-primary">Cerrar y ver listado</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ───────────────────────────────────────────────────────
export default function NinosPage() {
  const [ninos, setNinos]         = useState([])
  const [pagos, setPagos]         = useState({})
  const [cuotasRaw, setCuotasRaw] = useState([]) // NUEVO: Para guardar la info completa del pago
  const [apoderados, setApoderados] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [perfil, setPerfil]       = useState(null)
  const [modalNino, setModalNino] = useState(null)   
  const [modalImportar, setModalImportar] = useState(false)
  const [voucherView, setVoucherView] = useState(null); 
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('rol, nombre_completo').eq('id', user.id).single()
      setPerfil(p)
    }
    const { data: n } = await supabase
      .from('ninos')
      .select('*')
      .eq('activo', true)
      .order('nombres', { ascending: true })   
      .order('apellidos', { ascending: true }); 
      
    // CORRECCIÓN: Pedimos TODOS los datos (*) para que el voucher tenga la info completa
    const { data: c } = await supabase.from('pagos_cuotas').select('*').eq('anio', ANIO_ACTUAL)
    const { data: a } = await supabase.from('perfiles').select('id, nombre_completo, email').eq('rol', 'Apoderado').order('nombre_completo')
    
    const mapa = {}
    c?.forEach(({ id_nino, mes, pagado }) => {
      if (!mapa[id_nino]) mapa[id_nino] = {}
      mapa[id_nino][String(mes)] = pagado
    })
    
    setNinos(n || [])
    setPagos(mapa)
    setCuotasRaw(c || []) // Guardamos la info completa para el Voucher
    setApoderados(a || [])
    setLoading(false)
  }

  // --- FUNCIÓN A PRUEBA DE BALAS PARA REGISTRAR/REVERTIR ---
  async function togglePago(ninoData, mesData) {
    const ninoId = typeof ninoData === 'object' ? ninoData.id : ninoData;
    const ninoObjeto = typeof ninoData === 'object' ? ninoData : ninos.find(n => n.id === ninoId);

    let mesNombre = mesData;
    if (typeof mesData === 'object' && mesData !== null) {
      mesNombre = mesData.label || mesData.mes; 
    }
    
    // Si mandan un número, se convierte al mes correcto
    if (!isNaN(mesNombre) && mesNombre !== null && mesNombre !== '') {
      const mesesArr = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      mesNombre = mesesArr[parseInt(mesNombre) - 1];
    }

    // Capitalizamos para pasar el check constraint de Supabase
    if (typeof mesNombre === 'string') {
      mesNombre = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1).toLowerCase();
    }

    if (!ninoId || !mesNombre) {
      console.error("Faltan datos:", { ninoId, mesNombre });
      return;
    }

    // maybeSingle() evita el error 406 Not Acceptable
    const { data: pagoExistente } = await supabase
      .from('pagos_cuotas')
      .select('*')
      .eq('id_nino', ninoId)
      .eq('mes', mesNombre)
      .eq('anio', ANIO_ACTUAL)
      .maybeSingle(); 

    if (pagoExistente) {
      if(!confirm(`¿Desmarcar el pago de ${mesNombre} de ${ninoObjeto?.nombres || 'este alumno'}?`)) return;
      await supabase.from('pagos_cuotas').delete().match({ id: pagoExistente.id });
      fetchAll(); // Actualiza la vista
    } else {
      const nuevoPago = {
        id_nino: ninoId,
        mes: mesNombre,
        anio: ANIO_ACTUAL,
        pagado: true,
        fecha_pago: new Date().toISOString(),
        recibido_por: perfil?.nombre_completo || 'Administración'
      };

      const { data: pagoGuardado, error } = await supabase
        .from('pagos_cuotas')
        .insert(nuevoPago)
        .select()
        .single();

      if (!error && pagoGuardado) {
        setVoucherView({ nino: ninoObjeto, pago: pagoGuardado });
        fetchAll(); // Actualiza la vista de fondo
      } else {
        console.error("Error al registrar el pago:", error);
        alert("No se pudo registrar el pago. Revisa la consola.");
      }
    }
  }

  async function eliminarNino(nino) {
    if (!confirm(`¿Eliminar a ${nino.nombres} ${nino.apellidos}?
Se eliminarán también sus registros de cuotas.`)) return
    await supabase.from('pagos_cuotas').delete().eq('id_nino', nino.id)
    await supabase.from('ninos').delete().eq('id', nino.id)
    fetchAll()
  }

  const filtered = ninos
    .filter(n => 
      `${n.nombres} ${n.apellidos} ${n.rut || ''}`.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const compareNombres = a.nombres.localeCompare(b.nombres);
      if (compareNombres !== 0) return compareNombres;
      return a.apellidos.localeCompare(b.apellidos);
    });

  const cuotasAlDia = (id) => MESES_STR.filter(m => pagos[id]?.[MESES_LABEL[m]]).length
  const puedeMarcarPagos    = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero'
  const puedeGestionarNinos = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero' || perfil?.rol === 'Secretario'
  const puedeEditar         = puedeGestionarNinos
  const esAdmin             = perfil?.rol === 'Admin'

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="relative">
        <img 
          src="/logo_regacitos.png" 
          alt="Cargando..." 
          className="w-20 h-20 object-contain animate-pulse" 
        />
        <div className="absolute inset-0 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin"></div>
      </div>
      <p className="text-brand-600 font-bold text-sm animate-bounce">Cargando...</p>
    </div>
  )

  return (
    <div className="max-w-6xl">
      {/* Modales */}
      {modalNino !== null && (
        <ModalNino
          nino={modalNino === 'nuevo' ? null : modalNino}
          apoderados={apoderados}
          onClose={() => setModalNino(null)}
          onGuardado={fetchAll}
        />
      )}
      {modalImportar && (
        <ModalImportar onClose={() => setModalImportar(false)} onImportado={fetchAll} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Niñas y Niños</h1>
          <p className="text-gray-500 text-sm mt-1">{ninos.length} inscritos activos · {ANIO_ACTUAL}</p>
        </div>
        {puedeGestionarNinos && (
          <div className="flex gap-3">
            <button onClick={() => setModalImportar(true)} className="btn-secondary flex items-center gap-2 text-xs sm:text-sm">
              📂 Importar
            </button>
            <button onClick={() => setModalNino('nuevo')} className="btn-primary flex items-center gap-2 text-xs sm:text-sm">
              + Agregar niña o niño
            </button>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="mb-5">
        <input className="input max-w-xs" placeholder="🔍  Buscar por nombre o RUT..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* CONTENEDOR DE LA LISTA */}
      <div className="mt-6 w-full max-w-full">
        {/* 📱 VISTA MÓVIL (Tarjetas - iPhone SE friendly) */}
        <div className="grid grid-cols-1 gap-4 md:hidden w-full">
          {filtered.map(nino => {
            const alDia = cuotasAlDia(nino.id);
            return (
              <div key={nino.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm w-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate text-sm">{nino.nombres} {nino.apellidos}</p>
                    <p className="text-[10px] text-gray-400 font-mono uppercase">{nino.rut || 'Sin RUT'}</p>
                  </div>
                  {puedeGestionarNinos && (
                    <button 
                      onClick={() => setModalNino(nino)}
                      className="ml-2 p-2 bg-gray-50 rounded-lg border border-gray-100 text-sm"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {/* Grilla de 5 columnas para meses */}
                <div className="grid grid-cols-5 gap-1.5 mb-4">
                  {MESES_STR.map(mesNum => {
                    const pagado = pagos[nino.id]?.[MESES_LABEL[mesNum]] || false;
                    return (
                      <div key={mesNum} className="flex flex-col items-center">
                        <button
                          onClick={() => {
                            if (pagado) {
                              // Ahora sí encontrará la info gracias a que guardamos cuotasRaw
                              const infoPago = cuotasRaw.find(c => c.id_nino === nino.id && c.mes === MESES_LABEL[mesNum]);
                              setVoucherView({ nino: nino, pago: infoPago });
                            } else if (puedeMarcarPagos) {
                              togglePago(nino.id, mesNum);
                            }
                          }}
                          className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all ${
                            pagado ? 'bg-brand-100 text-brand-700' : 'bg-luna-50 text-luna-300 border-luna-100'
                          } ${!puedeMarcarPagos ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                        >
                          {pagado ? '✓' : '·'}
                        </button>
                        <span className="text-[8px] mt-1 text-gray-400 uppercase font-bold">{MESES_LABEL[mesNum].substring(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <Link href={`/dashboard/ninos/${nino.id}`} className="flex-1 text-center py-2 bg-brand-50 text-brand-700 text-xs font-bold rounded-lg border border-brand-100">
                    Ver Ficha →
                  </Link>
                  {esAdmin && (
                    <button 
                      onClick={() => eliminarNino(nino)}
                      className="p-2 bg-red-50 text-red-500 rounded-lg border border-red-100 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 💻 VISTA ESCRITORIO (Tabla original mejorada) */}
        <div className="hidden md:block card p-0 overflow-x-auto border-gray-200 shadow-sm rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase sticky left-0 bg-gray-50 z-10">Nombre</th>
                {MESES_STR.map(m => (
                  <th key={m} className="px-2 py-3 font-semibold text-gray-400 text-xs text-center">{MESES_LABEL[m]}</th>
                ))}
                <th className="px-3 py-3 text-gray-400 text-xs text-center">Pagos</th>
                <th className="px-3 py-3 text-gray-400 text-xs text-center">Ficha</th>
                {puedeEditar && <th className="px-3 py-3 text-gray-400 text-xs text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filtered.map(nino => (
                <tr key={nino.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 sticky left-0 bg-white border-r border-gray-50">
                    <p className="font-medium text-gray-800 text-sm truncate max-w-[150px]">{nino.nombres} {nino.apellidos}</p>
                  </td>
                  {MESES_STR.map(mesNum => {
                    const pagado = pagos[nino.id]?.[MESES_LABEL[mesNum]] || false;
                    return (
                      <td key={mesNum} className="px-1 py-3 text-center">
                        <button
                          onClick={() => {
                            if (pagado) {
                              const infoPago = cuotasRaw.find(c => c.id_nino === nino.id && c.mes === MESES_LABEL[mesNum]);
                              setVoucherView({ nino: nino, pago: infoPago });
                            } else if (puedeMarcarPagos) {
                              togglePago(nino.id, mesNum);
                            }
                          }}
                          disabled={!puedeMarcarPagos}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            pagado ? 'bg-brand-100 text-brand-700' : 'bg-luna-50 text-luna-300 border-luna-100'
                          } ${!puedeMarcarPagos ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                        >
                          {pagado ? '✓' : '·'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center font-bold text-xs">
                    {cuotasAlDia(nino.id)}/10
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link href={`/dashboard/ninos/${nino.id}`} className="text-brand-600 hover:underline text-xs font-bold">Ver →</Link>
                  </td>
                  {puedeGestionarNinos && (
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setModalNino(nino)} title="Editar Ficha" className="p-1 hover:bg-gray-100 rounded">✏️</button>
                        {esAdmin && <button onClick={() => eliminarNino(nino)} title="Eliminar" className="p-1 hover:bg-gray-100 rounded text-red-500">✕</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================
          MODAL DEL VOUCHER
      ========================================== */}
      {voucherView && (
        <VoucherModal 
          nino={voucherView.nino} 
          pago={voucherView.pago} 
          onClose={() => setVoucherView(null)} 
        />
      )}
    </div>
  )
}

function VoucherModal({ pago, nino, onClose }) {
  const voucherRef = useRef(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(!!navigator.share);
  }, []);

  const folioID = `RG-${pago.anio || new Date().getFullYear()}-${pago.mes.substring(0, 3).toUpperCase()}-${nino.id.substring(0, 4).toUpperCase()}`;

  const generatePDF = async () => {
    if (!voucherRef.current) return;
    try {
      const element = voucherRef.current;
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, scrollY: -window.scrollY });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdfWidth = element.offsetWidth;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Comprobante_${nino.nombres}_${pago.mes}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF:", error);
    }
  };

  const shareVoucher = async () => {
    if (!navigator.share || !voucherRef.current) return;
    try {
      const canvas = await html2canvas(voucherRef.current, { scale: 2, useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `Comprobante_${pago.mes}.png`, { type: blob.type });

      await navigator.share({
        files: [file],
        title: 'Comprobante Jardín Regacitos',
        text: `Hola! Aquí está el comprobante de ${pago.mes} de ${nino.nombres}. 🌱`,
      });
      onClose();
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm relative animate-in fade-in zoom-in duration-200">
          <div ref={voucherRef} className="bg-[#f0f9f6] p-4 rounded-[2rem] relative">
            <div className="bg-white rounded-[1.5rem] border-2 border-dashed border-brand-200 p-4 pb-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-50">
                <div className="bg-brand-50 p-1.5 rounded-full shadow-sm border border-brand-100 flex-shrink-0">
                  <img src="/logo_regacitos.png" alt="Logo" className="w-9 h-9 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[17px] font-black text-brand-700 uppercase tracking-wide leading-none">Jardín Regacitos</h2>
                  <p className="text-[8px] font-bold text-accent-500 uppercase tracking-widest bg-accent-50 inline-block px-2 py-0.5 rounded-md mt-1">Comprobante Digital</p>
                </div>
              </div>

              <div className="bg-brand-50 rounded-xl p-3 text-center border border-brand-100 mb-4">
                <p className="text-3xl font-black text-brand-700 leading-none">$4.000</p>
                <p className="text-[9px] font-bold text-brand-400 uppercase tracking-widest mt-1">Monto Recibido</p>
              </div>

              <div className="space-y-2">
                <div className="flex bg-[#fafafa] rounded-lg p-2 items-center border border-gray-100">
                  <span className="text-lg mr-2 leading-none">🧒</span>
                  <div className="flex-1">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Alumno</p>
                    <p className="font-bold text-gray-800 text-xs leading-tight">{nino.nombres} {nino.apellidos}</p>
                  </div>
                </div>
                <div className="flex bg-[#fafafa] rounded-lg p-2 items-center border border-gray-100">
                  <span className="text-lg mr-2 leading-none">🎒</span>
                  <div className="flex-1">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Concepto</p>
                    <p className="font-bold text-gray-800 text-xs leading-tight">Cuota de {pago.mes} {pago.anio || new Date().getFullYear()}</p>
                  </div>
                </div>
                <div className="flex bg-[#fafafa] rounded-lg p-2 items-center border border-gray-100">
                  <span className="text-lg mr-2 leading-none">📅</span>
                  <div className="flex-1">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Fecha de Pago</p>
                    <p className="font-bold text-gray-800 text-xs leading-tight">{new Date(pago.fecha_pago).toLocaleDateString('es-CL')}</p>
                  </div>
                </div>
                <div className="flex bg-[#fafafa] rounded-lg p-2 items-center border border-gray-100">
                  <span className="text-lg mr-2 leading-none">✍️</span>
                  <div className="flex-1">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Recibido por</p>
                    <p className="font-bold text-gray-800 text-xs leading-tight">{pago.recibido_por || 'Administración'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                <p className="text-[9px] text-gray-500 font-medium leading-snug">
                  Este comprobante digital confirma el abono de la cuota del mes de <span className="font-bold text-gray-700">{pago.mes} {pago.anio || new Date().getFullYear()}</span> en el descrito.
                </p>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1.5">Folio: {folioID}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2 px-1">
            {canShare && (
              <button onClick={shareVoucher} className="w-full py-3 bg-accent-500 hover:bg-accent-600 text-white font-black text-sm rounded-xl shadow-md shadow-accent-500/20 flex items-center justify-center gap-2">
                <span>Compartir Imagen</span> 📲
              </button>
            )}
            <button onClick={generatePDF} className="w-full py-2.5 bg-white text-brand-600 font-bold text-sm rounded-xl border border-gray-100 shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50">
              📥 Descargar PDF
            </button>
            <button onClick={onClose} className="w-full py-2 text-white/80 font-bold uppercase tracking-widest text-[10px] hover:text-white">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}