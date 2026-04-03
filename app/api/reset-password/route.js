import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Cliente con permisos de administrador (solo servidor)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { userId, nuevaPassword } = await request.json()

    if (!userId || !nuevaPassword || nuevaPassword.length < 6) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: nuevaPassword,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
