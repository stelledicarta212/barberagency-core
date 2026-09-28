-- =============================================================================
-- BARBERAGENCY CORE SCHEMA CANONICALIZATION: LOYALTY MODULE (PHASE 1) ROLLBACK
-- Migration: 20260928_1500_loyalty_core_phase1_rollback.sql
-- Description: Cleanly tears down view, triggers, and tables in reverse dependency order.
-- =============================================================================

BEGIN;

-- 1. DROP DERIVED VIEW
DROP VIEW IF EXISTS public.v_loyalty_client_balance CASCADE;

-- 2. DROP TRIGGERS AND FUNCTIONS
DROP TRIGGER IF EXISTS trg_prevent_loyalty_ledger_mutation ON public.loyalty_ledger;
DROP FUNCTION IF EXISTS public.fn_prevent_loyalty_ledger_mutation();

DROP TRIGGER IF EXISTS trg_loyalty_ledger_validate_tenant ON public.loyalty_ledger;
DROP FUNCTION IF EXISTS public.fn_loyalty_ledger_validate_tenant();

DROP TRIGGER IF EXISTS trg_loyalty_redemption_validate_tenant ON public.loyalty_redemptions;
DROP FUNCTION IF EXISTS public.fn_loyalty_redemption_validate_tenant();

-- 3. DROP TABLES (Reverse Dependency Order)
DROP TABLE IF EXISTS public.loyalty_ledger CASCADE;
DROP TABLE IF EXISTS public.loyalty_redemptions CASCADE;
DROP TABLE IF EXISTS public.loyalty_rewards CASCADE;
DROP TABLE IF EXISTS public.barberia_loyalty_config CASCADE;

COMMIT;
