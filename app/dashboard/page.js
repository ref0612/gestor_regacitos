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
  const [stats, setStats]        = useState({ general: 0, huellas: 0, totalGastos: 0, totalIngresos: 0 })
  const [ninosResumen, setNinos] = useState({ total: 0, alDia: 0, conDeuda: 0 })
  const [movRecientes, setMovs]  = useState([])
  const [loading, setLoading]    = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const supabase = createClient()
    setLoading(true)

    const { data: pagos } = await supabase
      .from('pagos_cuotas').select('monto_general, monto_huellas, id_nino').eq('pagado', true)

    const { data: movs } = await supabase
      .from('movimientos').select('monto, destino, tipo, descripcion, fecha, categorias_gastos(nombre)')
      .order('fecha', { ascending: false }).limit(8)

    const { data: ninos } = await supabase.from('ninos').select('id').eq('activo', true)

    // Traer cuotas del año actual con mes para calcular morosidad correctamente
    const { data: cuotas } = await supabase
      .from('pagos_cuotas').select('id_nino, mes, pagado').eq('anio', ANIO_ACTUAL)

    // Saldos financieros
    let totalGeneral = pagos?.reduce((a, c) => a + Number(c.monto_general || 0), 0) || 0
    let totalHuellas = pagos?.reduce((a, c) => a + Number(c.monto_huellas || 0), 0) || 0
    let gastoGeneral = 0, gastoHuellas = 0
    movs?.filter(m => m.tipo === 'Egreso').forEach(e => {
      if (e.destino === 'General') gastoGeneral += Number(e.monto)
      else if (e.destino === 'Huellas') gastoHuellas += Number(e.monto)
    })
    const ingresosExtra = movs?.filter(m => m.tipo === 'Ingreso')
      .reduce((a, m) => a + Number(m.monto), 0) || 0

    setStats({
      general:       totalGeneral - gastoGeneral + ingresosExtra,
      huellas:       totalHuellas - gastoHuellas,
      totalGastos:   gastoGeneral + gastoHuellas,
      totalIngresos: totalGeneral + totalHuellas,
    })

    // ── Lógica de morosidad ──────────────────────────────────────────────
    // Solo se consideran morosos los meses que ya vencieron (mar → mes actual)
    const mesActual    = new Date().getMonth() + 1  // 1-12
    const mesesDebidos = ['3','4','5','6','7','8','9','10','11','12']
      .filter(m => parseInt(m) <= mesActual)

    // Mapa de pagos por niño: { id_nino: { '3': true, '4': false } }
    const pagosMapa = {}
    cuotas?.forEach(({ id_nino, mes, pagado }) => {
      if (!pagosMapa[id_nino]) pagosMapa[id_nino] = {}
      pagosMapa[id_nino][String(mes)] = pagado
    })

    // Moroso = tiene algún mes vencido sin pagar (o sin registro)
    const esMoroso = (id) => mesesDebidos.some(m => !pagosMapa[id]?.[m])

    const ninoIds = ninos?.map(n => n.id) || []
    setNinos({
      total:    ninoIds.length,
      alDia:    ninoIds.filter(id => !esMoroso(id)).length,
      conDeuda: ninoIds.filter(id =>  esMoroso(id)).length,
    })

    setMovs(movs || [])
    setLoading(false)
  }

  const fmt     = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })

  if (loading) return <div className="flex items-center justify-center h-64 text-4xl animate-spin">🌱</div>

  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Resumen Financiero</h1>
        <p className="text-gray-500 text-sm mt-1">Estado actual del jardín</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Caja General (Operativa)" amount={stats.general}  color="green" icon="💰" sub="Disponible para gastos operativos" />
        <StatCard label="Fondo Dejando Huellas"    amount={stats.huellas}  color="blue"  icon="🌟" sub="Pozo para la fiesta de fin de año" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total ingresos (cuotas)" amount={stats.totalIngresos} color="amber" icon="📈" />
        <StatCard label="Total egresos"           amount={stats.totalGastos}   color="red"   icon="📉" />

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
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

      <div className="card">
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
                      {m.categorias_gastos?.nombre || m.destino} · {fmtDate(m.fecha)}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold tabular-nums ${m.tipo === 'Egreso' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {m.tipo === 'Egreso' ? '-' : '+'}{fmt(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}