-- ============================================================
-- GESTOR REGACITOS — Triggers, Funciones y Políticas RLS
-- Ejecutar DESPUÉS de schema.sql
-- ============================================================

-- ============================================================
-- TRIGGER: "Splitter" Contable
-- Al marcar una cuota como pagada, divide automáticamente
-- el monto entre Caja General y Fondo Dejando Huellas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.split_cuota_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valor_cuota   INTEGER;
  v_monto_huellas INTEGER;
BEGIN
  -- Solo actuar cuando pagado cambia de false → true
  IF NEW.pagado = TRUE AND (OLD.pagado = FALSE OR OLD.pagado IS NULL) THEN
    -- Leer configuración actual
    SELECT valor_cuota, monto_huellas
      INTO v_valor_cuota, v_monto_huellas
      FROM public.configuracion
      LIMIT 1;

    -- Asignar snapshot y calcular split
    NEW.valor_cuota   := v_valor_cuota;
    NEW.monto_huellas := v_monto_huellas;
    NEW.monto_general := v_valor_cuota - v_monto_huellas;
    NEW.fecha_pago    := NOW();

  -- Si se revierte el pago (true → false), limpiar los montos
  ELSIF NEW.pagado = FALSE AND OLD.pagado = TRUE THEN
    NEW.valor_cuota   := NULL;
    NEW.monto_huellas := NULL;
    NEW.monto_general := NULL;
    NEW.fecha_pago    := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Asignar el trigger a la tabla
DROP TRIGGER IF EXISTS trigger_split_cuota ON public.pagos_cuotas;
CREATE TRIGGER trigger_split_cuota
  BEFORE UPDATE ON public.pagos_cuotas
  FOR EACH ROW
  EXECUTE FUNCTION public.split_cuota_payment();

-- También disparar en INSERT (para el caso de upsert que crea en pagado=true)
DROP TRIGGER IF EXISTS trigger_split_cuota_insert ON public.pagos_cuotas;
CREATE TRIGGER trigger_split_cuota_insert
  BEFORE INSERT ON public.pagos_cuotas
  FOR EACH ROW
  EXECUTE FUNCTION public.split_cuota_payment();


-- ============================================================
-- TRIGGER: Auto-crear perfil al registrar usuario en Auth
-- (Opcional pero útil para no dejar usuarios sin perfil)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo insertar si no existe ya un perfil (creado manualmente con rol específico)
  INSERT INTO public.perfiles (id, nombre_completo, rol)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email), 'Apoderado')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- RLS (Row Level Security) — Seguridad por fila
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.perfiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ninos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cuotas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos       ENABLE ROW LEVEL SECURITY;


-- ── PERFILES ────────────────────────────────────────────────
-- Cada usuario lee su propio perfil.
-- Admin y Tesorero leen todos los perfiles.
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero')
    )
  );

CREATE POLICY "perfiles_insert" ON public.perfiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'Admin'
    )
  );

CREATE POLICY "perfiles_update" ON public.perfiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'Admin'
    )
  );

CREATE POLICY "perfiles_delete" ON public.perfiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'Admin'
    )
  );


-- ── NIÑOS ───────────────────────────────────────────────────
-- Admin/Tesorero: acceso total.
-- Apoderado: solo ve el niño vinculado a su cuenta.
CREATE POLICY "ninos_select" ON public.ninos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND (p.rol IN ('Admin','Tesorero') OR ninos.apoderado_id = auth.uid())
    )
  );

CREATE POLICY "ninos_insert" ON public.ninos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero')
    )
  );

CREATE POLICY "ninos_update" ON public.ninos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero')
    )
  );

CREATE POLICY "ninos_delete" ON public.ninos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'Admin'
    )
  );


-- ── CONFIGURACIÓN ────────────────────────────────────────────
-- Todos pueden leer (para mostrar el valor de la cuota al Apoderado).
-- Solo Admin puede modificar.
CREATE POLICY "config_select" ON public.configuracion
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "config_upsert" ON public.configuracion
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'Admin'
    )
  );


-- ── PAGOS_CUOTAS ─────────────────────────────────────────────
-- Admin/Tesorero: acceso total.
-- Apoderado: solo ve las cuotas del niño vinculado.
CREATE POLICY "cuotas_select" ON public.pagos_cuotas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero')
    )
    OR EXISTS (
      SELECT 1 FROM public.ninos n
      WHERE n.id = pagos_cuotas.nino_id AND n.apoderado_id = auth.uid()
    )
  );

CREATE POLICY "cuotas_write" ON public.pagos_cuotas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero')
    )
  );


-- ── CATEGORÍAS ───────────────────────────────────────────────
-- Todos autenticados leen. Solo Admin escribe.
CREATE POLICY "cats_select" ON public.categorias_gastos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "cats_write" ON public.categorias_gastos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'Admin'
    )
  );


-- ── MOVIMIENTOS ──────────────────────────────────────────────
-- Admin/Tesorero: acceso total.
-- Apoderado: solo lectura (para transparencia del Fondo Huellas).
CREATE POLICY "movimientos_select" ON public.movimientos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "movimientos_write" ON public.movimientos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero')
    )
  );


-- ============================================================
-- STORAGE POLICY: bucket "comprobantes"
-- ============================================================
-- Crear el bucket primero en el panel Storage de Supabase (público).
-- Luego ejecutar:

-- INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes','comprobantes', true)
-- ON CONFLICT DO NOTHING;

CREATE POLICY "comprobantes_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'comprobantes'
    AND EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero')
    )
  );

CREATE POLICY "comprobantes_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'comprobantes');
