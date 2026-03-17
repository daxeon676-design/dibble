# Payout UAT Sign-Off

Use this checklist in staging for each release candidate that can affect payout behavior.

## Scope

- Admin payout queue workflows
- Seller payout profile validation
- Reconciliation report consistency
- Stripe transfer behavior and references

## Test Data

- At least 2 seller accounts:
  - Seller A with Stripe Connect configured
  - Seller B without Stripe Connect
- At least 3 paid orders per seller
- Admin account with MFA enabled

## UAT Cases

### 1. Seller Payout Profile Validation

- [ ] Bank transfer profile rejects missing required fields.
- [ ] PayPal profile rejects missing required fields.
- [ ] Manual review profile requires notes.
- [ ] Valid profile saves and persists after refresh.

### 2. Auto-Split (Seller With Connect)

- [ ] Paid order creates payout ledger entry with split-at-charge state.
- [ ] Entry includes expected seller payout and platform fee values.
- [ ] Entry is visible in admin payout views.

### 3. Platform Pending (Seller Without Connect)

- [ ] Paid order creates platform-pending payout ledger entry.
- [ ] Entry appears in admin pending queue.
- [ ] Admin can mark payout paid manually with reference.
- [ ] Completed entry appears in completed payout section.

### 4. Admin Stripe Transfer Action

- [ ] Admin can trigger pay-now transfer where seller has Connect account.
- [ ] Transfer id is stored in payout record.
- [ ] Entry transitions out of pending state.

### 5. Reconciliation

- [ ] Manual reconciliation run completes from admin pages.
- [ ] No unexpected critical issue types for known good data.
- [ ] Last reconciliation report is persisted.

### 6. Alerting and Ops

- [ ] Reconciliation issue scenario produces alert signal.
- [ ] Alert routing status appears healthy in admin ops views.
- [ ] Daily reconciliation endpoint auth works with configured secret.

## Evidence Required

- Screenshot or JSON capture for each completed case.
- Order IDs and seller IDs used in test run.
- Any failed case with issue link and owner.

## Sign-Off Record

- Release candidate:
- Date:
- QA owner:
- Engineering owner:
- Finance/Ops reviewer:

Decision:

- [ ] PASS - payout workflows acceptable for launch
- [ ] FAIL - blocking issues remain

Notes:
