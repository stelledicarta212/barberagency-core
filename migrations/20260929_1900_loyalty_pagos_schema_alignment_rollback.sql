-- =============================================================================
-- BARBERAGENCY — ROLLBACK: LOYALTY SCHEMA ALIGNMENT
-- Migration: 20260929_1900_loyalty_pagos_schema_alignment_rollback.sql
-- =============================================================================

BEGIN;

-- Revert to migration 1600/1700 definitions if needed
-- Note: Migration 1900 corrects column names from monto/created_at to total/pagado_en.
-- Reverting would reintroduce the schema mismatch with public.pagos.

NOTIFY pgrst, 'reload schema';

COMMIT;
