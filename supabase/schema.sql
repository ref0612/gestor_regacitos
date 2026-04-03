-- ============================================================
-- GESTOR REGACITOS — Schema completo de Supabase
-- Ejecutar en el SQL Editor de Supabase, en este orden.
-- ============================================================

-- 1. TABLA: perfiles
-- Vincula el usuario de Auth con su nombre, RUT y rol en el sistema.
CREATE TABLE IF NOT EXISTS public.perfiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo  TEXT NOT NULL,
  rut              TEXT,
  rol              TEXT NOT NULL DEFAULT 'Apoderado'
                   CHECK (rol IN ('Admin','Tesorero','Apoderado')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: ninos
-- Ficha técnica de cada menor inscrito.
CREATE TABLE IF NOT EXISTS public.ninos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            TEXT NOT NULL,
  apellido_paterno  TEXT NOT NULL,
  apellido_materno  TEXT,
  rut               TEXT,
  fecha_nacimiento  DATE,
  seguro_medico     TEXT,
  telefono_contacto TEXT,
  nombre_apoderado  TEXT,
  email_apoderado   TEXT,
  apoderado_id      UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: configuracion
-- Tabla de una sola fila con variables globales del sistema.
CREATE TABLE IF NOT EXISTS public.configuracion (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  valor_cuota     INTEGER NOT NULL DEFAULT 4000,   -- Valor mensual total de la cuota
  monto_huellas   INTEGER NOT NULL DEFAULT 1000,   -- Porción que va al Fondo Dejando Huellas
  CONSTRAINT solo_una_fila CHECK (id = 1)
);

-- Insertar fila inicial de configuración
INSERT INTO public.configuracion (id, valor_cuota, monto_huellas)
VALUES (1, 4000, 1000)
ON CONFLICT (id) DO NOTHING;

-- 4. TABLA: pagos_cuotas
-- Una fila por niño × mes (marzo=3 a diciembre=12).
CREATE TABLE IF NOT EXISTS public.pagos_cuotas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nino_id         UUID NOT NULL REFERENCES public.ninos(id) ON DELETE CASCADE,
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 3 AND 12),
  pagado          BOOLEAN NOT NULL DEFAULT FALSE,
  valor_cuota     INTEGER,    -- Snapshot del valor al momento del pago
  monto_general   INTEGER,    -- Calculado por el trigger splitter
  monto_huellas   INTEGER,    -- Calculado por el trigger splitter
  fecha_pago      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (nino_id, mes)       -- Un registro por niño por mes
);

-- 5. TABLA: categorias_gastos
-- Diccionario de etiquetas para clasificar egresos.
CREATE TABLE IF NOT EXISTS public.categorias_gastos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías predeterminadas
INSERT INTO public.categorias_gastos (nombre) VALUES
  ('Aseo'),
  ('Alimentación'),
  ('Materiales didácticos'),
  ('Eventos'),
  ('Servicios básicos'),
  ('Emergencias')
ON CONFLICT (nombre) DO NOTHING;

-- 6. TABLA: movimientos
-- Libro diario de egresos e ingresos extra (donaciones, rifas, etc.)
CREATE TABLE IF NOT EXISTS public.movimientos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo             TEXT NOT NULL CHECK (tipo IN ('Egreso','Ingreso')),
  monto            INTEGER NOT NULL CHECK (monto > 0),
  descripcion      TEXT NOT NULL,
  categoria_id     UUID REFERENCES public.categorias_gastos(id) ON DELETE SET NULL,
  destino          TEXT NOT NULL DEFAULT 'General' CHECK (destino IN ('General','Huellas')),
  url_comprobante  TEXT,   -- URL pública en Supabase Storage
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORAGE: Bucket para comprobantes de gastos
-- ============================================================
-- Ejecutar esto manualmente en el panel Storage de Supabase
-- o descomentar si tienes acceso programático:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', true)
-- ON CONFLICT (id) DO NOTHING;
