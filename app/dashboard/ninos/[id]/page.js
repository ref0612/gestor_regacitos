'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import CuadernoDiario from '@/app/dashboard/ninos/cuaderno'
import { useParams } from 'next/navigation'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { getChileISO } from '@/lib/date-utils'

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
  const [userId, setUserId] = useState(null)

  const supabase = createClient()
  const MESES_DB = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const MES_ACTUAL = new Date().getMonth() + 1   // 1-12
  const [selectedDate, setSelectedDate] = useState(getChileISO());

  useEffect(() => {
    fetchDatos()
  }, [])

  async function fetchDatos() {
    // 1. Obtener quién está usando el sistema
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
    setPerfil(p)
    setUserId(user?.id)

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
    if (!puedeToggle) return;
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
        centro_salud:  formData.centro_salud,
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

  const puedeEditar  = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero' || perfil?.rol === 'Secretario'
  const puedeToggle  = perfil?.rol === 'Admin' || perfil?.rol === 'Tesorero'
  const esAdmin      = perfil?.rol === 'Admin'

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

      {/* =========================================
          SECCIÓN SUPERIOR: INFO + CUADERNO
      ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: Info del Niño */}
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
                {nino.info_contacto ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700">{nino.info_contacto}</span>
                    <a
                      href={`https://wa.me/${nino.info_contacto.replace(/[^0-9]/g, '').replace(/^56/, '').replace(/^0/, '').replace(/^/, '56')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en WhatsApp"
                      className="flex-shrink-0 w-7 h-7 bg-[#25D366] hover:bg-[#1ebe5d] rounded-full flex items-center justify-center transition-colors shadow-sm"
                    >
                      <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.17 1.535 5.963L0 24l6.23-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.37l-.36-.213-3.7.893.934-3.604-.234-.372A9.818 9.818 0 0112 2.182c5.426 0 9.818 4.392 9.818 9.818 0 5.427-4.392 9.818-9.818 9.818z"/>
                      </svg>
                    </a>
                  </div>
                ) : (
                  <span className="font-bold text-gray-700">No registrado</span>
                )}
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento</span>
                <span className="font-bold text-gray-700">{nino.fecha_nacimiento || 'No registrada'}</span>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase">Seguro Médico / Alergias</span>
                <span className="font-bold text-gray-700">{nino.seguro_medico || 'No registrado'}</span>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase">Centro de Salud</span>
                <span className="font-bold text-gray-700">{nino.centro_salud || 'No registrado'}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* COLUMNA DERECHA: Cuaderno Diario (Siempre al lado de la Info) */}
        <div className="lg:col-span-8">
          <CuadernoDiario
            idNino={params.id}
            nombreNino={nino ? `${nino.nombres} ${nino.apellidos}` : ''}
            perfil={perfil}
            idUsuario={userId}
          />
        </div>

      </div> {/* Fin del Grid Superior */}

      {/* =========================================
          SECCIÓN INFERIOR: CUOTAS (Oculto para Educadores)
      ========================================== */}
      {perfil?.rol !== 'Educador' && (
        <div className="mt-8 bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm border border-gray-100">
          
          {/* Header Responsivo */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="font-black text-gray-800 flex items-start sm:items-center gap-2 text-xs sm:text-sm uppercase tracking-wide leading-tight">
              <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse mt-1 sm:mt-0 flex-shrink-0" /> 
              <span>Control de <br className="sm:hidden" /> Mensualidades {new Date().getFullYear()}</span>
            </h3>
            <span className="px-3 py-1.5 bg-brand-50 text-brand-700 text-[10px] font-black rounded-full uppercase self-start sm:self-auto">
              {pagos.length === 10 ? 'AL DÍA 🏆' : 'PENDIENTE'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 sm:gap-y-2">
            {MESES_DB.map((mes, idx) => {  // idx 0=Marzo, 1=Abril...
              const pagoRealizado = pagos.find(p => p.mes === mes);
              const estaPagado = !!pagoRealizado;

              return (
                <div key={mes} className="py-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-gray-50/50 transition-colors">
                  
                  {/* Info del Mes */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shadow-sm border ${
                      estaPagado ? 'bg-brand-500 text-white border-brand-500' : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}>
                      {estaPagado ? '✓' : idx + 3}
                    </div>
                    <div>
                      <p className={`text-sm sm:text-base font-black leading-none mb-1.5 ${estaPagado ? 'text-gray-900' : 'text-gray-400'}`}>{mes}</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase leading-none">Mensualidad regular</p>
                    </div>
                  </div>

                  {/* Botones de Acción (Ocupan todo el ancho en móvil) */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {estaPagado ? (
                      <button 
                        onClick={() => setVoucherView({ nino, pago: pagoRealizado })}
                        className="flex-1 sm:flex-none text-[10px] bg-luna-50 text-luna-600 hover:bg-luna-100 font-black px-3 py-2.5 rounded-xl uppercase transition-colors flex items-center justify-center gap-1 border border-luna-100"
                      >
                        🧾 Voucher
                      </button>
                    ) : (
                      <span className="flex-1 sm:flex-none text-[10px] text-gray-400 bg-gray-50 font-black px-3 py-2.5 rounded-xl uppercase text-center border border-gray-100">
                        Sin registrar
                      </span>
                    )}

                    {puedeToggle && (
                      <button 
                        onClick={() => togglePago(mes, idx)}
                        className={`flex-1 sm:flex-none text-[10px] font-black px-3 py-2.5 rounded-xl uppercase transition-all shadow-sm border ${
                          estaPagado 
                            ? 'bg-white text-red-500 border-red-100 hover:bg-red-50' 
                            : 'bg-accent-500 text-white border-accent-600 hover:bg-accent-600'
                        }`}
                      >
                        {estaPagado ? 'Revertir' : 'Registrar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================
          MODAL DE EDICIÓN 
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

              {/* Drop List para Apoderado */}
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

              {/* Input de Teléfono */}
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
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Centro de Salud</label>
                  <input type="text" value={formData.centro_salud || ''} onChange={e => setFormData({...formData, centro_salud: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Ej: CESFAM Lo Barnechea, Clínica Alemana" />
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