-- =============================================================================
-- ROLLBACK DE MIGRACIÓN: REVERTIR CÓDIGOS DE PLANES
-- ARCHIVO: 20260713_2026_add_plan_codes_rollback.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Validar si existen barberías o suscripciones apuntando al plan canónico BarberAgency
DO $body$
DECLARE
  v_usage_count INT;
  v_plan_id INT;
BEGIN
  SELECT id INTO v_plan_id FROM public.planes WHERE code = 'barberagency_full';
  
  IF v_plan_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_usage_count 
    FROM public.barberias b
    WHERE b.plan_id = v_plan_id;
    
    IF v_usage_count > 0 THEN
      RAISE EXCEPTION 'No se puede revertir: existen % barberías asignadas al nuevo plan BarberAgency.', v_usage_count;
    END IF;
    
    SELECT COUNT(*) INTO v_usage_count 
    FROM public.subscriptions s
    WHERE s.plan_id = v_plan_id;
    
    IF v_usage_count > 0 THEN
      RAISE EXCEPTION 'No se puede revertir: existen % suscripciones asignadas al nuevo plan BarberAgency.', v_usage_count;
    END IF;
  END IF;
END $body$;

-- 2. Eliminar el plan canónico nuevo
DELETE FROM public.planes WHERE code = 'barberagency_full';

-- 3. Remover las restricciones físicas creadas
ALTER TABLE public.planes 
DROP CONSTRAINT IF EXISTS chk_planes_code,
DROP CONSTRAINT IF EXISTS uq_planes_code;

-- 4. Eliminar la columna
ALTER TABLE public.planes 
DROP COLUMN IF EXISTS code;

COMMIT;
