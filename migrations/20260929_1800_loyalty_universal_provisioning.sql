-- =============================================================================
-- BARBERAGENCY CORE SCHEMA: LOYALTY UNIVERSAL MULTI-TENANT PROVISIONING
-- Migration: 20260929_1800_loyalty_universal_provisioning.sql
-- Description:
--   1. Provisions canonical Loyalty configuration for all existing active barberías
--      without configuration in an idempotent, concurrency-safe manner.
--   2. Installs an automatic lifecycle trigger on public.barberias to ensure every
--      future tenant receives its canonical Loyalty configuration at creation time.
--   3. Executes NOTIFY pgrst, 'reload schema' to ensure PostgREST cache is refreshed.
-- Constraints:
--   - Zero modifications to public.pagos, public.citas, public.loyalty_ledger.
--   - Zero fake stamps, zero fake ledger rows, zero fake redemptions.
--   - Completely tenant-generic: NO hardcoded IDs.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PREREQUISITES VERIFICATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.barberias') IS NULL THEN
    RAISE EXCEPTION 'LOYALTY_UNIVERSAL_PREREQUISITE_MISSING: public.barberias';
  END IF;
  IF to_regclass('public.barberia_loyalty_config') IS NULL THEN
    RAISE EXCEPTION 'LOYALTY_UNIVERSAL_PREREQUISITE_MISSING: public.barberia_loyalty_config';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. AUTOMATIC TRIGGER FOR FUTURE TENANTS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_barberia_loyalty_auto_provision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Automatically provision canonical default loyalty configuration
  INSERT INTO public.barberia_loyalty_config (
    barberia_id,
    activo,
    program_type,
    sellos_requeridos,
    recompensa_default,
    created_at,
    updated_at,
    accrual_start_at
  ) VALUES (
    NEW.id,
    true,
    'stamps',
    10,
    'Corte Gratis',
    now(),
    now(),
    now()
  )
  ON CONFLICT (barberia_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_barberia_loyalty_auto_provision ON public.barberias;
CREATE TRIGGER tr_barberia_loyalty_auto_provision
  AFTER INSERT ON public.barberias
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_barberia_loyalty_auto_provision();

-- -----------------------------------------------------------------------------
-- 3. IDEMPOTENT BACKFILL PROVISIONING FOR EXISTING TENANTS
-- -----------------------------------------------------------------------------
INSERT INTO public.barberia_loyalty_config (
  barberia_id,
  activo,
  program_type,
  sellos_requeridos,
  recompensa_default,
  created_at,
  updated_at,
  accrual_start_at
)
SELECT
  b.id,
  true,
  'stamps',
  10,
  'Corte Gratis',
  now(),
  now(),
  now()
FROM public.barberias b
WHERE b.deleted_at IS NULL
ON CONFLICT (barberia_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. POSTGREST SCHEMA CACHE REFRESH
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
