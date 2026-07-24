-- Rollback migration: Drop fn_pos_registrar_pago_realizada
-- Base branch: main
-- Date: 2026-07-23

DROP FUNCTION IF EXISTS public.fn_pos_registrar_pago_realizada(INT, INT, NUMERIC, TEXT);
