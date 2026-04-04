'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const MESES_STR   = ['3','4','5','6','7','8','9','10','11','12']
const MESES_LABEL = { '3':'Marzo','4':'Abril','5':'Mayo','6':'Junio','7':'Julio','8':'Agosto','9':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre' }
const ANIO_ACTUAL = new Date().getFullYear()

const FORM_VACIO = { nombres: '', apellidos: '', rut: '', fecha_nacimiento: '', seguro_medico: '', info_contacto: '', id_apoderado: '' }

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
  const [apoderados, setApoderados] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [perfil, setPerfil]       = useState(null)
  const [modalNino, setModalNino] = useState(null)   // null | 'nuevo' | objeto niño para editar
  const [modalImportar, setModalImportar] = useState(false)
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
      setPerfil(p)
    }
    const { data: n } = await supabase.from('ninos').select('*').eq('activo', true).order('apellidos')
    const { data: c } = await supabase.from('pagos_cuotas').select('id_nino, mes, pagado').eq('anio', ANIO_ACTUAL)
    const { data: a } = await supabase.from('perfiles').select('id, nombre_completo, email').eq('rol', 'Apoderado').order('nombre_completo')
    const mapa = {}
    c?.forEach(({ id_nino, mes, pagado }) => {
      if (!mapa[id_nino]) mapa[id_nino] = {}
      mapa[id_nino][String(mes)] = pagado
    })
    setNinos(n || [])
    setPagos(mapa)
    setApoderados(a || [])
    setLoading(false)
  }

  async function togglePago(idNino, mesNum) {
    const nombreMes = MESES_LABEL[mesNum] // Convertimos el '3' en 'Marzo'
    const actual = pagos[idNino]?.[nombreMes] || false

    // Actualizamos la vista local primero
    setPagos(prev => ({ ...prev, [idNino]: { ...prev[idNino], [nombreMes]: !actual } }))

    // Enviamos el nombre del mes y usamos la regla 'unique_pago_mes_anio'
    const { error } = await supabase.from('pagos_cuotas')
      .upsert(
        { id_nino: idNino, mes: nombreMes, anio: ANIO_ACTUAL, pagado: !actual }, 
        { onConflict: 'id_nino,mes,anio' }
      )

    if (error) {
      // Si falla, revertimos el cambio en la vista
      setPagos(prev => ({ ...prev, [idNino]: { ...prev[idNino], [nombreMes]: actual } }))
      alert('Error: ' + error.message)
    }
  }

  async function eliminarNino(nino) {
    if (!confirm(`¿Eliminar a ${nino.nombres} ${nino.apellidos}?
Se eliminarán también sus registros de cuotas.`)) return
    await supabase.from('pagos_cuotas').delete().eq('id_nino', nino.id)
    await supabase.from('ninos').delete().eq('id', nino.id)
    fetchAll()
  }

  const filtered    = ninos.filter(n => `${n.nombres} ${n.apellidos} ${n.rut || ''}`.toLowerCase().includes(search.toLowerCase()))
  const cuotasAlDia = (id) => MESES_STR.filter(m => pagos[id]?.[MESES_LABEL[m]]).length
  const puedeEditar = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero'
  const esAdmin     = perfil?.rol === 'Admin'

  if (loading) return <div className="flex justify-center items-center h-64 text-4xl animate-spin">🌱</div>

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
          <h1 className="text-2xl font-bold text-gray-900">Niños</h1>
          <p className="text-gray-500 text-sm mt-1">{ninos.length} inscritos activos · {ANIO_ACTUAL}</p>
        </div>
        {puedeEditar && (
          <div className="flex gap-3">
            <button onClick={() => setModalImportar(true)} className="btn-secondary flex items-center gap-2">
              📂 Importar Excel
            </button>
            <button onClick={() => setModalNino('nuevo')} className="btn-primary flex items-center gap-2">
              + Agregar niño
            </button>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="mb-5">
        <input className="input max-w-xs" placeholder="🔍  Buscar por nombre o RUT..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabla grilla */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide sticky left-0 bg-gray-50 min-w-[200px]">Nombre</th>
              {MESES_STR.map(m => (
                <th key={m} className="px-2 py-3 font-semibold text-gray-400 text-xs text-center min-w-[44px]">{MESES_LABEL[m]}</th>
              ))}
              <th className="px-3 py-3 font-semibold text-gray-400 text-xs text-center">Pagadas</th>
              <th className="px-3 py-3 text-gray-400 text-xs text-center">Ficha</th>
              {puedeEditar && <th className="px-3 py-3 text-gray-400 text-xs text-center">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 15 : 14} className="text-center py-16 text-gray-400">
                  {ninos.length === 0
                    ? <div className="space-y-2">
                        <p className="text-4xl">👧</p>
                        <p className="font-medium">No hay niños registrados</p>
                        <p className="text-xs">Usa "Agregar niño" o "Importar Excel" para comenzar</p>
                      </div>
                    : 'Sin resultados para la búsqueda'}
                </td>
              </tr>
            )}
            {filtered.map(nino => {
              const alDia = cuotasAlDia(nino.id)
              return (
                <tr key={nino.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 sticky left-0 bg-white whitespace-nowrap">
                    <p className="font-medium text-gray-800">{nino.nombres} {nino.apellidos}</p>
                    {nino.rut && <p className="text-xs text-gray-400 font-mono">{nino.rut}</p>}
                  </td>
                  {MESES_STR.map(mes => {
                    const pagado = pagos[nino.id]?.[MESES_LABEL[mes]] || false
                    return (
                      <td key={mes} className="px-1 py-3 text-center">
                        <button
                          onClick={() => puedeEditar && togglePago(nino.id, mes)}
                          disabled={!puedeEditar}
                          title={pagado ? 'Pagado · clic para revertir' : 'Pendiente · clic para marcar'}
                          className={`w-8 h-8 rounded-lg text-sm font-bold transition-all duration-150 ${
                            pagado ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                          } ${!puedeEditar ? 'cursor-default' : 'cursor-pointer'}`}>
                          {pagado ? '✓' : '·'}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-3 py-3 text-center">
                    <span className={`text-sm font-bold tabular-nums ${alDia === 10 ? 'text-emerald-600' : alDia === 0 ? 'text-red-500' : 'text-amber-600'}`}>
                      {alDia}/10
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link href={`/dashboard/ninos/${nino.id}`}
                      className="text-brand-700 hover:text-brand-900 text-xs font-semibold">
                      Ver →
                    </Link>
                  </td>
                  {puedeEditar && (
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setModalNino(nino)} title="Editar"
                          className="text-gray-400 hover:text-brand-600 transition-colors text-sm">✏️</button>
                        {esAdmin && (
                          <button onClick={() => eliminarNino(nino)} title="Eliminar"
                            className="text-gray-300 hover:text-red-500 transition-colors text-sm">✕</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}