const assert = require('assert');
const {
  ROLE_POLICY,
  validateAmount,
  validateCurrency,
  validatePaymentBinding,
  assertRolePolicy,
  buildMercadoPagoWebhookManifest,
  validateMercadoPagoWebhookSignature,
  signMercadoPagoWebhookForTest,
} = require('../app/backend/wc012_payment_remediation_contract');

function expectPass(result, label) {
  assert.strictEqual(result.pass ?? result.allowed, true, label + ' should pass');
}

function expectFail(result, code, label) {
  assert.strictEqual(result.pass ?? result.allowed, false, label + ' should fail');
  assert.strictEqual(result.code, code, label + ' code');
}

const checkout = {
  id: 'checkout-a',
  preferenceId: 'pref-a',
  externalReference: 'ba_v1_checkout_a',
  barberiaId: 10,
  ownerUserId: 501,
  planPriceId: 4225,
};

const planPrice = {
  planCode: 'barberagency_full',
  billingTerm: 'monthly',
  amount: '50000.00',
  currency: 'COP',
};

const payment = {
  id: 'payment-a',
  eventId: 'event-a',
  eventType: 'payment',
  status: 'approved',
  checkoutId: 'checkout-a',
  preferenceId: 'pref-a',
  externalReference: 'ba_v1_checkout_a',
  barberiaId: 10,
  ownerUserId: 501,
  planPriceId: 4225,
  planCode: 'barberagency_full',
  billingTerm: 'monthly',
  transactionAmount: '50000.00',
  currencyId: 'COP',
};

expectPass(validateAmount('50000.00', '50000.00'), 'exact amount');
expectFail(validateAmount('49999.99', '50000.00'), 'AMOUNT_MISMATCH', 'lower amount');
expectFail(validateAmount('50000.01', '50000.00'), 'AMOUNT_MISMATCH', 'higher amount');
expectFail(validateAmount('50000.001', '50000.00'), 'INVALID_AMOUNT_FORMAT', 'invalid scale');
expectFail(validateAmount(null, '50000.00'), 'INVALID_AMOUNT_FORMAT', 'null amount');
expectFail(validateAmount('NaN', '50000.00'), 'INVALID_AMOUNT_FORMAT', 'NaN amount');
expectFail(validateAmount('-1.00', '50000.00'), 'NEGATIVE_AMOUNT', 'negative amount');

expectPass(validateCurrency('COP', 'COP'), 'COP currency');
expectFail(validateCurrency('USD', 'COP'), 'CURRENCY_MISMATCH', 'different currency');
expectFail(validateCurrency(null, 'COP'), 'INVALID_CURRENCY_FORMAT', 'null currency');
expectFail(validateCurrency('', 'COP'), 'INVALID_CURRENCY_FORMAT', 'empty currency');
expectFail(validateCurrency('cop', 'COP'), 'INVALID_CURRENCY_FORMAT', 'lowercase currency');
expectFail(validateCurrency('CO', 'COP'), 'INVALID_CURRENCY_FORMAT', 'invalid currency');

expectPass(validatePaymentBinding({ payment, checkout, planPrice }), 'valid binding');
expectFail(validatePaymentBinding({ payment: { ...payment, preferenceId: 'pref-b' }, checkout, planPrice }), 'PREFERENCE_MISMATCH', 'preference mismatch');
expectFail(validatePaymentBinding({ payment: { ...payment, externalReference: 'other' }, checkout, planPrice }), 'EXTERNAL_REFERENCE_MISMATCH', 'external reference mismatch');
expectFail(validatePaymentBinding({ payment: { ...payment, barberiaId: 11 }, checkout, planPrice }), 'TENANT_MISMATCH', 'tenant mismatch');
expectFail(validatePaymentBinding({ payment: { ...payment, ownerUserId: 777 }, checkout, planPrice }), 'OWNER_MISMATCH', 'owner mismatch');
expectFail(validatePaymentBinding({ payment: { ...payment, planCode: 'other_plan' }, checkout, planPrice }), 'PLAN_CODE_MISMATCH', 'plan mismatch');
expectFail(validatePaymentBinding({ payment: { ...payment, billingTerm: 'annual' }, checkout, planPrice }), 'BILLING_TERM_MISMATCH', 'term mismatch');
expectFail(validatePaymentBinding({ payment: { ...payment, transactionAmount: '50000.00' }, checkout: { ...checkout, id: 'checkout-b' }, planPrice, existingPaymentIds: new Set(['payment-a']) }), 'PAYMENT_ID_REUSED_FOR_DIFFERENT_CHECKOUT', 'payment reused');
expectPass(validatePaymentBinding({ payment, checkout, planPrice, existingEventIds: new Set(['event-a']) }), 'duplicate event idempotent');
expectFail(validatePaymentBinding({ payment: { ...payment, eventType: 'refund' }, checkout, planPrice }), 'EVENT_REQUIRES_REVIEW', 'refund closed');
expectFail(validatePaymentBinding({ payment: { ...payment, eventType: 'chargeback' }, checkout, planPrice }), 'EVENT_REQUIRES_REVIEW', 'chargeback closed');
expectFail(validatePaymentBinding({ payment: { ...payment, status: 'pending' }, checkout, planPrice }), 'PAYMENT_NOT_APPROVED', 'pending cannot grant');

for (const [role, policy] of Object.entries(ROLE_POLICY)) {
  for (const rpc of policy.allowedRpc) expectPass(assertRolePolicy(role, rpc), `${role} ${rpc}`);
  for (const rpc of policy.deniedRpc) expectFail(assertRolePolicy(role, rpc), 'RPC_DENIED', `${role} denies ${rpc}`);
}

expectFail(assertRolePolicy('PUBLIC', 'billing_process_approved_payment'), 'UNKNOWN_ROLE', 'PUBLIC unknown');

const syntheticSecret = 'local_synthetic_mp_webhook_secret_32_bytes';
const nowMs = 1786393000000;
const ts = String(Math.floor(nowMs / 1000));
const dataId = '123456789';
const xRequestId = '4ed4fa2b-0b31-42ec-a62f-ad793c486c59';
const validSignature = signMercadoPagoWebhookForTest({ dataId, xRequestId, ts, secret: syntheticSecret });

assert.strictEqual(
  buildMercadoPagoWebhookManifest({ dataId, xRequestId, ts }),
  `id:${dataId};request-id:${xRequestId};ts:${ts};`,
  'Mercado Pago manifest',
);
expectPass(validateMercadoPagoWebhookSignature({ xSignature: validSignature, xRequestId, dataId, secret: syntheticSecret, nowMs }), 'valid webhook signature');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: validSignature.replace(/.$/, '0'), xRequestId, dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_MISMATCH', 'invalid signature');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: validSignature, xRequestId, dataId, secret: 'wrong_synthetic_secret_32_bytes', nowMs }), 'WEBHOOK_SIGNATURE_MISMATCH', 'wrong secret');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: signMercadoPagoWebhookForTest({ dataId, xRequestId, ts: String(Number(ts) - 999), secret: syntheticSecret }), xRequestId, dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE', 'expired timestamp');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: signMercadoPagoWebhookForTest({ dataId, xRequestId, ts: String(Number(ts) + 999), secret: syntheticSecret }), xRequestId, dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE', 'future timestamp');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: validSignature, xRequestId: `${xRequestId}-tampered`, dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_MISMATCH', 'request id tampered');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: validSignature, xRequestId, dataId: '987654321', secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_MISMATCH', 'data id tampered');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: null, xRequestId, dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_MISSING', 'missing header');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: 'ts=abc,v1=123', xRequestId, dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_TS_INVALID', 'malformed ts');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: 'ts=123,v1=abc', xRequestId, dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_SIGNATURE_V1_INVALID', 'malformed v1');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: validSignature, xRequestId: '', dataId, secret: syntheticSecret, nowMs }), 'WEBHOOK_REQUEST_ID_MISSING', 'missing request id');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: validSignature, xRequestId, dataId: '', secret: syntheticSecret, nowMs }), 'WEBHOOK_DATA_ID_MISSING', 'missing data id');
expectFail(validateMercadoPagoWebhookSignature({ xSignature: validSignature, xRequestId, dataId, secret: '', nowMs }), 'WEBHOOK_SECRET_NOT_CONFIGURED', 'missing secret');

console.log('WC-012 payment remediation contract tests passed');
