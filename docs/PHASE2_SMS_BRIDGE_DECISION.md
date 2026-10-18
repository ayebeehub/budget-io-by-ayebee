# ADR-002 | Optional SMS capture bridge before the Android application

**Status: CONDITIONAL YES (pilot only). Date: 2026-10-18.**

## Decision

Phase 2B may add automatic transaction capture from Android financial SMS via **MacroDroid to authenticated ingestion API**, after Phase 2A backend/security prerequisites and without waiting for the full Android application. Do **not** use raw SMS -> public ntfy topic or raw SMS -> VPS as the default design. This bridge is optional, excluded from Phase 1 and can be removed once Phase 3 native SMS capture is proven.

## Why (and limitations)

- MacroDroid documents an SMS Received trigger, sender/content filtering and received-message variables. It also has an HTTP Request action supporting POST, custom bodies and headers. Exact parsing actions/regex robustness must be validated on the actual OnePlus/OxygenOS 16 setup.
- ntfy is built for messaging; default server-side caching and ACL configuration make it inappropriate as a guaranteed-once bank event queue. Even self-hosted ntfy + HTTPS does not automatically provide end-to-end encryption or durable financial ingestion guarantees.
- Android 16 changes background scheduling, broadcasts and OEM-specific resource management. Never assume 100% receipt, reliable network delivery or background processing without field tests.
- Single-user sideloading differs from Google Play distribution; Google Play lists SMS-based money management as an eligible *exception* subject to approval, not a blanket permission grant. Runtime permissions, user consent and OS limits still apply.
- Prior MacroDroid/ntfy OTP-forwarding use may exhibit intermittent delivery on the user's device. That is an additional reason for queueing, acknowledgements and periodic statement reconciliation, never reliance on best-effort ntfy delivery for ledger completeness.

## Safe candidate pipeline

```text
Financial SMS received on Android
  -> Strict sender + payment keyword allowlist; OTP/login/personal message deny rules
  -> Parse *locally* into limited fields (amount, DR/CR, masked account last4,
     institution, event time, merchant if reliable, transaction/reference ID if present)
  -> If ambiguous, locally flag for manual review, not upload full message
  -> HTTPS POST structured event to authenticated /v1/ingest/sms-bridge
  -> Backend checks schema / API key / timestamp/nonce, rate limits and event idempotency
  -> Store reviewable event + provenance, not raw SMS
  -> Return acknowledgement and durable event ID
  -> Retry failed sends from a local queue; expose pipeline health and last-event timestamp
  -> Reconcile against future bank CSV/statement imports before marking complete
```

### Data contract (proposed only, not implemented)

```json
{
  "source": "macrodroid_sms_bridge_v1",
  "event_id": "locally-generated-opaque-id",
  "occurred_at": "2026-10-18T10:40:00+05:30",
  "institution": "ICICI",
  "account_suffix": "0000",
  "direction": "debit",
  "amount_paise": 125050,
  "merchant": "DEMO MERCHANT",
  "transaction_ref": "optional-tokenized-reference",
  "confidence": "high"
}
```

The above values are **fabricated illustrative fields**. Raw SMS text, phone numbers, unmasked accounts and OTP values must not enter payloads, logs, ntfy or error reports. Prefer a replay-safe signed device token; keep the secret in protected device storage where practicable. Avoid query-string auth and unauthenticated exposed webhooks.

## Pilot gates

1. **Only 2-3 institutions initially**. At least 30 representative **fabricated** test messages per institution, with correct parsing of amounts, direction, masked accounts, repayments, refunds and transfers.
2. OTP and personal-message *zero-forward* tests including mixed transaction + OTP wording. Never send ambiguous text in order to salvage missing events.
3. Test power saving, boot/restart, mobile network gaps, offline retry, dual SIM, SMS burst, duplicate arrivals, device clock skew and Android/OxygenOS updates. Target 7 consecutive days with daily reconciliation, not just successful one-off trigger.
4. Verify successful transport acknowledgements and duplicate suppression; log counts and event hashes only. CSRF is not enough: use device authentication, TLS, replay protection and ingestion validation.
5. Privacy/security review of MacroDroid permissions, installed plugins, exception settings, secrets, audit/rotation, storage retention and server ACLs. Keep mechanism kill-switchable.
6. Release gate: owner explicitly enables the bridge. Bank CSV remains source of reconciliation truth until capture completeness is demonstrated.

## ntfy: recommended role

Use ntfy for signals such as "3 events awaiting review" or "ingestion disconnected" with **no transaction amount or personal details**. An ntfy-as-queue design would need explicit authenticated topics, encrypted payloads, bounded caching and durable receiver acknowledgements and provides little benefit over the direct authenticated API.

## Sources checked on 2026-10-18

- MacroDroid SMS trigger: https://macrodroidforum.com/wiki/index.php/Trigger:_SMS_Received
- MacroDroid HTTP Request action: https://macrodroidforum.com/wiki/index.php/Action:_HTTP_Request
- ntfy server cache/access control: https://docs.ntfy.sh/config/
- ntfy publish/cache behaviour: https://docs.ntfy.sh/publish/
- Android 16 foreground/background changes: https://developer.android.com/develop/background-work/services/fgs/changes
- Android background restrictions: https://developer.android.com/develop/background-work/background-tasks/bg-work-restrictions
- Google Play SMS policy + approved-exception categories: https://support.google.com/googleplay/android-developer/answer/10208820
