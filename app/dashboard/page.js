'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ANIO_ACTUAL = new Date().getFullYear()

function StatCard({ label, amount, color, icon, sub }) {
  const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const colors = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue:  'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red:   'bg-red-50 border-red-200 text-red-900',
  }
  return (
    <div className={`rounded-2xl border p-6 ${colors[color]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider opacity-60">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums">{fmt(amount)}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats]         = useState({ general: 0, huellas: 0, totalGastos: 0, totalIngresos: 0 })
  const [ninosResumen, setNinos] = useState({ total: 0, alDia: 0, conDeuda: 0 })
  const [movRecientes, setMovs]  = useState([])
  const [loading, setLoading]    = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const supabase = createClient()
    setLoading(true)

    // 1. Traer Configuración para el cálculo de respaldo
    const { data: config } = await supabase.from('configuracion').select('*').single()
    const VALOR_CUOTA = config?.valor_cuota_total || 4000
    const VALOR_HUELLAS = config?.monto_dejando_huellas || 1000
    const VALOR_GENERAL = VALOR_CUOTA - VALOR_HUELLAS

    // 2. Traer Pagos
    const { data: pagos } = await supabase
      .from('pagos_cuotas').select('monto_general, monto_huellas, id_nino').eq('pagado', true)

    // 3. Traer Movimientos (Ingresos y Egresos manuales)
    const { data: movs } = await supabase
      .from('movimientos').select('monto, destino, tipo, descripcion, fecha, id_categoria')
      .order('fecha', { ascending: false })

    // 4. Traer Niños y Cuotas para morosidad
    const { data: ninos } = await supabase.from('ninos').select('id').eq('activo', true)
    const { data: cuotas } = await supabase
      .from('pagos_cuotas').select('id_nino, mes, pagado').eq('anio', ANIO_ACTUAL)

    // --- CÁLCULO DE SALDOS ---
    let totalGeneralIn = 0
    let totalHuellasIn = 0

    // Sumar cuotas (con validación de nulos)
    pagos?.forEach(p => {
      totalGeneralIn += p.monto_general !== null ? Number(p.monto_general) : VALOR_GENERAL
      totalHuellasIn += p.monto_huellas !== null ? Number(p.monto_huellas) : VALOR_HUELLAS
    })

    let gastoGeneral = 0, gastoHuellas = 0
    let ingresosExtraGral = 0, ingresosExtraHuellas = 0

    movs?.forEach(m => {
      const monto = Number(m.monto || 0)
      if (m.tipo === 'Egreso') {
        if (m.destino === 'General') gastoGeneral += monto
        else gastoHuellas += monto
      } else {
        if (m.destino === 'General') ingresosExtraGral += monto
        else ingresosExtraHuellas += monto
      }
    })

    setStats({
      general:       totalGeneralIn + ingresosExtraGral - gastoGeneral,
      huellas:       totalHuellasIn + ingresosExtraHuellas - gastoHuellas,
      totalGastos:   gastoGeneral + gastoHuellas,
      totalIngresos: totalGeneralIn + totalHuellasIn + ingresosExtraGral + ingresosExtraHuellas,
    })

    // --- LÓGICA DE MOROSIDAD ---
    const mesActual    = new Date().getMonth() + 1
    const MESES_DB = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    
    // Solo contamos meses hasta el actual (Marzo es index 0 en nuestro array pero mes 3)
    const mesesVencidos = MESES_DB.filter((m, index) => (index + 3) <= mesActual)

    const pagosMapa = {}
    cuotas?.forEach(({ id_nino, mes, pagado }) => {
      if (!pagosMapa[id_nino]) pagosMapa[id_nino] = {}
      pagosMapa[id_nino][mes] = pagado
    })

    const esMoroso = (id) => mesesVencidos.some(m => !pagosMapa[id]?.[m])
    const ninoIds = ninos?.map(n => n.id) || []

    setNinos({
      total:    ninoIds.length,
      alDia:    ninoIds.filter(id => !esMoroso(id)).length,
      conDeuda: ninoIds.filter(id =>  esMoroso(id)).length,
    })

    setMovs(movs?.slice(0, 8) || [])
    setLoading(false)
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })

  if (loading) return <div className="flex items-center justify-center h-64 text-4xl animate-spin">🌱</div>

  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Resumen Financiero</h1>
        <p className="text-gray-500 text-sm mt-1">Estado actual del jardín al {ANIO_ACTUAL}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Caja General (Operativa)" amount={stats.general}  color="green" icon="💰" sub="Disponible para gastos operativos" />
        <StatCard label="Fondo Dejando Huellas"    amount={stats.huellas}  color="blue"  icon="🌟" sub="Pozo para la fiesta de fin de año" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total ingresos" amount={stats.totalIngresos} color="amber" icon="📈" />
        <StatCard label="Total egresos"           amount={stats.totalGastos}   color="red"   icon="📉" />

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Niños activos</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total inscritos</span>
              <span className="font-bold">{ninosResumen.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">Al día</span>
              <span className="font-bold text-emerald-700">{ninosResumen.alDia}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-500">Morosos</span>
              <span className="font-bold text-red-600">{ninosResumen.conDeuda}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm bg-white border border-gray-100 p-6 rounded-2xl">
        <h2 className="font-bold text-gray-800 mb-4">Últimos movimientos</h2>
        {movRecientes.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin movimientos registrados</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {movRecientes.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{m.tipo === 'Egreso' ? '📤' : '📥'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {m.destino} · {fmtDate(m.fecha)}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold tabular-nums ${m.tipo === 'Egreso' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {m.tipo === 'Egreso' ? '-' : '+'}{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}