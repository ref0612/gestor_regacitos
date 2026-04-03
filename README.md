# 🌱 Gestor Regacitos

Sistema de gestión financiera y de pagos para jardín infantil.

## Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Deploy**: Vercel

---

## 🚀 Setup inicial

### 1. Instalar
```bash
npm install
```

### 2. Variables de entorno
Edita `.env.local` con tus datos de Supabase (Project Settings → API):
```
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
```

### 3. Base de datos
En el SQL Editor de Supabase, ejecutar en orden:
1. `supabase/schema.sql` — Crea las tablas
2. `supabase/triggers_rls.sql` — Trigger Splitter contable + políticas RLS

### 4. Storage
En el panel Storage de Supabase: crear bucket `comprobantes` (público).

### 5. Dev
```bash
npm run dev
```

### 6. Primer Admin
Crea un usuario en Supabase Auth y luego actualiza su rol:
```sql
UPDATE public.perfiles SET rol = 'Admin' WHERE id = 'UUID_DEL_USUARIO';
```

---

## 📁 Estructura
```
app/
├── page.js                          # Login
├── dashboard/
│   ├── layout.js                    # Sidebar de navegación
│   ├── page.js                      # Resumen financiero
│   ├── ninos/
│   │   ├── page.js                  # Lista + importar Excel
│   │   └── [id]/page.js             # Ficha individual + grilla pagos
│   ├── gastos/page.js               # Registro de gastos/ingresos
│   └── admin/
│       ├── page.js                  # Gestión de usuarios
│       └── configuracion/page.js   # Cuota + categorías
lib/
├── supabase.js                      # Cliente browser
└── supabaseServer.js               # Cliente server (SSR)
middleware.js                        # Protección de rutas por rol
supabase/
├── schema.sql                       # Tablas
└── triggers_rls.sql                 # Trigger Splitter + RLS
```

---

## 🔑 Roles
| Rol | Acceso |
|-----|--------|
| **Admin** | Control total: usuarios, configuración, todo |
| **Tesorero** | Registra pagos, cuotas y gastos |
| **Apoderado** | Solo ve la ficha de su hijo |

## 📊 Trigger Splitter
Al marcar una cuota como pagada, divide automáticamente:
```
$4.000 cuota → $3.000 Caja General + $1.000 Fondo Huellas
```

## 📂 Formato Excel para importar niños
Columnas requeridas: `nombre, apellido_paterno, apellido_materno, rut, fecha_nacimiento, seguro_medico, telefono_contacto, nombre_apoderado, email_apoderado`
