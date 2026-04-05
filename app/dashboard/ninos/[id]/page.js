'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function NinoDetailPage() {
  const params = useParams()
  const [nino, setNino] = useState(null)
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const [voucherView, setVoucherView] = useState(null)
  
  // --- ESTADOS PARA APODERADOS Y EDICIÓN ---
  const [listaApoderados, setListaApoderados] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [guardando, setGuardando] = useState(false)

  const supabase = createClient()
  const MESES_DB = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const MES_ACTUAL = new Date().getMonth() + 1   // 1-12

  useEffect(() => {
    fetchDatos()
  }, [])

  async function fetchDatos() {
    // 1. Obtener quién está usando el sistema
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
    setPerfil(p)

    // 2. Obtener la lista de TODOS los apoderados para el Drop List
    const { data: apoderados } = await supabase.from('perfiles').select('id, nombre_completo').eq('rol', 'Apoderado')
    setListaApoderados(apoderados || [])

    // 3. Obtener los datos del niño
    const { data: n } = await supabase.from('ninos').select('*').eq('id', params.id).single()
    setNino(n)
    setFormData(n)

    // 4. Obtener pagos
    const { data: pg } = await supabase.from('pagos_cuotas').select('*').eq('id_nino', params.id)
    setPagos(pg || [])
    
    setLoading(false)
  }

  async function togglePago(mesNombre, mesIdx) {
    if (!puedeEditar) return;
    const mesNum = mesIdx + 3   // Marzo=3, Abril=4, ...
    const pagoExistente = pagos.find(p => p.mes === mesNombre);
    if (pagoExistente) {
      await supabase.from('pagos_cuotas').delete().match({ id_nino: nino.id, mes: mesNombre, anio: new Date().getFullYear() });
    } else {
      // Detectar si es cuota atrasada, al día o adelantada
      let nota_pago = null
      if (mesNum < MES_ACTUAL)      nota_pago = 'Cuota atrasada'
      else if (mesNum > MES_ACTUAL) nota_pago = 'Cuota adelantada'
      await supabase.from('pagos_cuotas').insert({
        id_nino: nino.id, mes: mesNombre, anio: new Date().getFullYear(), pagado: true,
        fecha_pago: new Date().toISOString(),
        recibido_por: perfil?.nombre_completo || 'Administración',
        nota_pago,
      });
    }
    fetchDatos();
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault()
    setGuardando(true)
    
    const { error } = await supabase
      .from('ninos')
      .update({
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        rut: formData.rut,
        genero: formData.genero,
        fecha_nacimiento: formData.fecha_nacimiento,
        seguro_medico: formData.seguro_medico,
        info_contacto: formData.info_contacto, // Ahora usado para el Teléfono
        id_apoderado: formData.id_apoderado // Guardando la relación correcta
      })
      .eq('id', nino.id)

    if (!error) {
      setNino(formData)
      setIsEditing(false)
    } else {
      alert("Error al actualizar: " + error.message)
    }
    setGuardando(false)
  }

  const puedeEditar = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero'
  const esAdmin = perfil?.rol === 'Admin'

  // Buscar el nombre del apoderado actual para mostrarlo en la ficha
  const nombreApoderadoActual = listaApoderados.find(a => a.id === nino?.id_apoderado)?.nombre_completo || 'No asignado'

  if (loading) return <div className="min-h-screen flex items-center justify-center animate-pulse text-brand-500 font-bold">Cargando expediente...</div>
  if (!nino) return <div className="p-10 text-center">Expediente no encontrado</div>

  const porcentajePagado = (pagos.length / 10) * 100;

  return (
    <div className="max-w-6xl mx-auto pb-20 px-4 pt-6">
      
      <Link href="/dashboard/ninos" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-600 font-bold text-sm mb-6 transition-colors">
        <span className="text-lg">←</span> Volver al directorio
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* =========================================
            COLUMNA IZQUIERDA
        ========================================== */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-brand-50"></div>
            
            <div className="relative z-10">
              <div className="w-24 h-24 bg-white text-brand-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4 shadow-md border-4 border-white">
                {nino.nombres?.charAt(0) || ''}{nino.apellidos?.charAt(0) || ''}
              </div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">
                {nino.nombres} <br/><span className="text-brand-600">{nino.apellidos}</span>
              </h1>
              <p className="text-gray-400 font-bold text-xs mt-2 uppercase tracking-widest">
                RUT: {nino.rut || 'Pendiente'} • {nino.genero === 'Niña' ? 'Niña 👧' : 'Niño 👦'}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50 text-left">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Progreso de Cuotas</span>
                <span className="text-sm font-black text-brand-600">{pagos.length}/10</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-brand-500 h-3 rounded-full transition-all duration-500" style={{ width: `${porcentajePagado}%` }}></div>
              </div>
            </div>

            {esAdmin && (
              <div className="flex gap-2 mt-6 pt-6 border-t border-gray-50">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs transition-colors border border-gray-200"
                >
                  ✏️ Editar
                </button>
                <button className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors border border-red-100">
                  Desactivar
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-800 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
              📋 Expediente
            </h3>
            <ul className="space-y-4">
              <li className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase">Apoderado</span>
                <span className="font-bold text-gray-900">{nombreApoderadoActual}</span>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase">Teléfono / Contacto</span>
                <span className="font-bold text-gray-700">{nino.info_contacto || 'No registrado'}</span>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento</span>
                <span className="font-bold text-gray-700">{nino.fecha_nacimiento || 'No registrada'}</span>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase">Seguro Médico / Alergias</span>
                <span className="font-bold text-gray-700">{nino.seguro_medico || 'No registrado'}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* =========================================
            COLUMNA DERECHA
        ========================================== */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse" /> 
                Control de Mensualidades ${new Date().getFullYear()}
              </h3>
              <span className="px-3 py-1 bg-brand-50 text-brand-700 text-[10px] font-black rounded-full uppercase">
                {pagos.length === 10 ? 'AL DÍA 🏆' : 'PENDIENTE'}
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {MESES_DB.map((mes, idx) => {  // idx 0=Marzo, 1=Abril...
                const pagoRealizado = pagos.find(p => p.mes === mes);
                const estaPagado = !!pagoRealizado;

                return (
                  <div key={mes} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors rounded-xl px-2">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border ${
                        estaPagado ? 'bg-brand-500 text-white border-brand-500' : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        {estaPagado ? '✓' : idx + 3}
                      </div>
                      <div>
                        <p className={`font-black ${estaPagado ? 'text-gray-900' : 'text-gray-400'}`}>{mes}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Mensualidad regular</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto ml-16 sm:ml-0">
                      {estaPagado ? (
                        <button 
                          onClick={() => setVoucherView({ nino, pago: pagoRealizado })}
                          className="flex-1 sm:flex-none text-[10px] bg-luna-50 text-luna-600 hover:bg-luna-100 font-black px-4 py-2 rounded-xl uppercase transition-colors flex items-center justify-center gap-1 border border-luna-100"
                        >
                          🧾 Voucher
                        </button>
                      ) : (
                        <span className="flex-1 sm:flex-none text-[10px] text-gray-300 font-black px-4 py-2 uppercase text-center">
                          Sin registrar
                        </span>
                      )}

                      {puedeEditar && (
                        <button 
                          onClick={() => togglePago(mes, idx)}
                          className={`flex-1 sm:flex-none text-[10px] font-black px-6 py-2 rounded-xl uppercase transition-all shadow-sm border ${
                            estaPagado 
                              ? 'bg-white text-red-500 border-red-100 hover:bg-red-50' 
                              : 'bg-accent-500 text-white border-accent-600 hover:bg-accent-600'
                          }`}
                        >
                          {estaPagado ? 'Revertir' : 'Registrar Pago'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          MODAL DE EDICIÓN (CORREGIDO)
      ========================================== */}
      {isEditing && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden my-8">
            <div className="bg-brand-50 p-6 border-b border-brand-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-brand-800">Editar Expediente</h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 font-black text-xl">✕</button>
            </div>
            
            <form onSubmit={handleGuardarEdicion} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nombres</label>
                  <input type="text" required value={formData.nombres || ''} onChange={e => setFormData({...formData, nombres: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Apellidos</label>
                  <input type="text" required value={formData.apellidos || ''} onChange={e => setFormData({...formData, apellidos: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">RUT</label>
                  <input type="text" value={formData.rut || ''} onChange={e => setFormData({...formData, rut: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="12.345.678-9" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Género</label>
                  <select value={formData.genero || ''} onChange={e => setFormData({...formData, genero: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">Seleccionar</option>
                    <option value="Niña">Niña 👧</option>
                    <option value="Niño">Niño 👦</option>
                  </select>
                </div>
              </div>

              {/* NUEVO: Drop List para Apoderado */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Apoderado Asignado</label>
                <select 
                  required
                  value={formData.id_apoderado || ''} 
                  onChange={e => setFormData({...formData, id_apoderado: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">Seleccionar apoderado...</option>
                  {listaApoderados.map(apod => (
                    <option key={apod.id} value={apod.id}>{apod.nombre_completo}</option>
                  ))}
                </select>
              </div>

              {/* REEMPLAZO: Input de Teléfono en lugar de textarea */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Teléfono de Contacto</label>
                <input 
                  type="tel" 
                  value={formData.info_contacto || ''} 
                  onChange={e => setFormData({...formData, info_contacto: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
                  placeholder="+56 9 1234 5678" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">F. Nacimiento</label>
                  <input type="date" value={formData.fecha_nacimiento || ''} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Seguro / Alergias</label>
                  <input type="text" value={formData.seguro_medico || ''} onChange={e => setFormData({...formData, seguro_medico: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Ej: Fonasa" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-xl transition-all disabled:opacity-50 shadow-md shadow-brand-500/30">
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

// ==========================================
// COMPONENTE: VOUCHER MODAL
// ==========================================
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