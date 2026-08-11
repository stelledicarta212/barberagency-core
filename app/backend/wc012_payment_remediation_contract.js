const crypto = require('crypto');

const WC012_REMEDIATION_CONTRACT_VERSION = 'WC-012.payment-security-remediation.v1';

const PAYMENT_STATUSES_THAT_CAN_GRANT = new Set(['approved']);
const REVIEW_ONLY_EVENT_TYPES = new Set([
  'refund',
  'chargeback',
  'payment.refunded',
  'payment.chargeback',
  'payment.dispute',
  'dispute.opened',
]);

const ROLE_POLICY = Object.freeze({
  ba_checkout_app: {
    allowedRpc: ['billing_create_checkout_backend'],
    deniedRpc: [
      'billing_register_webhook',
      'billing_process_approved_payment',
      'billing_outbox_claim_batch',
      'billing_outbox_mark_processed',
      'billing_outbox_mark_failed',
      'billing_outbox_release_stale_locks',
      'billing_outbox_requeue_dead_letter',
    ],
  },
  ba_webhook_worker: {
    allowedRpc: ['billing_register_webhook', 'billing_process_approved_payment'],
    deniedRpc: [
      'billing_create_checkout_backend',
      'billing_outbox_claim_batch',
      'billing_outbox_mark_processed',
      'billing_outbox_mark_failed',
      'billing_outbox_release_stale_locks',
      'billing_outbox_requeue_dead_letter',
    ],
  },
  ba_outbox_worker: {
    allowedRpc: [
      'billing_outbox_claim_batch',
      'billing_outbox_mark_processed',
      'billing_outbox_mark_failed',
      'billing_outbox_release_stale_locks',
      'billing_outbox_requeue_dead_letter',
    ],
    deniedRpc: [
      'billing_create_checkout_backend',
      'billing_register_webhook',
      'billing_process_approved_payment',
    ],
  },
});

function normalizeCurrency(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[A-Z]{3}$/.test(trimmed)) return null;
  return trimmed;
}

function parseMoneyToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    value = String(value);
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  const cents = (BigInt(whole) * 100n) + BigInt((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

function validateAmount(providerAmount, expectedAmount) {
  const provider = parseMoneyToCents(providerAmount);
  const expected = parseMoneyToCents(expectedAmount);
  if (provider === null || expected === null) {
    return { pass: false, code: 'INVALID_AMOUNT_FORMAT' };
  }
  if (provider < 0n || expected < 0n) {
    return { pass: false, code: 'NEGATIVE_AMOUNT' };
  }
  if (provider !== expected) {
    return { pass: false, code: 'AMOUNT_MISMATCH' };
  }
  return { pass: true, code: 'AMOUNT_MATCH' };
}

function validateCurrency(providerCurrency, expectedCurrency) {
  const provider = normalizeCurrency(providerCurrency);
  const expected = normalizeCurrency(expectedCurrency);
  if (!provider || !expected) {
    return { pass: false, code: 'INVALID_CURRENCY_FORMAT' };
  }
  if (provider !== expected) {
    return { pass: false, code: 'CURRENCY_MISMATCH' };
  }
  return { pass: true, code: 'CURRENCY_MATCH' };
}

function validatePaymentBinding({ payment, checkout, planPrice, existingPaymentIds = new Set(), existingEventIds = new Set() }) {
  if (!checkout || !checkout.id) return { pass: false, code: 'CHECKOUT_NOT_FOUND' };
  if (!payment || !payment.id) return { pass: false, code: 'PAYMENT_NOT_FOUND' };
  if (REVIEW_ONLY_EVENT_TYPES.has(payment.eventType)) return { pass: false, code: 'EVENT_REQUIRES_REVIEW' };
  if (!PAYMENT_STATUSES_THAT_CAN_GRANT.has(payment.status)) return { pass: false, code: 'PAYMENT_NOT_APPROVED' };
  if (existingEventIds.has(payment.eventId)) return { pass: true, code: 'DUPLICATE_EVENT_IDEMPOTENT' };
  if (existingPaymentIds.has(payment.id) && payment.checkoutId !== checkout.id) return { pass: false, code: 'PAYMENT_ID_REUSED_FOR_DIFFERENT_CHECKOUT' };
  if (payment.preferenceId !== checkout.preferenceId) return { pass: false, code: 'PREFERENCE_MISMATCH' };
  if (payment.externalReference !== checkout.externalReference) return { pass: false, code: 'EXTERNAL_REFERENCE_MISMATCH' };
  if (payment.checkoutId && payment.checkoutId !== checkout.id) return { pass: false, code: 'CHECKOUT_MISMATCH' };
  if (payment.barberiaId !== checkout.barberiaId) return { pass: false, code: 'TENANT_MISMATCH' };
  if (payment.ownerUserId !== checkout.ownerUserId) return { pass: false, code: 'OWNER_MISMATCH' };
  if (payment.planPriceId !== checkout.planPriceId) return { pass: false, code: 'PLAN_PRICE_MISMATCH' };
  if (payment.planCode !== planPrice.planCode) return { pass: false, code: 'PLAN_CODE_MISMATCH' };
  if (payment.billingTerm !== planPrice.billingTerm) return { pass: false, code: 'BILLING_TERM_MISMATCH' };
  const amount = validateAmount(payment.transactionAmount, planPrice.amount);
  if (!amount.pass) return amount;
  const currency = validateCurrency(payment.currencyId, planPrice.currency);
  if (!currency.pass) return currency;
  return { pass: true, code: 'PAYMENT_BINDING_MATCH' };
}

function assertRolePolicy(roleName, rpcName) {
  const policy = ROLE_POLICY[roleName];
  if (!policy) return { allowed: false, code: 'UNKNOWN_ROLE' };
  if (policy.allowedRpc.includes(rpcName)) return { allowed: true, code: 'RPC_ALLOWED' };
  return { allowed: false, code: 'RPC_DENIED' };
}

function parseMercadoPagoSignatureHeader(xSignature) {
  if (typeof xSignature !== 'string' || xSignature.trim() === '') {
    return { pass: false, code: 'WEBHOOK_SIGNATURE_MISSING' };
  }
  const parsed = {};
  for (const part of xSignature.split(',')) {
    const [rawKey, ...rawValue] = part.split('=');
    const key = (rawKey || '').trim();
    const value = rawValue.join('=').trim();
    if (!key || !value || parsed[key]) {
      return { pass: false, code: 'WEBHOOK_SIGNATURE_MALFORMED' };
    }
    parsed[key] = value;
  }
  if (!/^\d+$/.test(parsed.ts || '')) {
    return { pass: false, code: 'WEBHOOK_SIGNATURE_TS_INVALID' };
  }
  if (!/^[a-f0-9]{64}$/i.test(parsed.v1 || '')) {
    return { pass: false, code: 'WEBHOOK_SIGNATURE_V1_INVALID' };
  }
  return { pass: true, ts: parsed.ts, v1: parsed.v1.toLowerCase() };
}

function buildMercadoPagoWebhookManifest({ dataId, xRequestId, ts }) {
  let manifest = '';
  if (dataId !== undefined && dataId !== null && String(dataId).trim() !== '') {
    manifest += `id:${String(dataId).trim()};`;
  }
  if (xRequestId !== undefined && xRequestId !== null && String(xRequestId).trim() !== '') {
    manifest += `request-id:${String(xRequestId).trim()};`;
  }
  if (ts !== undefined && ts !== null && String(ts).trim() !== '') {
    manifest += `ts:${String(ts).trim()};`;
  }
  return manifest;
}

function timingSafeHexEqual(leftHex, rightHex) {
  if (!/^[a-f0-9]+$/i.test(leftHex) || !/^[a-f0-9]+$/i.test(rightHex)) return false;
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function validateMercadoPagoWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
  nowMs = Date.now(),
  maxAgeSeconds = 300,
}) {
  if (typeof secret !== 'string' || secret.length < 16) {
    return { pass: false, code: 'WEBHOOK_SECRET_NOT_CONFIGURED' };
  }
  if (typeof xRequestId !== 'string' || xRequestId.trim() === '') {
    return { pass: false, code: 'WEBHOOK_REQUEST_ID_MISSING' };
  }
  if (dataId === undefined || dataId === null || String(dataId).trim() === '') {
    return { pass: false, code: 'WEBHOOK_DATA_ID_MISSING' };
  }
  const parsed = parseMercadoPagoSignatureHeader(xSignature);
  if (!parsed.pass) return parsed;

  const tsNumber = Number(parsed.ts);
  if (!Number.isSafeInteger(tsNumber)) {
    return { pass: false, code: 'WEBHOOK_SIGNATURE_TS_INVALID' };
  }
  const tsMs = parsed.ts.length >= 13 ? tsNumber : tsNumber * 1000;
  if (maxAgeSeconds !== null && maxAgeSeconds !== undefined) {
    const skewMs = Math.abs(nowMs - tsMs);
    if (skewMs > maxAgeSeconds * 1000) {
      return { pass: false, code: 'WEBHOOK_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE' };
    }
  }

  const manifest = buildMercadoPagoWebhookManifest({ dataId, xRequestId, ts: parsed.ts });
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  if (!timingSafeHexEqual(expected, parsed.v1)) {
    return { pass: false, code: 'WEBHOOK_SIGNATURE_MISMATCH' };
  }
  return { pass: true, code: 'WEBHOOK_SIGNATURE_VALID', manifest };
}

function signMercadoPagoWebhookForTest({ dataId, xRequestId, ts, secret }) {
  const manifest = buildMercadoPagoWebhookManifest({ dataId, xRequestId, ts });
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

module.exports = {
  WC012_REMEDIATION_CONTRACT_VERSION,
  ROLE_POLICY,
  validateAmount,
  validateCurrency,
  validatePaymentBinding,
  assertRolePolicy,
  buildMercadoPagoWebhookManifest,
  validateMercadoPagoWebhookSignature,
  signMercadoPagoWebhookForTest,
};
