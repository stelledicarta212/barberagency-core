-- Migration: 20261001_1000_smart_off_peak_discounts.sql
-- Description: Smart Off-Peak Discounts ("Tiempos Muertos") multi-tenant engine, immutable snapshots, and slot enrichment.

BEGIN;

-- 1. Table for tenant off-peak discount rules
CREATE TABLE IF NOT EXISTS public.barberia_off_peak_rules (
  id BIGSERIAL PRIMARY KEY,
  barberia_id BIGINT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  nombre VARCHAR(100),
  dias_semana INTEGER[] NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  descuento_porcentaje INTEGER NOT NULL CHECK (descuento_porcentaje >= 1 AND descuento_porcentaje < 100),
  aplica_todos_servicios BOOLEAN NOT NULL DEFAULT true,
  servicios_ids INTEGER[] DEFAULT NULL,
  aplica_todos_barberos BOOLEAN NOT NULL DEFAULT true,
  barberos_ids INTEGER[] DEFAULT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT chk_horas_validas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_off_peak_barberia_activo 
ON public.barberia_off_peak_rules(barberia_id, activo);

-- 2. Snapshot columns in public.citas
ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS precio_base NUMERIC(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS descuento_porcentaje INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_valor NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_final NUMERIC(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promocion_id BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promocion_snapshot JSONB DEFAULT NULL;

-- 3. Pricing calculation function (ba_calcular_precio_cita)
CREATE OR REPLACE FUNCTION public.ba_calcular_precio_cita(
  p_barberia_id BIGINT,
  p_servicio_id BIGINT,
  p_barbero_id BIGINT,
  p_fecha DATE,
  p_hora TIME
)
RETURNS TABLE (
  precio_base NUMERIC(12, 2),
  descuento_porcentaje INTEGER,
  descuento_valor NUMERIC(12, 2),
  precio_final NUMERIC(12, 2),
  tiene_descuento BOOLEAN,
  promocion_id BIGINT,
  promocion_nombre VARCHAR(100),
  promocion_snapshot JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_precio_base NUMERIC(12, 2) := 0;
  v_dow INTEGER;
  v_rule RECORD;
  v_desc_val NUMERIC(12, 2) := 0;
  v_precio_final NUMERIC(12, 2) := 0;
BEGIN
  -- Obtain canonical base price from servicios
  SELECT COALESCE(s.precio, 0)
    INTO v_precio_base
    FROM public.servicios s
   WHERE s.id = p_servicio_id
     AND s.barberia_id = p_barberia_id;

  IF NOT FOUND OR v_precio_base <= 0 THEN
    precio_base := COALESCE(v_precio_base, 0);
    descuento_porcentaje := 0;
    descuento_valor := 0;
    precio_final := COALESCE(v_precio_base, 0);
    tiene_descuento := FALSE;
    promocion_id := NULL;
    promocion_nombre := NULL;
    promocion_snapshot := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 0=Domingo, 1=Lunes, ..., 6=Sábado
  v_dow := EXTRACT(DOW FROM p_fecha)::INTEGER;

  -- Semi-open interval: [hora_inicio, hora_fin)
  -- Inclusive on lower bound, exclusive on upper bound.
  -- Overlap resolution: highest discount wins; tie-breaker: id ASC.
  SELECT r.id, r.nombre, r.descuento_porcentaje, r.hora_inicio, r.hora_fin, r.dias_semana
    INTO v_rule
    FROM public.barberia_off_peak_rules r
   WHERE r.barberia_id = p_barberia_id
     AND r.activo = TRUE
     AND v_dow = ANY(r.dias_semana)
     AND p_hora >= r.hora_inicio
     AND p_hora < r.hora_fin
     AND (r.aplica_todos_servicios = TRUE OR (r.servicios_ids IS NOT NULL AND p_servicio_id = ANY(r.servicios_ids)))
     AND (r.aplica_todos_barberos = TRUE OR p_barbero_id IS NULL OR (r.barberos_ids IS NOT NULL AND p_barbero_id = ANY(r.barberos_ids)))
   ORDER BY r.descuento_porcentaje DESC, r.id ASC
   LIMIT 1;

  IF FOUND AND v_rule.id IS NOT NULL THEN
    v_desc_val := ROUND((v_precio_base * v_rule.descuento_porcentaje) / 100.0, 2);
    v_precio_final := GREATEST(0, v_precio_base - v_desc_val);

    precio_base := v_precio_base;
    descuento_porcentaje := v_rule.descuento_porcentaje;
    descuento_valor := v_desc_val;
    precio_final := v_precio_final;
    tiene_descuento := TRUE;
    promocion_id := v_rule.id;
    promocion_nombre := v_rule.nombre;
    promocion_snapshot := jsonb_build_object(
      'id', v_rule.id,
      'nombre', v_rule.nombre,
      'descuento_porcentaje', v_rule.descuento_porcentaje,
      'descuento_valor', v_desc_val,
      'hora_inicio', v_rule.hora_inicio::TEXT,
      'hora_fin', v_rule.hora_fin::TEXT,
      'dias_semana', v_rule.dias_semana
    );
    RETURN NEXT;
  ELSE
    precio_base := v_precio_base;
    descuento_porcentaje := 0;
    descuento_valor := 0;
    precio_final := v_precio_base;
    tiene_descuento := FALSE;
    promocion_id := NULL;
    promocion_nombre := NULL;
    promocion_snapshot := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

-- 4. Permissions
GRANT ALL ON TABLE public.barberia_off_peak_rules TO authenticated, service_role;
GRANT SELECT ON TABLE public.barberia_off_peak_rules TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.barberia_off_peak_rules_id_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ba_calcular_precio_cita(BIGINT, BIGINT, BIGINT, DATE, TIME) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
