-- ============================================================
-- GESTOR REGACITOS — Adaptación al schema existente
-- Solo ejecuta esto (NO borres tus tablas)
-- ============================================================

-- 1. Agregar restricción UNIQUE a pagos_cuotas para que el UPSERT funcione
--    (necesita identificar un registro por niño + mes + año)
ALTER TABLE public.pagos_cuotas
  DROP CONSTRAINT IF EXISTS pagos_cuotas_id_nino_mes_anio_key;

ALTER TABLE public.pagos_cuotas
  ADD CONSTRAINT pagos_cuotas_id_nino_mes_anio_key
  UNIQUE (id_nino, mes, anio);

-- 2. Asegurar que configuracion tenga una fila inicial
INSERT INTO public.configuracion (id, valor_cuota_total, monto_dejando_huellas, anio_actual)
VALUES (1, 4000, 1000, 2025)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TRIGGER SPLITTER — Adaptado a tu schema
-- Divide la cuota automáticamente al marcar como pagada
-- ============================================================

CREATE OR REPLACE FUNCTION public.split_cuota_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valor_cuota_total     NUMERIC;
  v_monto_dejando_huellas NUMERIC;
BEGIN
  -- Cuando pagado cambia false → true
  IF NEW.pagado = TRUE AND (OLD.pagado = FALSE OR OLD.pagado IS NULL) THEN
    SELECT valor_cuota_total, monto_dejando_huellas
      INTO v_valor_cuota_total, v_monto_dejando_huellas
      FROM public.configuracion
      LIMIT 1;

    NEW.monto_total   := v_valor_cuota_total;
    NEW.monto_huellas := v_monto_dejando_huellas;
    NEW.monto_general := v_valor_cuota_total - v_monto_dejando_huellas;
    NEW.fecha_pago    := NOW();

  -- Cuando pagado cambia true → false (reversión)
  ELSIF NEW.pagado = FALSE AND OLD.pagado = TRUE THEN
    NEW.monto_total   := NULL;
    NEW.monto_huellas := NULL;
    NEW.monto_general := NULL;
    NEW.fecha_pago    := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Asignar trigger (UPDATE)
DROP TRIGGER IF EXISTS trigger_split_cuota ON public.pagos_cuotas;
CREATE TRIGGER trigger_split_cuota
  BEFORE UPDATE ON public.pagos_cuotas
  FOR EACH ROW
  EXECUTE FUNCTION public.split_cuota_payment();

-- Asignar trigger (INSERT — para upsert que inserta en pagado=true directo)
DROP TRIGGER IF EXISTS trigger_split_cuota_insert ON public.pagos_cuotas;
CREATE TRIGGER trigger_split_cuota_insert
  BEFORE INSERT ON public.pagos_cuotas
  FOR EACH ROW
  EXECUTE FUNCTION public.split_cuota_payment();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.perfiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ninos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cuotas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos       ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores si existen
DROP POLICY IF EXISTS "perfiles_select"   ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_insert"   ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_update"   ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_delete"   ON public.perfiles;
DROP POLICY IF EXISTS "ninos_select"      ON public.ninos;
DROP POLICY IF EXISTS "ninos_insert"      ON public.ninos;
DROP POLICY IF EXISTS "ninos_update"      ON public.ninos;
DROP POLICY IF EXISTS "ninos_delete"      ON public.ninos;
DROP POLICY IF EXISTS "config_select"     ON public.configuracion;
DROP POLICY IF EXISTS "config_upsert"     ON public.configuracion;
DROP POLICY IF EXISTS "cuotas_select"     ON public.pagos_cuotas;
DROP POLICY IF EXISTS "cuotas_write"      ON public.pagos_cuotas;
DROP POLICY IF EXISTS "cats_select"       ON public.categorias_gastos;
DROP POLICY IF EXISTS "cats_write"        ON public.categorias_gastos;
DROP POLICY IF EXISTS "movimientos_select" ON public.movimientos;
DROP POLICY IF EXISTS "movimientos_write"  ON public.movimientos;

-- PERFILES
CREATE POLICY "perfiles_select" ON public.perfiles FOR SELECT USING (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero'))
);
CREATE POLICY "perfiles_insert" ON public.perfiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'Admin')
);
CREATE POLICY "perfiles_update" ON public.perfiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'Admin')
);
CREATE POLICY "perfiles_delete" ON public.perfiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'Admin')
);

-- NIÑOS
CREATE POLICY "ninos_select" ON public.ninos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid()
    AND (p.rol IN ('Admin','Tesorero') OR ninos.id_apoderado = auth.uid())
  )
);
CREATE POLICY "ninos_insert" ON public.ninos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero'))
);
CREATE POLICY "ninos_update" ON public.ninos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero'))
);
CREATE POLICY "ninos_delete" ON public.ninos FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'Admin')
);

-- CONFIGURACIÓN
CREATE POLICY "config_select" ON public.configuracion FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "config_upsert" ON public.configuracion FOR ALL USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'Admin')
);

-- PAGOS CUOTAS
CREATE POLICY "cuotas_select" ON public.pagos_cuotas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero'))
  OR EXISTS (SELECT 1 FROM public.ninos n WHERE n.id = pagos_cuotas.id_nino AND n.id_apoderado = auth.uid())
);
CREATE POLICY "cuotas_write" ON public.pagos_cuotas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero'))
);

-- CATEGORÍAS
CREATE POLICY "cats_select"  ON public.categorias_gastos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "cats_write"   ON public.categorias_gastos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'Admin')
);

-- MOVIMIENTOS
CREATE POLICY "movimientos_select" ON public.movimientos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "movimientos_write"  ON public.movimientos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('Admin','Tesorero'))
);
