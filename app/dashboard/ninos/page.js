'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

// mes como texto: '3','4',...,'12'
const MESES_STR = ['3','4','5','6','7','8','9','10','11','12']
const MESES_LABEL = { '3':'Mar','4':'Abr','5':'May','6':'Jun','7':'Jul','8':'Ago','9':'Sep','10':'Oct','11':'Nov','12':'Dic' }
const ANIO_ACTUAL = new Date().getFullYear()

export default function NinosPage() {
  const [ninos, setNinos]   = useState([])
  const [pagos, setPagos]   = useState({})   // { id_nino: { '3': true, ... } }
  const [loading, setLoading]   = useState(true)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [perfil, setPerfil] = useState(null)
  const fileRef = useRef()
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
    const mapa = {}
    c?.forEach(({ id_nino, mes, pagado }) => {
      if (!mapa[id_nino]) mapa[id_nino] = {}
      mapa[id_nino][String(mes)] = pagado
    })
    setNinos(n || [])
    setPagos(mapa)
    setLoading(false)
  }

  async function togglePago(idNino, mes) {
    const actual = pagos[idNino]?.[mes] || false
    setPagos(prev => ({ ...prev, [idNino]: { ...prev[idNino], [mes]: !actual } }))
    const { error } = await supabase
      .from('pagos_cuotas')
      .upsert({ id_nino: idNino, mes: String(mes), anio: ANIO_ACTUAL, pagado: !actual },
               { onConflict: 'id_nino,mes,anio' })
    if (error) {
      setPagos(prev => ({ ...prev, [idNino]: { ...prev[idNino], [mes]: actual } }))
      alert('Error al actualizar: ' + error.message)
    }
  }

  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb   = XLSX.read(data, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 0 })
      const registros = rows.map(r => ({
        nombres:          r['nombres']          || r['Nombres']          || r['nombre']   || '',
        apellidos:        r['apellidos']        || r['Apellidos']        || r['apellido'] || '',
        rut:              r['rut']              || r['RUT']              || '',
        fecha_nacimiento: r['fecha_nacimiento'] || r['Fecha Nacimiento'] || null,
        seguro_medico:    r['seguro_medico']    || r['Seguro Médico']    || '',
        info_contacto:    r['info_contacto']    || r['Contacto']         || '',
        activo:           true,
      })).filter(r => r.nombres)
      const { error } = await supabase.from('ninos').insert(registros)
      if (error) throw error
      alert(`✅ ${registros.length} niños importados`)
      fetchAll()
    } catch (err) {
      alert('Error al importar: ' + err.message)
    } finally {
      setImporting(false)
      fileRef.current.value = ''
    }
  }

  const filtered     = ninos.filter(n => `${n.nombres} ${n.apellidos}`.toLowerCase().includes(search.toLowerCase()))
  const cuotasAlDia  = (idNino) => MESES_STR.filter(m => pagos[idNino]?.[m]).length
  const puedeEditar  = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero'

  if (loading) return <div className="flex justify-center items-center h-64 text-4xl animate-spin">🌱</div>

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Niños</h1>
          <p className="text-gray-500 text-sm mt-1">{ninos.length} inscritos activos · {ANIO_ACTUAL}</p>
        </div>
        {puedeEditar && (
          <div className="flex gap-3">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarExcel} />
            <button onClick={() => fileRef.current.click()} disabled={importing} className="btn-secondary flex items-center gap-2">
              <span>📂</span> {importing ? 'Importando...' : 'Importar Excel'}
            </button>
          </div>
        )}
      </div>

      <div className="mb-5">
        <input className="input max-w-xs" placeholder="🔍  Buscar por nombre..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600 sticky left-0 bg-white min-w-[180px]">Nombre</th>
              {MESES_STR.map(m => (
                <th key={m} className="px-2 py-3 font-semibold text-gray-500 text-center min-w-[52px]">{MESES_LABEL[m]}</th>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-500 text-center">Pagadas</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={14} className="text-center py-12 text-gray-400">No hay niños registrados</td></tr>
            )}
            {filtered.map(nino => {
              const alDia = cuotasAlDia(nino.id)
              return (
                <tr key={nino.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 sticky left-0 bg-white font-medium text-gray-800 whitespace-nowrap">
                    {nino.nombres} {nino.apellidos}
                  </td>
                  {MESES_STR.map(mes => {
                    const pagado = pagos[nino.id]?.[mes] || false
                    return (
                      <td key={mes} className="px-2 py-3 text-center">
                        <button
                          onClick={() => puedeEditar && togglePago(nino.id, mes)}
                          disabled={!puedeEditar}
                          title={pagado ? 'Pagado' : 'Pendiente'}
                          className={`w-8 h-8 rounded-lg text-sm font-bold transition-all duration-150 ${
                            pagado ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                          } ${!puedeEditar ? 'cursor-default' : 'cursor-pointer'}`}>
                          {pagado ? '✓' : '·'}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold tabular-nums ${alDia === 10 ? 'text-emerald-600' : alDia === 0 ? 'text-red-500' : 'text-amber-600'}`}>
                      {alDia}/10
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/ninos/${nino.id}`} className="text-brand-700 hover:text-brand-900 text-xs font-semibold">
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <strong>Formato Excel para importar:</strong> columnas:{' '}
        <code className="bg-amber-100 px-1 rounded">nombres, apellidos, rut, fecha_nacimiento, seguro_medico, info_contacto</code>
      </div>
    </div>
  )
}
