-- WC-012 READ-ONLY observability queries for future Sandbox payment validation.
-- Do not run against production without explicit authorization.
-- Required parameters: :provider_payment_id, :provider_event_id, :external_reference, :provider_checkout_id

-- 1. End-to-end correlation.
SELECT
  bc.id AS checkout_id,
  bc.provider_payment_id,
  pwe.provider_event_id,
  bc.provider_checkout_id AS preference_id,
  bc.external_reference,
  pp.id AS plan_price_id,
  p.code AS plan_code,
  pp.name AS billing_term,
  pp.amount AS expected_amount,
  bc.provider_transaction_amount AS provider_transaction_amount,
  pp.currency AS expected_currency,
  bc.provider_currency_id AS provider_currency_id,
  bc.barberia_id,
  b.owner_id,
  pa.id AS payment_attempt_id,
  pt.id AS payment_transaction_id,
  bi.id AS invoice_id,
  s.id AS subscription_id,
  bl.id AS license_id,
  bo.id AS outbox_event_id,
  bc.status AS checkout_status,
  pa.status AS attempt_status,
  bi.status AS invoice_status,
  s.status AS subscription_status,
  bl.status AS license_status,
  bo.status AS outbox_status,
  bc.validation_error,
  bo.last_error_code,
  bo.last_error_message,
  bc.created_at,
  bc.verified_at,
  pa.created_at AS attempt_created_at,
  pt.created_at AS transaction_created_at,
  bo.created_at AS outbox_created_at,
  bo.attempt_count AS outbox_attempt_count
FROM public.billing_checkouts bc
JOIN public.barberias b ON b.id = bc.barberia_id
JOIN public.plan_prices pp ON pp.id = bc.plan_price_id
JOIN public.planes p ON p.id = pp.plan_id
LEFT JOIN public.payment_attempts pa
  ON pa.external_reference = bc.external_reference
  OR pa.provider_ref = bc.provider_payment_id
LEFT JOIN public.payment_transactions pt ON pt.payment_attempt_id = pa.id
LEFT JOIN public.billing_invoices bi ON bi.id = pa.invoice_id
LEFT JOIN public.subscriptions s ON s.id = bi.subscription_id
LEFT JOIN public.business_licenses bl ON bl.subscription_id = s.id
LEFT JOIN public.payment_webhook_events pwe
  ON pwe.provider_event_id = pa.provider_event_id
LEFT JOIN public.billing_outbox bo
  ON bo.correlation_id = bc.id
WHERE (:provider_payment_id IS NULL OR bc.provider_payment_id = :provider_payment_id OR pt.provider_payment_id = :provider_payment_id)
  AND (:provider_event_id IS NULL OR pwe.provider_event_id = :provider_event_id OR pa.provider_event_id = :provider_event_id)
  AND (:external_reference IS NULL OR bc.external_reference = :external_reference)
  AND (:provider_checkout_id IS NULL OR bc.provider_checkout_id = :provider_checkout_id);

-- 2. Duplicate provider payment IDs.
SELECT provider, provider_payment_id, count(*)
FROM public.payment_transactions
WHERE provider_payment_id IS NOT NULL
GROUP BY provider, provider_payment_id
HAVING count(*) > 1;

-- 3. Duplicate provider event IDs.
SELECT provider, provider_event_id, count(*)
FROM public.payment_webhook_events
WHERE provider_event_id IS NOT NULL
GROUP BY provider, provider_event_id
HAVING count(*) > 1;

-- 4. Reused external references.
SELECT external_reference, count(*)
FROM public.billing_checkouts
GROUP BY external_reference
HAVING count(*) > 1;

-- 5. Reused preferences.
SELECT provider_checkout_id, count(*)
FROM public.billing_checkouts
WHERE provider_checkout_id IS NOT NULL
GROUP BY provider_checkout_id
HAVING count(*) > 1;

-- 6. Orphan attempts/transactions/webhook/outbox.
SELECT 'attempt_without_checkout' AS issue, pa.id::text AS id
FROM public.payment_attempts pa
LEFT JOIN public.billing_checkouts bc ON bc.external_reference = pa.external_reference
WHERE pa.external_reference IS NOT NULL AND bc.id IS NULL
UNION ALL
SELECT 'transaction_without_attempt', pt.id::text
FROM public.payment_transactions pt
LEFT JOIN public.payment_attempts pa ON pa.id = pt.payment_attempt_id
WHERE pa.id IS NULL
UNION ALL
SELECT 'outbox_without_checkout', bo.id::text
FROM public.billing_outbox bo
LEFT JOIN public.billing_checkouts bc ON bc.id = bo.correlation_id
WHERE bo.aggregate_type IN ('checkout','payment') AND bc.id IS NULL;

-- 7. Pending or failed events.
SELECT id, provider, provider_event_id, event_type, processed, error_message, created_at
FROM public.payment_webhook_events
WHERE processed = false OR error_message IS NOT NULL;

SELECT id, event_type, status, attempt_count, last_error_code, created_at, next_retry_at
FROM public.billing_outbox
WHERE status IN ('pending', 'retry_scheduled', 'failed', 'dead_letter');

-- 8. Non-approved payments that activated rights.
SELECT pa.id, pa.status, bi.subscription_id
FROM public.payment_attempts pa
JOIN public.billing_invoices bi ON bi.id = pa.invoice_id
WHERE pa.status <> 'approved' AND bi.subscription_id IS NOT NULL;

-- 9. Amount/currency/tenant mismatch.
SELECT pa.id, pa.provider_ref, pa.external_reference, pa.expected_amount, pa.provider_transaction_amount
FROM public.payment_attempts pa
WHERE pa.expected_amount IS DISTINCT FROM pa.provider_transaction_amount;

SELECT pa.id, pa.provider_ref, pa.external_reference, pa.expected_currency, pa.provider_currency_id
FROM public.payment_attempts pa
WHERE pa.expected_currency IS DISTINCT FROM pa.provider_currency_id;

SELECT pa.id, pa.barberia_id AS attempt_barberia_id, bc.barberia_id AS checkout_barberia_id
FROM public.payment_attempts pa
JOIN public.billing_checkouts bc ON bc.external_reference = pa.external_reference
WHERE pa.barberia_id <> bc.barberia_id;

-- 10. Duplicate invoices/subscription extensions/licenses activated.
SELECT metadata->>'checkout_id' AS checkout_id, count(*)
FROM public.billing_invoices
WHERE metadata ? 'checkout_id'
GROUP BY metadata->>'checkout_id'
HAVING count(*) > 1;

SELECT subscription_id, event_type, metadata->>'provider_payment_id' AS provider_payment_id, count(*)
FROM public.subscription_events
WHERE metadata ? 'provider_payment_id'
GROUP BY subscription_id, event_type, metadata->>'provider_payment_id'
HAVING count(*) > 1;

SELECT subscription_id, count(*)
FROM public.business_licenses
WHERE status IN ('available','assigned','active')
GROUP BY subscription_id
HAVING count(*) > 1;
