import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Rutas protegidas por rol — si no tienes el rol, te redirige a tu página de inicio
const RUTAS_PERMITIDAS = {
  '/dashboard':                     ['Admin','Tesorero','Secretario','Apoderado'],
  '/dashboard/gastos':              ['Admin','Tesorero'],
  '/dashboard/resumen':             ['Admin','Tesorero','Secretario'],
  '/dashboard/admin':               ['Admin','Secretario'],
  '/dashboard/admin/configuracion': ['Admin'],
  // Niños y Comunidad: todos los roles autenticados
  '/dashboard/ninos':               ['Admin','Tesorero','Secretario','Educador','Apoderado'],
  '/dashboard/comunidad':           ['Admin','Tesorero','Secretario','Educador','Apoderado'],
}

// Página de inicio según rol
function destinoPorRol(rol) {
  if (rol === 'Educador' || rol === 'Apoderado') return '/dashboard/ninos'
  return '/dashboard'
}

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Sin sesión intentando entrar al dashboard → login
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Con sesión en la raíz → redirigir según rol
  if (user && pathname === '/') {
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    return NextResponse.redirect(new URL(destinoPorRol(perfil?.rol), request.url))
  }

  // Con sesión dentro del dashboard → verificar permisos por ruta
  if (user && pathname.startsWith('/dashboard')) {
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    const rol = perfil?.rol

    // Buscar la ruta más específica que coincida
    const rutaCoincidente = Object.keys(RUTAS_PERMITIDAS)
      .filter(ruta => pathname === ruta || pathname.startsWith(ruta + '/'))
      .sort((a, b) => b.length - a.length)[0]  // la más larga (más específica) primero

    if (rutaCoincidente) {
      const rolesPermitidos = RUTAS_PERMITIDAS[rutaCoincidente]
      if (!rolesPermitidos.includes(rol)) {
        // No autorizado → redirigir a su página de inicio
        return NextResponse.redirect(new URL(destinoPorRol(rol), request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}