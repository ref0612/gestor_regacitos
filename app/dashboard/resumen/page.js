'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

const MESES = [
  { num: '3',  label: 'Marzo' },    { num: '4',  label: 'Abril' },
  { num: '5',  label: 'Mayo' },     { num: '6',  label: 'Junio' },
  { num: '7',  label: 'Julio' },    { num: '8',  label: 'Agosto' },
  { num: '9',  label: 'Septiembre' },{ num: '10', label: 'Octubre' },
  { num: '11', label: 'Noviembre' },{ num: '12', label: 'Diciembre' },
]
const ANIO_ACTUAL = new Date().getFullYear()
const MES_ACTUAL  = new Date().getMonth() + 1
const MESES_LABEL = Object.fromEntries(MESES.map(m => [m.num, m.label]))

export default function ResumenMensualPage() {
  const [mesSeleccionado, setMesSeleccionado] = useState(String(MES_ACTUAL < 3 ? 3 : MES_ACTUAL))
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)
  const reporteRef = useRef(null)
  const supabase = createClient()

  useEffect(() => { fetchReporte(mesSeleccionado) }, [mesSeleccionado])

  async function fetchReporte(mes) {
    setLoading(true)
    const mesNombre = MESES_LABEL[mes]

    // Niños activos
    const { data: ninos } = await supabase.from('ninos').select('id, nombres, apellidos, rut').eq('activo', true).order('apellidos')

    // Configuración
    const { data: config } = await supabase.from('configuracion').select('*').single()

    // Pagos del mes
    const { data: pagos } = await supabase.from('pagos_cuotas')
      .select('*').eq('mes', mesNombre).eq('anio', ANIO_ACTUAL)

    // Gastos del mes (por fecha)
    const fechaInicio = new Date(`${ANIO_ACTUAL}-${mes.padStart(2,'0')}-01`).toISOString()
    const mesNext     = String(parseInt(mes) + 1).padStart(2,'0')
    const fechaFin    = parseInt(mes) < 12
      ? new Date(`${ANIO_ACTUAL}-${mesNext}-01`).toISOString()
      : new Date(`${ANIO_ACTUAL+1}-01-01`).toISOString()

    const { data: gastos } = await supabase.from('movimientos')
      .select('*, categorias_gastos(nombre)')
      .eq('tipo', 'Egreso')
      .gte('fecha', fechaInicio)
      .lt('fecha', fechaFin)
      .order('fecha', { ascending: false })

    const { data: ingresos } = await supabase.from('movimientos')
      .select('*')
      .eq('tipo', 'Ingreso')
      .gte('fecha', fechaInicio)
      .lt('fecha', fechaFin)

    // Calcular
    const pagosMapa = Object.fromEntries((pagos || []).map(p => [p.id_nino, p]))
    const ninosPagados   = ninos.filter(n => pagosMapa[n.id]?.pagado)
    const ninosPendientes = ninos.filter(n => !pagosMapa[n.id]?.pagado)

    const totalEsperado   = ninos.length * (config?.valor_cuota_total || 4000)
    const totalRecaudado  = ninosPagados.reduce((a, n) => a + Number(pagosMapa[n.id]?.monto_total || config?.valor_cuota_total || 4000), 0)
    const totalGastos     = (gastos || []).reduce((a, g) => a + Number(g.monto), 0)
    const totalIngresosExtra = (ingresos || []).reduce((a, i) => a + Number(i.monto), 0)
    const porcentaje      = totalEsperado > 0 ? Math.round((totalRecaudado / totalEsperado) * 100) : 0

    setData({
      mes: mesNombre, config,
      ninos, ninosPagados, ninosPendientes, pagosMapa,
      totalEsperado, totalRecaudado, totalGastos, totalIngresosExtra, porcentaje,
      gastos: gastos || [], ingresos: ingresos || [],
    })
    setLoading(false)
  }

  async function exportarPDF() {
    if (!reporteRef.current) return
    setExportando(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF       = (await import('jspdf')).default
      const el     = reporteRef.current
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, scrollY: -window.scrollY })
      const img    = canvas.toDataURL('image/jpeg', 0.95)
      const w      = el.offsetWidth
      const h      = (canvas.height * w) / canvas.width
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] })
      pdf.addImage(img, 'JPEG', 0, 0, w, h)
      pdf.save(`Reporte_${data.mes}_${ANIO_ACTUAL}.pdf`)
    } catch (e) { alert('Error al exportar: ' + e.message) }
    setExportando(false)
  }

  const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })

  return (
    <div className="max-w-5xl">
      {/* Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte Mensual</h1>
          <p className="text-gray-500 text-sm mt-1">Resumen de cobranza y gastos por mes</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="input"
            value={mesSeleccionado}
            onChange={e => setMesSeleccionado(e.target.value)}>
            {MESES.filter(m => parseInt(m.num) <= MES_ACTUAL || parseInt(m.num) >= 3).map(m => (
              <option key={m.num} value={m.num}>{m.label} {ANIO_ACTUAL}</option>
            ))}
          </select>
          <button onClick={exportarPDF} disabled={exportando || loading}
            className="btn-primary flex items-center gap-2 whitespace-nowrap">
            {exportando ? '⏳ Exportando...' : '📥 Exportar PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 text-4xl animate-spin">🌱</div>
      ) : (
        /* ── Contenido exportable ── */
        <div ref={reporteRef} className="space-y-6 bg-gray-50 p-2 rounded-2xl">

          {/* Encabezado del reporte */}
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo_regacitos.png" alt="Logo" className="w-12 h-12 object-contain" />
              <div>
                <p className="font-bold text-gray-900">Jardín Infantil Regacitos</p>
                <p className="text-xs text-gray-400">Reporte de cobranza · {data.mes} {ANIO_ACTUAL}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Generado el</p>
              <p className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('es-CL')}</p>
            </div>
          </div>

          {/* KPIs principales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total esperado',   value: fmt(data.totalEsperado),  color: 'text-gray-800',    bg: 'bg-white' },
              { label: 'Total recaudado',  value: fmt(data.totalRecaudado), color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Total gastos mes', value: fmt(data.totalGastos),    color: 'text-red-600',     bg: 'bg-red-50' },
              { label: 'Cobranza',         value: `${data.porcentaje}%`,    color: data.porcentaje >= 80 ? 'text-emerald-700' : 'text-amber-600', bg: 'bg-white' },
            ].map(k => (
              <div key={k.label} className={`${k.bg} rounded-2xl border border-gray-100 p-4`}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Barra de progreso */}
          <div className="card">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-bold text-gray-700">Progreso de cobranza</p>
              <p className="text-sm font-bold text-gray-500">
                {data.ninosPagados.length} de {data.ninos.length} niños al día
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div className={`h-4 rounded-full transition-all duration-500 ${
                data.porcentaje >= 80 ? 'bg-emerald-500' : data.porcentaje >= 50 ? 'bg-amber-400' : 'bg-red-400'
              }`} style={{ width: `${data.porcentaje}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          {/* Tablas lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pagados */}
            <div className="card p-0">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-emerald-700 text-sm">✓ Al día ({data.ninosPagados.length})</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {data.ninosPagados.length === 0 && (
                  <p className="text-center py-6 text-gray-400 text-sm">Sin pagos registrados</p>
                )}
                {data.ninosPagados.map(n => {
                  const p = data.pagosMapa[n.id]
                  return (
                    <div key={n.id} className="flex items-center justify-between px-5 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{n.nombres} {n.apellidos}</p>
                        {p?.fecha_pago && <p className="text-xs text-gray-400">{fmtDate(p.fecha_pago)}</p>}
                      </div>
                      <span className="text-sm font-bold text-emerald-700">{fmt(p?.monto_total || data.config?.valor_cuota_total || 4000)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Pendientes */}
            <div className="card p-0">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-red-600 text-sm">⏳ Pendientes ({data.ninosPendientes.length})</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {data.ninosPendientes.length === 0 && (
                  <p className="text-center py-6 text-gray-400 text-sm">¡Todos al día! 🎉</p>
                )}
                {data.ninosPendientes.map(n => (
                  <div key={n.id} className="flex items-center justify-between px-5 py-2.5">
                    <p className="text-sm font-medium text-gray-700">{n.nombres} {n.apellidos}</p>
                    <span className="text-sm font-bold text-red-400">{fmt(data.config?.valor_cuota_total || 4000)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gastos del mes */}
          {data.gastos.length > 0 && (
            <div className="card p-0">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm">Gastos del mes</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.gastos.map(g => (
                  <div key={g.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{g.descripcion}</p>
                      <p className="text-xs text-gray-400">{g.categorias_gastos?.nombre || g.destino} · {fmtDate(g.fecha)}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600 tabular-nums">-{fmt(g.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-5 py-3 bg-gray-50">
                  <span className="text-sm font-bold text-gray-700">Total egresos del mes</span>
                  <span className="text-sm font-bold text-red-600 tabular-nums">-{fmt(data.totalGastos)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Balance del mes */}
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Balance del mes</h3>
            <div className="space-y-2">
              {[
                { label: 'Cuotas recaudadas',  value: data.totalRecaudado,    color: 'text-emerald-700' },
                { label: 'Ingresos extra',      value: data.totalIngresosExtra, color: 'text-emerald-600' },
                { label: 'Gastos del mes',      value: -data.totalGastos,      color: 'text-red-600' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{r.label}</span>
                  <span className={`font-bold tabular-nums ${r.color}`}>
                    {r.value >= 0 ? '+' : ''}{fmt(r.value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="font-bold text-gray-900">Balance neto</span>
                <span className={`text-lg font-bold tabular-nums ${
                  data.totalRecaudado + data.totalIngresosExtra - data.totalGastos >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}>
                  {fmt(data.totalRecaudado + data.totalIngresosExtra - data.totalGastos)}
                </span>
              </div>
            </div>
          </div>

          {/* Pie del reporte */}
          <div className="text-center text-xs text-gray-400 py-2">
            Jardín Infantil Regacitos · Reporte {data.mes} {ANIO_ACTUAL} · Confidencial
          </div>
        </div>
      )}
    </div>
  )
}