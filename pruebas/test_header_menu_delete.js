// Unit and DOM simulation test for the Header User Menu delete action
const fs = require('fs');
const assert = require('assert');

function clean(v) {
  return (v ?? "").toString().trim();
}

function isBarberiaActivePlan(b) {
  const sub = clean(b?.subscription_state).toUpperCase();
  return ["PAID_ACTIVE", "TRIAL_ACTIVE", "TRIAL_EXPIRING", "ACTIVATION_PENDING"].includes(sub);
}

function isBarberiaOwner(b, userRole) {
  const r = clean(b?.role || userRole).toLowerCase();
  return !r || r === "owner";
}

function isExactNameConfirmation(typed, target) {
  return clean(typed) === clean(target) && clean(typed).length > 0;
}

console.log('--- RUNNING HEADER USER MENU DELETE LOGIC TESTS ---');

// Gate 1: Eligibility check
const paidBarberia = { id: 198, nombre: "Barberia Prueba 4", role: "owner", subscription_state: "PAID_ACTIVE" };
const trialExpiredBarberia = { id: 207, nombre: "Barberia prueba 5", role: "owner", subscription_state: "TRIAL_EXPIRED" };
const nonOwnerBarberia = { id: 197, nombre: "Barberia prueba 3", role: "member", subscription_state: "TRIAL_EXPIRED" };

assert.strictEqual(isBarberiaActivePlan(paidBarberia), true, "Paid barberia should be active plan");
assert.strictEqual(isBarberiaActivePlan(trialExpiredBarberia), false, "Expired barberia should not be active plan");

assert.strictEqual(isBarberiaOwner(paidBarberia), true, "Owner role should be owner");
assert.strictEqual(isBarberiaOwner(nonOwnerBarberia), false, "Member role should not be owner");

// Gate 2: Confirmation exact match
assert.strictEqual(isExactNameConfirmation("Barberia prueba 5", "Barberia prueba 5"), true);
assert.strictEqual(isExactNameConfirmation("  Barberia prueba 5  ", "Barberia prueba 5"), true);
assert.strictEqual(isExactNameConfirmation("barberia prueba 5", "Barberia prueba 5"), false, "Case mismatch rejected");
assert.strictEqual(isExactNameConfirmation("Barberia prueba", "Barberia prueba 5"), false, "Prefix rejected");
assert.strictEqual(isExactNameConfirmation("", "Barberia prueba 5"), false, "Empty rejected");

console.log('Gate 1 & Gate 2 PASS: Logic rules verified.');
