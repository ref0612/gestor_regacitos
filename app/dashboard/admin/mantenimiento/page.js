"use client"

import { createClient } from '@/lib/supabase'
import { useState } from 'react'

export default function PanelCierreAnual() {
  const [procesando, setProcesando] = useState(false)
  const supabase = createClient()

  // --- PASO 1: RESPALDO ---
  const descargarRespaldo = async () => {
    const tablas = ['ninos', 'perfiles', 'movimientos', 'pagos_cuotas', 'cuaderno_diario']
    const backupTotal = {}

    for (const tabla of tablas) {
      const { data } = await supabase.from(tabla).select('*')
      backupTotal[tabla] = data
    }

    // Crear archivo JSON y descargarlo
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupTotal))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", `respaldo_regacitos_${new Date().getFullYear()}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  // --- PASO 2: EJECUTAR CIERRE ---
  const ejecutarCierre = async () => {
    const confirmar = confirm("¡ATENCIÓN! Esto borrará el historial diario y de pagos. ¿Ya descargaste el respaldo?")
    if (!confirmar) return

    setProcesando(true)
    // Llamamos a la función SQL que creamos arriba
    const { data, error } = await supabase.rpc('cierre_anual_regacitos')
    
    if (error) {
      alert("Error: " + error.message)
    } else {
      alert("¡Cierre exitoso! Saldo traspasado a Huellas: " + data.nuevo_total_huellas)
      // Opcional: Vaciar el Storage manualmente si quieres
      console.log("Resumen contable:", data)
    }
    setProcesando(false)
  }

  return (
    <div className="bg-white rounded-3xl p-8 border border-red-100 shadow-sm space-y-6">
      <h2 className="text-xl font-black text-red-600">Mantenimiento de Fin de Año</h2>
      
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
        <p className="text-sm text-amber-800 font-bold">
          ⚠️ Este proceso sumará el dinero de Caja General al Fondo Huellas, limpiará el libro diario y los pagos para el próximo año.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={descargarRespaldo}
          className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl transition-all"
        >
          1. Descargar Respaldo Completo 📥
        </button>

        <button 
          onClick={ejecutarCierre}
          disabled={procesando}
          className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-200 transition-all disabled:opacity-50"
        >
          {procesando ? 'Procesando...' : '2. Ejecutar Cierre Anual 🚀'}
        </button>
      </div>
    </div>
  )
}