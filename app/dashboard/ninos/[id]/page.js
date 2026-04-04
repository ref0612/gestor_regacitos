'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

const MESES = [
  { num: '3',  label: 'Marzo' },    { num: '4',  label: 'Abril' },
  { num: '5',  label: 'Mayo' },     { num: '6',  label: 'Junio' },
  { num: '7',  label: 'Julio' },    { num: '8',  label: 'Agosto' },
  { num: '9',  label: 'Septiembre' },{ num: '10', label: 'Octubre' },
  { num: '11', label: 'Noviembre' },{ num: '12', label: 'Diciembre' },
]
const ANIO_ACTUAL = new Date().getFullYear()

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-400 sm:w-44 mb-1 sm:mb-0">{label}</span>
      <span className="text-gray-800 text-sm">{value || '—'}</span>
    </div>
  )
}

export default function NinoDetailPage() {
  const { id }    = useParams()
  const router    = useRouter()
  const [nino, setNino]     = useState(null)
  const [pagos, setPagos]   = useState([])
  const [config, setConfig] = useState({ valor_cuota_total: 4000, monto_dejando_huellas: 1000 })
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
      setPerfil(p)
    }
    const { data: n }   = await supabase.from('ninos').select('*').eq('id', id).single()
    const { data: c }   = await supabase.from('pagos_cuotas').select('*').eq('id_nino', id).eq('anio', ANIO_ACTUAL).order('mes')
    const { data: cfg } = await supabase.from('configuracion').select('*').single()
    setNino(n)
    setPagos(c || [])
    if (cfg) setConfig(cfg)
    setLoading(false)
  }

  async function togglePago(mesNombre) {
    // Blindamos la variable para evitar el error de pagos.find is not a function
    const listaPagos = Array.isArray(pagos) ? pagos : []
    const actual = listaPagos.find(p => p.mes === mesNombre)
    const nuevoPagado = !(actual?.pagado || false)

    const { error } = await supabase
      .from('pagos_cuotas')
      .upsert(
        { id_nino: id, mes: mesNombre, anio: ANIO_ACTUAL, pagado: nuevoPagado }, 
        { onConflict: 'id_nino,mes,anio' } // <-- REGLA CORRECTA
      )

    if (error) { alert('Error: ' + error.message); return }
    fetchAll()
  }

  async function eliminarNino() {
    if (!confirm(`¿Desactivar a ${nino.nombres} ${nino.apellidos}?`)) return
    await supabase.from('ninos').update({ activo: false }).eq('id', id)
    router.push('/dashboard/ninos')
  }

  if (loading) return <div className="flex justify-center items-center h-64 text-4xl animate-spin">🌱</div>
  if (!nino)   return <div className="text-center py-20 text-gray-400">Niño no encontrado</div>

  const puedeEditar = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero'
  const pagosMapa   = Object.fromEntries(pagos.map(p => [p.mes, p]))
  const totalPagado = pagos.filter(p => p.pagado).length
  const totalGeneral = pagos.filter(p => p.pagado).reduce((a, p) => a + Number(p.monto_general || 0), 0)
  const totalHuellas = pagos.filter(p => p.pagado).reduce((a, p) => a + Number(p.monto_huellas || 0), 0)
  const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-brand-600 hover:text-brand-800 text-sm flex items-center gap-1 mb-2">← Volver</button>
          <h1 className="text-2xl font-bold text-gray-900">{nino.nombres} {nino.apellidos}</h1>
          <p className="text-gray-500 text-sm mt-1">RUT: {nino.rut}</p>
        </div>
        {perfil?.rol === 'Admin' && (
          <button onClick={eliminarNino} className="btn-danger text-xs">Desactivar</button>
        )}
      </div>

      <div className="card mb-5">
        <h2 className="font-bold text-gray-800 mb-3">Datos del niño</h2>
        <InfoRow label="Fecha de nacimiento" value={nino.fecha_nacimiento ? new Date(nino.fecha_nacimiento).toLocaleDateString('es-CL') : null} />
        <InfoRow label="Seguro médico"  value={nino.seguro_medico} />
        <InfoRow label="Info. contacto" value={nino.info_contacto} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="card text-center p-4">
          <p className="text-3xl font-bold text-brand-700">{totalPagado}<span className="text-lg text-gray-400">/10</span></p>
          <p className="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">Cuotas pagadas</p>
        </div>
        <div className="card text-center p-4">
          <p className="text-xl font-bold text-emerald-700">{fmt(totalGeneral)}</p>
          <p className="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">Aporte general</p>
        </div>
        <div className="card text-center p-4">
          <p className="text-xl font-bold text-blue-700">{fmt(totalHuellas)}</p>
          <p className="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">Fondo Huellas</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800">Cuotas {ANIO_ACTUAL}</h2>
          <span className="text-xs text-gray-400">
            Cuota: {fmt(config.valor_cuota_total)} | Huellas: {fmt(config.monto_dejando_huellas)}
          </span>
        </div>
        <div className="space-y-2">
          {MESES.map(({ num, label }) => {
            const p      = pagosMapa[label] // <-- USAR label, NO num
            const pagado = p?.pagado || false
            return (
              <div key={num} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                pagado ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    pagado ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                    {pagado ? '✓' : num}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    {pagado && p?.fecha_pago && (
                      <p className="text-xs text-gray-400">
                        {new Date(p.fecha_pago).toLocaleDateString('es-CL')} ·{' '}
                        {fmt(p.monto_general)} gral + {fmt(p.monto_huellas)} huellas
                      </p>
                    )}
                  </div>
                </div>
                {puedeEditar ? (
                  <button onClick={() => togglePago(label)} // <-- USAR label, NO num
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      pagado ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}>
                    {pagado ? 'Revertir' : 'Marcar pagado'}
                  </button>
                ) : (
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${pagado ? 'badge-green' : 'badge-red'}`}>
                    {pagado ? 'Al día' : 'Pendiente'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
