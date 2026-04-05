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
const ANIO_ACTUAL  = new Date().getFullYear()
const MES_ACTUAL   = new Date().getMonth() + 1
const MESES_LABEL  = Object.fromEntries(MESES.map(m => [m.num, m.label]))
const LABEL_A_NUM  = Object.fromEntries(MESES.map(m => [m.label, parseInt(m.num)]))

export default function ResumenMensualPage() {
  const [mesSeleccionado, setMesSeleccionado] = useState(String(MES_ACTUAL < 3 ? 3 : MES_ACTUAL))
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [exportando, setExportando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [perfil, setPerfil]     = useState(null)
  const reporteRef = useRef(null)
  const supabase   = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: p } = await supabase.from('perfiles').select('nombre_completo').eq('id', user.id).single()
        setPerfil(p)
      }
    })
  }, [])

  useEffect(() => { fetchReporte(mesSeleccionado) }, [mesSeleccionado])

  async function fetchReporte(mes) {
    setLoading(true)
    const mesNombre   = MESES_LABEL[mes]
    const mesNum      = parseInt(mes)
    const mesNextStr  = String(mesNum + 1).padStart(2, '0')
    const fechaInicio = new Date(`${ANIO_ACTUAL}-${mes.padStart(2,'0')}-01T00:00:00`).toISOString()
    const fechaFin    = mesNum < 12
      ? new Date(`${ANIO_ACTUAL}-${mesNextStr}-01T00:00:00`).toISOString()
      : new Date(`${ANIO_ACTUAL+1}-01-01T00:00:00`).toISOString()

    // Niños activos
    const { data: ninos } = await supabase.from('ninos')
      .select('id, nombres, apellidos').eq('activo', true).order('apellidos')

    // Configuración
    const { data: config } = await supabase.from('configuracion').select('*').single()

    // Pagos del mes seleccionado
    const { data: pagos } = await supabase.from('pagos_cuotas')
      .select('*').eq('mes', mesNombre).eq('anio', ANIO_ACTUAL)

    // TODOS los pagos del año (para detectar adelantadas y atrasadas)
    const { data: todosPagos } = await supabase.from('pagos_cuotas')
      .select('id_nino, mes, anio, pagado, fecha_pago, nota_pago')
      .eq('anio', ANIO_ACTUAL).eq('pagado', true)

    // Gastos del mes
    const { data: gastosGeneral } = await supabase.from('movimientos')
      .select('*, categorias_gastos(nombre)').eq('tipo', 'Egreso').eq('destino', 'General')
      .gte('fecha', fechaInicio).lt('fecha', fechaFin).order('fecha', { ascending: false })

    const { data: gastosHuellas } = await supabase.from('movimientos')
      .select('*, categorias_gastos(nombre)').eq('tipo', 'Egreso').eq('destino', 'Huellas')
      .gte('fecha', fechaInicio).lt('fecha', fechaFin).order('fecha', { ascending: false })

    const { data: ingresosExtra } = await supabase.from('movimientos')
      .select('*').eq('tipo', 'Ingreso')
      .gte('fecha', fechaInicio).lt('fecha', fechaFin)

    // ── Cálculos ────────────────────────────────────────────────────────────
    const pagosMapa      = Object.fromEntries((pagos || []).map(p => [p.id_nino, p]))
    const ninosPagados   = ninos.filter(n => pagosMapa[n.id]?.pagado)
    const ninosPendientes = ninos.filter(n => !pagosMapa[n.id]?.pagado)

    const totalEsperado  = ninos.length * (config?.valor_cuota_total || 4000)
    const totalRecaudado = ninosPagados.reduce((a, n) => a + Number(pagosMapa[n.id]?.monto_total || config?.valor_cuota_total || 4000), 0)
    const porcentaje     = totalEsperado > 0 ? Math.round((totalRecaudado / totalEsperado) * 100) : 0

    // Huellas del mes
    const totalHuellasCuotas = ninosPagados.reduce((a, n) => a + Number(pagosMapa[n.id]?.monto_huellas || config?.monto_dejando_huellas || 1000), 0)
    const totalGastosHuellas = (gastosHuellas || []).reduce((a, g) => a + Number(g.monto), 0)
    const totalGastosGeneral = (gastosGeneral || []).reduce((a, g) => a + Number(g.monto), 0)
    const totalIngresosExtra = (ingresosExtra || []).reduce((a, i) => a + Number(i.monto), 0)

    // ── Adelantadas: niños que ya pagaron meses FUTUROS al seleccionado ────
    const mesesFuturos = MESES.filter(m => parseInt(m.num) > mesNum).map(m => m.label)
    const adelantadasPorNino = {}
    ;(todosPagos || []).forEach(p => {
      if (mesesFuturos.includes(p.mes)) {
        if (!adelantadasPorNino[p.id_nino]) adelantadasPorNino[p.id_nino] = []
        adelantadasPorNino[p.id_nino].push(p.mes)
      }
    })
    const ninosAdelantados = ninos.filter(n => adelantadasPorNino[n.id])
      .map(n => ({ ...n, mesesAdelantados: adelantadasPorNino[n.id] }))

    // ── Atrasadas cobradas EN este mes: fecha_pago en rango pero mes es pasado ─
    const mesesPasados = MESES.filter(m => parseInt(m.num) < mesNum).map(m => m.label)
    const atrasadasEsteMes = (todosPagos || []).filter(p => {
      if (!mesesPasados.includes(p.mes)) return false
      if (!p.fecha_pago) return false
      const fp = new Date(p.fecha_pago)
      return fp >= new Date(fechaInicio) && fp < new Date(fechaFin)
    }).map(p => {
      const nino = ninos.find(n => n.id === p.id_nino)
      return { ...p, nino }
    })

    setData({
      mes: mesNombre, mesNum, config,
      ninos, ninosPagados, ninosPendientes, pagosMapa,
      totalEsperado, totalRecaudado, porcentaje,
      totalHuellasCuotas, totalGastosHuellas, totalGastosGeneral, totalIngresosExtra,
      gastosGeneral: gastosGeneral || [],
      gastosHuellas: gastosHuellas || [],
      ingresosExtra: ingresosExtra || [],
      ninosAdelantados,
      atrasadasEsteMes,
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

  async function publicarComoAnuncio() {
    if (!data) return
    setPublicando(true)
    const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

    const html = `
<h2>📊 Resumen Financiero — ${data.mes} ${ANIO_ACTUAL}</h2>

<p><strong>Cobranza del mes:</strong> ${data.ninosPagados.length} de ${data.ninos.length} niños al día (${data.porcentaje}%)</p>
<p><strong>Total recaudado:</strong> ${fmt(data.totalRecaudado)} de ${fmt(data.totalEsperado)} esperados</p>
<p><strong>Aporte Fondo Huellas:</strong> ${fmt(data.totalHuellasCuotas)}</p>

${data.ninosPendientes.length > 0 ? `
<h3>⏳ Cuotas pendientes (${data.ninosPendientes.length})</h3>
<ul>${data.ninosPendientes.map(n => `<li>${n.nombres} ${n.apellidos}</li>`).join('')}</ul>` : '<p>✅ ¡Todos los niños al día este mes!</p>'}

${data.atrasadasEsteMes.length > 0 ? `
<h3>📅 Cuotas atrasadas cobradas este mes</h3>
<ul>${data.atrasadasEsteMes.map(p => `<li>${p.nino ? `${p.nino.nombres} ${p.nino.apellidos}` : '—'} — pago de <strong>${p.mes}</strong></li>`).join('')}</ul>` : ''}

${data.ninosAdelantados.length > 0 ? `
<h3>⚡ Cuotas adelantadas registradas</h3>
<ul>${data.ninosAdelantados.map(n => `<li>${n.nombres} ${n.apellidos} — pagó: ${n.mesesAdelantados.join(', ')}</li>`).join('')}</ul>` : ''}

<h3>💸 Gastos del mes</h3>
${data.gastosGeneral.length > 0 || data.gastosHuellas.length > 0
  ? `<ul>
    ${[...data.gastosGeneral, ...data.gastosHuellas].map(g => `<li>${g.descripcion} — ${fmt(g.monto)} (${g.destino})</li>`).join('')}
    </ul>`
  : '<p>Sin gastos registrados este mes.</p>'}

<p><strong>Balance neto del mes:</strong> ${fmt(data.totalRecaudado + data.totalIngresosExtra - data.totalGastosGeneral - data.totalGastosHuellas)}</p>
<p><em>Reporte generado el ${new Date().toLocaleDateString('es-CL')} por ${perfil?.nombre_completo || 'Administración'}</em></p>
    `.trim()

    await supabase.from('comunidad_anuncios').insert([{
      titulo:   `📊 Resumen ${data.mes} ${ANIO_ACTUAL}`,
      contenido: html,
      autor:    perfil?.nombre_completo || 'Administración',
    }])
    setPublicando(false)
    alert(`✅ Resumen publicado en Comunidad como aviso`)
  }

  const fmt     = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })

  return (
    <div className="max-w-5xl">
      {/* Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte Mensual</h1>
          <p className="text-gray-500 text-sm mt-1">Cobranza, gastos y Fondo Huellas por mes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input" value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}>
            {MESES.map(m => (
              <option key={m.num} value={m.num}>{m.label} {ANIO_ACTUAL}</option>
            ))}
          </select>
          <button onClick={exportarPDF} disabled={exportando || loading}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap">
            {exportando ? '⏳...' : '📥 PDF'}
          </button>
          <button onClick={publicarComoAnuncio} disabled={publicando || loading}
            className="btn-primary flex items-center gap-2 whitespace-nowrap">
            {publicando ? '⏳...' : '📢 Publicar en Comunidad'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 text-4xl animate-spin">🌱</div>
      ) : (
        <div ref={reporteRef} className="space-y-5 bg-gray-50 p-2 rounded-2xl">

          {/* Encabezado */}
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

          {/* KPIs Caja General */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">💰 Caja General</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Esperado',    value: fmt(data.totalEsperado),            color: 'text-gray-800', bg: 'bg-white' },
                { label: 'Recaudado',   value: fmt(data.totalRecaudado),           color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Gastos',      value: fmt(data.totalGastosGeneral),       color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Cobranza',    value: `${data.porcentaje}%`,              color: data.porcentaje >= 80 ? 'text-emerald-700' : 'text-amber-600', bg: 'bg-white' },
              ].map(k => (
                <div key={k.label} className={`${k.bg} rounded-2xl border border-gray-100 p-4`}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className={`text-xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* KPIs Fondo Huellas */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">🌟 Fondo Dejando Huellas</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Aporte del mes', value: fmt(data.totalHuellasCuotas), color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'Gastos Huellas', value: fmt(data.totalGastosHuellas), color: 'text-red-600',  bg: 'bg-red-50' },
                { label: 'Balance Huellas',value: fmt(data.totalHuellasCuotas - data.totalGastosHuellas),
                  color: (data.totalHuellasCuotas - data.totalGastosHuellas) >= 0 ? 'text-emerald-700' : 'text-red-600', bg: 'bg-white' },
              ].map(k => (
                <div key={k.label} className={`${k.bg} rounded-2xl border border-gray-100 p-4`}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className={`text-xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Barra de progreso cobranza */}
          <div className="card">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-bold text-gray-700">Progreso de cobranza</p>
              <p className="text-sm font-bold text-gray-500">{data.ninosPagados.length} de {data.ninos.length} niños</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div className={`h-4 rounded-full transition-all duration-500 ${
                data.porcentaje >= 80 ? 'bg-emerald-500' : data.porcentaje >= 50 ? 'bg-amber-400' : 'bg-red-400'
              }`} style={{ width: `${data.porcentaje}%` }} />
            </div>
          </div>

          {/* Notas especiales */}
          {(data.ninosAdelantados.length > 0 || data.atrasadasEsteMes.length > 0) && (
            <div className="space-y-3">
              {data.ninosAdelantados.length > 0 && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">
                    ⚡ {data.ninosAdelantados.length} niño(s) con cuotas adelantadas
                  </p>
                  <div className="space-y-1">
                    {data.ninosAdelantados.map(n => (
                      <p key={n.id} className="text-sm text-purple-800">
                        <strong>{n.nombres} {n.apellidos}</strong> — pagó por adelantado: {n.mesesAdelantados.join(', ')}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {data.atrasadasEsteMes.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
                    📅 {data.atrasadasEsteMes.length} cuota(s) atrasada(s) cobradas este mes
                  </p>
                  <div className="space-y-1">
                    {data.atrasadasEsteMes.map((p, i) => (
                      <p key={i} className="text-sm text-amber-800">
                        <strong>{p.nino ? `${p.nino.nombres} ${p.nino.apellidos}` : '—'}</strong> — pago atrasado de <strong>{p.mes}</strong>
                        {p.fecha_pago && <span className="text-amber-600"> (pagado el {fmtDate(p.fecha_pago)})</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tablas pagados / pendientes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-0">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-emerald-700 text-sm">✓ Al día ({data.ninosPagados.length})</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {data.ninosPagados.length === 0
                  ? <p className="text-center py-6 text-gray-400 text-sm">Sin pagos registrados</p>
                  : data.ninosPagados.map(n => {
                    const p = data.pagosMapa[n.id]
                    const esAdelantado = data.ninosAdelantados.some(a => a.id === n.id)
                    return (
                      <div key={n.id} className="flex items-center justify-between px-5 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{n.nombres} {n.apellidos}</p>
                          <div className="flex items-center gap-2">
                            {p?.fecha_pago && <p className="text-xs text-gray-400">{fmtDate(p.fecha_pago)}</p>}
                            {esAdelantado && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">+meses adelantados</span>}
                            {p?.nota_pago && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{p.nota_pago}</span>}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-700">{fmt(p?.monto_total || data.config?.valor_cuota_total || 4000)}</span>
                      </div>
                    )
                  })
                }
              </div>
            </div>

            <div className="card p-0">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-red-600 text-sm">⏳ Pendientes ({data.ninosPendientes.length})</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {data.ninosPendientes.length === 0
                  ? <p className="text-center py-6 text-gray-400 text-sm">¡Todos al día! 🎉</p>
                  : data.ninosPendientes.map(n => {
                    // Verificar si tiene otros meses adelantados aunque este no esté pagado
                    const tieneAdelantadas = data.ninosAdelantados.some(a => a.id === n.id)
                    return (
                      <div key={n.id} className="flex items-center justify-between px-5 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{n.nombres} {n.apellidos}</p>
                          {tieneAdelantadas && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">tiene meses adelantados</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-red-400">{fmt(data.config?.valor_cuota_total || 4000)}</span>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          </div>

          {/* Gastos del mes */}
          {(data.gastosGeneral.length > 0 || data.gastosHuellas.length > 0) && (
            <div className="card p-0">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm">Gastos del mes</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {[...data.gastosGeneral, ...data.gastosHuellas].map(g => (
                  <div key={g.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{g.descripcion}</p>
                      <p className="text-xs text-gray-400">
                        {g.categorias_gastos?.nombre || '—'} ·{' '}
                        <span className={g.destino === 'Huellas' ? 'text-blue-500' : 'text-brand-600'}>{g.destino}</span>
                        {' · '}{fmtDate(g.fecha)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600 tabular-nums">-{fmt(g.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Balance final */}
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Balance del mes</h3>
            <div className="space-y-2">
              {[
                { label: 'Cuotas recaudadas (General)',  value: data.totalRecaudado - data.totalHuellasCuotas, color: 'text-emerald-700' },
                { label: 'Cuotas recaudadas (Huellas)',  value: data.totalHuellasCuotas,                       color: 'text-blue-700' },
                { label: 'Ingresos extra',               value: data.totalIngresosExtra,                       color: 'text-emerald-600' },
                { label: 'Gastos General',               value: -data.totalGastosGeneral,                      color: 'text-red-600' },
                { label: 'Gastos Huellas',               value: -data.totalGastosHuellas,                      color: 'text-red-500' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{r.label}</span>
                  <span className={`font-bold tabular-nums ${r.color}`}>
                    {r.value >= 0 ? '+' : ''}{fmt(r.value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="font-bold text-gray-900">Balance neto del mes</span>
                <span className={`text-lg font-bold tabular-nums ${
                  data.totalRecaudado + data.totalIngresosExtra - data.totalGastosGeneral - data.totalGastosHuellas >= 0
                    ? 'text-emerald-700' : 'text-red-600'
                }`}>
                  {fmt(data.totalRecaudado + data.totalIngresosExtra - data.totalGastosGeneral - data.totalGastosHuellas)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-gray-400 py-2">
            Jardín Infantil Regacitos · Reporte {data.mes} {ANIO_ACTUAL} · Confidencial
          </div>
        </div>
      )}
    </div>
  )
}