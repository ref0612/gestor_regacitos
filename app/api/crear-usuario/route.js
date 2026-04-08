import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { email, password, nombre_completo, rut, rol } = await request.json()

    // 🚨 IMPORTANTE: Usamos la SERVICE_ROLE_KEY, NO la anon key pública.
    // Esto nos da poder de Admin para crear usuarios sin alterar sesiones.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    )

    // 1. Crear el usuario en el sistema de Auth de Supabase
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Evita que envíe correo de confirmación si no lo necesitas
    })

    if (authErr) throw authErr

    // 2. Insertar los datos en tu tabla pública 'perfiles'
    const { error: perfilErr } = await supabaseAdmin.from('perfiles').insert([{
      id: authData.user.id,
      nombre_completo,
      rut,
      rol,
      email,
      creado_at: new Date().toISOString(),
    }])

    if (perfilErr) throw perfilErr

    return NextResponse.json({ success: true })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}