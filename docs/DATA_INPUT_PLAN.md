# Budget IO by AyeBee | Ingestion UX and accounting plan

**Updated 18 October 2026. Owner-approved change: manual create and CSV preview are mandatory Phase 1 completion gates.**

## Current build (v0.2.0) and future build

| Source | Phase 1 status | Phase 2 / production target |
|---|---|---|
| Synthetic manual transaction | **Implemented**: Add Transaction, edit, local synthetic demo persistence and instant reconciliation | Authenticated durable create/update and audit trail |
| CSV import preview | **Implemented**: fabricated Axio + Budget IO CSV formats, client-only parsing, candidate duplicate/review/invalid status, independent debit/credit/classification totals | Authenticated batch import, idempotent commit, original-file custody/expiry, audit log and rollback |
| Axio full-history migration | Test format with fabricated fixtures only; **NOT committed** | Real migration with duplicate review and safe rollback |
| Bank statement CSV | Only Budget IO and Axio schemas currently accepted | Per-institution format adapters and batch-level reconciliation |
| SMS | Not implemented in Phase 1 | Conditional MacroDroid direct-API structured-events pilot, then native Phase 3 |

## Manual entry user journey

Transactions -> **+ Add Transaction** -> complete transaction form -> validation -> Save -> show newly created record in transaction view -> drill down/edit -> reports and category charts update. Fields: date, optional time, merchant, positive rupees converted into integer paise, direction, accounting class, editable category/subcategory, synthetic demo account, multi-tags, comments. New rows are assigned synthetic-only IDs and stored in browser localStorage for demo continuity (NOT secure and NEVER a production-data persistence mechanism).

## CSV preview user journey

Transactions -> **Import CSV** -> upload a *fabricated test file* or **Load sample CSV** -> parse quoted CSV and column names -> reject unsupported schemas -> validate every row -> calculate debit/credit/expense candidate subtotals -> display statuses: `ready`, `review`, `invalid` -> show possible duplicate warnings and ambiguous credit classifications -> **Commit disabled**. No CSV row enters the ledger, localStorage, backend or service. Test users must not upload genuine private files in the demo.

### Preview accounting rules

- Priority classify card repayments, savings, investments and own-account transfers independently of expense flags. An Axio `EXPENSE=Yes` investment is still an investment, not spending.
- Do not treat every credit as income; unclassified credits require review.
- Same account/day/payee/amount/direction is a **possible duplicate only**, not safely removable. Import file overlap and true repeated purchases require review and source-specific IDs in Phase 2.
- Reject missing dates/accounts/payees/category, invalid dates and amounts, unsupported schemas and broken CSV syntax. Preview limits 5MB and 10,000 rows to avoid browser freezes.
- Aggregate previews across parsed candidate rows; counts and subtotals are **not** posted balances or reconciled migration results.

## Secure Phase 2 endpoint / importer requirements

- Owner authentication, isolated backend, HTTPS, transaction-scoped DB commits, at-rest encryption/backup protection, import batch IDs, provenance, duplicate-resolution UI, tamper-resistant audit records, permissioned row changes, re-import replay handling.
- Show approved / rejected / needs-review and exact financial subtotals per committed batch; prevent partial commits and provide rollback/recovery.
- Implement bank-specific adapters only after obtaining and verifying actual formats; CSV preview parsers must not infer unknown columns or sign conventions.
- Add the *optional and reversible* SMS capture pilot as Phase 2B after Phase 2A security prerequisites. See `PHASE2_SMS_BRIDGE_DECISION.md`. MacroDroid is not necessary for manual entry or CSV import.
