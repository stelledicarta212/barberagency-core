const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('Cleaning up partial billing tables, functions, and columns...');
    
    // Drop functions
    await runSQL('DROP FUNCTION IF EXISTS public.billing_create_checkout(INT, INT) CASCADE;');
    await runSQL('DROP FUNCTION IF EXISTS public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) CASCADE;');
    await runSQL('DROP FUNCTION IF EXISTS public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) CASCADE;');
    await runSQL('DROP FUNCTION IF EXISTS public.billing_outbox_claim_batch(TEXT, INT, INT) CASCADE;');
    await runSQL('DROP FUNCTION IF EXISTS public.billing_outbox_mark_processed(UUID) CASCADE;');
    await runSQL('DROP FUNCTION IF EXISTS public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT) CASCADE;');
    await runSQL('DROP FUNCTION IF EXISTS public.billing_outbox_release_stale_locks(INT) CASCADE;');
    await runSQL('DROP FUNCTION IF EXISTS public.billing_outbox_requeue_dead_letter(UUID) CASCADE;');
    
    // Drop tables
    await runSQL('DROP TABLE IF EXISTS public.billing_outbox CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.billing_audit_logs CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.idempotency_records CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.payment_webhook_events CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.subscription_events CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.payment_transactions CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.payment_attempts CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.billing_invoices CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.billing_checkouts CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.billing_customers CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.plan_prices CASCADE;');
    await runSQL('DROP TABLE IF EXISTS public.test_table CASCADE;');

    // Drop columns from public.subscriptions
    await runSQL('ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS plan_price_id CASCADE;');
    await runSQL('ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS provider_status CASCADE;');
    await runSQL('ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS metadata CASCADE;');

    // Drop column and constraints from public.planes
    await runSQL('ALTER TABLE public.planes DROP COLUMN IF EXISTS code CASCADE;');

    console.log('Cleanup completed successfully.');
  } catch (e) {
    console.error('Error during cleanup:', e);
  } finally {
    await cleanup();
  }
})();
