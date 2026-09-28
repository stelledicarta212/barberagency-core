-- =============================================================================
-- BARBERAGENCY CORE SCHEMA CANONICALIZATION: LOYALTY MODULE (PHASE 2) ROLLBACK
-- Migration: 20260928_1600_loyalty_rpc_core_phase2_rollback.sql
-- Description: Cleanly tears down RPC functions, triggers, and column additions
--              introduced in Phase 2, preserving Phase 1 baseline.
-- =============================================================================

BEGIN;

-- 1. DROP RPC FUNCTIONS
DROP FUNCTION IF EXISTS public.ba_loyalty_reconciliar_pagos(INT, INT);
DROP FUNCTION IF EXISTS public.ba_loyalty_reverse(BIGINT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.ba_loyalty_redeem(INT, INT, INT, TEXT);
DROP FUNCTION IF EXISTS public.ba_loyalty_acumular_pago(INT);

-- 2. DROP ACCRUAL BOUNDARY TRIGGER & FUNCTION
DROP TRIGGER IF EXISTS trg_loyalty_config_accrual_boundary ON public.barberia_loyalty_config;
DROP FUNCTION IF EXISTS public.fn_loyalty_config_accrual_boundary();

-- 3. DROP ACCRUAL START COLUMN ON LOYALTY CONFIG
ALTER TABLE public.barberia_loyalty_config
  DROP COLUMN IF EXISTS accrual_start_at;

COMMIT;
