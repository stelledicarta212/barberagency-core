-- =============================================================================
-- WC-006 RUNTIME: approved payment -> available unassigned license
-- ARCHIVO: 20260810_1700_wc006_runtime_license_transition.sql
-- ESTADO: LOCAL CANDIDATE - NO EJECUTAR EN PRODUCCION SIN REVISION Y AUTORIZACION
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

DO $body$
BEGIN
  IF to_regclass('public.business_licenses') IS NULL THEN
    RAISE EXCEPTION 'WC006_PREREQUISITE_MISSING: public.business_licenses';
  END IF;

  IF to_regclass('public.business_license_events') IS NULL THEN
    RAISE EXCEPTION 'WC006_PREREQUISITE_MISSING: public.business_license_events';
  END IF;

  IF to_regclass('public.billing_invoices') IS NULL THEN
    RAISE EXCEPTION 'WC006_PREREQUISITE_MISSING: public.billing_invoices';
  END IF;

  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE EXCEPTION 'WC006_PREREQUISITE_MISSING: public.subscriptions';
  END IF;
END;
$body$;

CREATE OR REPLACE FUNCTION public.wc006_apply_license_transition(
  p_invoice_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_invoice RECORD;
  v_subscription RECORD;
  v_license_id BIGINT;
  v_event_key TEXT;
BEGIN
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'WC006_INVOICE_REQUIRED' USING ERRCODE = '23514';
  END IF;

  SELECT *
    INTO v_invoice
  FROM public.billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'WC006_INVOICE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_invoice.status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'WC006_INVOICE_NOT_PAID' USING ERRCODE = '23514';
  END IF;

  IF v_invoice.subscription_id IS NULL THEN
    RAISE EXCEPTION 'WC006_SUBSCRIPTION_REQUIRED' USING ERRCODE = '23514';
  END IF;

  IF v_invoice.metadata->>'provider_payment_id' IS NULL THEN
    RAISE EXCEPTION 'WC006_PROVIDER_PAYMENT_REQUIRED' USING ERRCODE = '23514';
  END IF;

  SELECT s.id,
         s.barberia_id,
         s.period_start,
         s.period_end,
         b.owner_id
    INTO v_subscription
  FROM public.subscriptions s
  JOIN public.barberias b ON b.id = s.barberia_id AND b.deleted_at IS NULL
  WHERE s.id = v_invoice.subscription_id
  FOR UPDATE;

  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'WC006_SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_invoice.barberia_id IS DISTINCT FROM v_subscription.barberia_id THEN
    RAISE EXCEPTION 'WC006_INVOICE_SUBSCRIPTION_MISMATCH' USING ERRCODE = '23514';
  END IF;

  v_event_key := 'wc006:license_available:' || p_invoice_id::text;

  SELECT license_id
    INTO v_license_id
  FROM public.business_license_events
  WHERE idempotency_key = v_event_key
  LIMIT 1;

  IF v_license_id IS NOT NULL THEN
    RETURN v_license_id;
  END IF;

  SELECT id
    INTO v_license_id
  FROM public.business_licenses
  WHERE metadata->>'invoice_id' = p_invoice_id::text
  LIMIT 1;

  IF v_license_id IS NULL THEN
    INSERT INTO public.business_licenses (
      owner_id,
      assigned_barberia_id,
      plan_code,
      status,
      current_period_term,
      period_start,
      period_end,
      grace_until,
      source_contract_version,
      metadata
    )
    VALUES (
      v_subscription.owner_id,
      NULL,
      'barberagency_full',
      'available',
      COALESCE(v_invoice.metadata->>'billing_term', 'monthly'),
      v_subscription.period_start,
      v_subscription.period_end,
      v_subscription.period_end + interval '3 days',
      'WC-006.v1',
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'subscription_id', v_subscription.id,
        'checkout_id', v_invoice.metadata->>'checkout_id',
        'external_reference', v_invoice.metadata->>'external_reference',
        'provider_checkout_id', v_invoice.metadata->>'provider_checkout_id',
        'provider_payment_id', v_invoice.metadata->>'provider_payment_id',
        'provider_event_id', v_invoice.metadata->>'provider_event_id',
        'assignment_required', true,
        'assignment_contract', 'WC-007.v1'
      )
    )
    RETURNING id INTO v_license_id;
  END IF;

  INSERT INTO public.business_license_events (
    license_id,
    wc_order_item_link_id,
    owner_id,
    event_type,
    event_source,
    idempotency_key,
    previous_status,
    new_status,
    reason,
    actor_type,
    payload_sanitized
  )
  VALUES (
    v_license_id,
    NULL,
    v_subscription.owner_id,
    'license_available_created',
    'mercadopago',
    v_event_key,
    NULL,
    'available',
    'approved_payment_wc006_runtime',
    'system',
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'subscription_id', v_subscription.id,
      'barberia_id', v_subscription.barberia_id,
      'assignment_required', true,
      'assignment_contract', 'WC-007.v1'
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN v_license_id;
END;
$body$;

CREATE OR REPLACE FUNCTION public.wc006_apply_license_transition_from_invoice_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
BEGIN
  IF NEW.status = 'paid'
     AND NEW.subscription_id IS NOT NULL
     AND NEW.metadata->>'provider_payment_id' IS NOT NULL THEN
    PERFORM public.wc006_apply_license_transition(NEW.id);
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS trg_wc006_apply_license_transition_on_paid_invoice
  ON public.billing_invoices;

CREATE TRIGGER trg_wc006_apply_license_transition_on_paid_invoice
AFTER INSERT OR UPDATE OF status, subscription_id, metadata
ON public.billing_invoices
FOR EACH ROW
WHEN (
  NEW.status = 'paid'
  AND NEW.subscription_id IS NOT NULL
  AND NEW.metadata->>'provider_payment_id' IS NOT NULL
)
EXECUTE FUNCTION public.wc006_apply_license_transition_from_invoice_trigger();

WITH paid_invoices AS (
  SELECT id
  FROM public.billing_invoices
  WHERE status = 'paid'
    AND subscription_id IS NOT NULL
    AND metadata->>'provider_payment_id' IS NOT NULL
)
SELECT public.wc006_apply_license_transition(id)
FROM paid_invoices;

REVOKE EXECUTE ON FUNCTION public.wc006_apply_license_transition(UUID)
  FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.wc006_apply_license_transition_from_invoice_trigger()
  FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_outbox_worker;

GRANT EXECUTE ON FUNCTION public.wc006_apply_license_transition(UUID)
  TO ba_webhook_worker;

COMMIT;
