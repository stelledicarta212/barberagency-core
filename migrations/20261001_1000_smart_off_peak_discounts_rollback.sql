-- Rollback: 20261001_1000_smart_off_peak_discounts_rollback.sql

BEGIN;

DROP FUNCTION IF EXISTS public.ba_calcular_precio_cita(BIGINT, BIGINT, BIGINT, DATE, TIME);
DROP TABLE IF EXISTS public.barberia_off_peak_rules CASCADE;

ALTER TABLE public.citas
  DROP COLUMN IF EXISTS precio_base,
  DROP COLUMN IF EXISTS descuento_porcentaje,
  DROP COLUMN IF EXISTS descuento_valor,
  DROP COLUMN IF EXISTS precio_final,
  DROP COLUMN IF EXISTS promocion_id,
  DROP COLUMN IF EXISTS promocion_snapshot;

NOTIFY pgrst, 'reload schema';

COMMIT;
