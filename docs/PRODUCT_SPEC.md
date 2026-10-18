# Budget IO by AyeBee | Product specification (v0.2.0)

**As of 18 October 2026.** Private, single-owner, offline-first personal finance app with Android, desktop web, self-hosted Hostinger backend, Axio migration, transaction analytics, budgets, reminders, and eventual SMS capture. "Ledger Private" was the working title.

## Product principles

1. Financial direction (`debit` / `credit`) is orthogonal to classification (`expense`, `income`, `refund`, `cashback`, `transfer`, `savings`, `investment`, `card_payment`). No forced debit=expense, credit=income mapping.
2. Every financial chart, trend point, amount KPI, category, merchant, tag and account can drill into reconciled underlying transactions with Back, history and breadcrumb retention.
3. Gross expense charts **exclude** credit-card settlement, internal transfers, savings and investments. Refunds and cashback remain separately reported. A net-spend policy must be defined before launch.
4. Data remains private; no real bank/SMS data in source, staging previews or publicly accessible demos. Store only structured financial transaction fields, not raw personal SMS/OTP content.
5. Manual entry and import are first-class workflows, not fallbacks when automation breaks.

## Phase 1 required functionality

- Desktop React + TypeScript navigation, charts, filter intersections and transaction editing with synthetic data.
- Owner UX revision: every drilldown has Back and Consolidated view controls near chart/list cards, plus an always-visible drilldown navigation bar. Back removes one history level; Consolidated view clears drilldown dimensions in one action while retaining the date range from before the first drill. Filtered direct links also have an exit without requiring saved history.
- At widths up to 900px, a sticky header hamburger opens the full workspace menu. Selection, Escape and outside click dismiss it; desktop navigation remains visible above 900px. Opening focuses the first menu item and keyboard dismissal returns focus to the toggle.
- Category spending donuts switch to vendor shares whenever a category is selected, on Home, Transactions and Analytics. Percentages use gross expense amounts within all active filters, exclude refunds and non-expenses, show every vendor in the legend, and support pointer/keyboard merchant drilldown. Unfiltered views retain category shares; empty results show the existing empty state. Displayed vendor percentages round to one decimal place.
- **NEW MANDATORY EXIT GATE: manual transaction creation**: date/time (time optional), merchant, amount in integer paise, direction, class, category/subcategory, account, tags and comments. Validate required fields and valid dates/amounts, show resulting transaction, update all financial totals and category drill-down, and support return/back navigation.
- **NEW MANDATORY EXIT GATE: CSV import preview**: accept local CSV for *fabricated testing only*, Axio and Budget IO export schemas, quoted data, format/required-column checks, valid rupee/date/time conversion, class mapping, ambiguous classification review, candidate duplicates (including repeated same-day transactions), row status and debit/credit/expense subtotals. **Preview only; persistence/commit disabled until Phase 2.**
- Full five chart-interaction/navigation acceptance tests remain binding; new tests AT-06/AT-07 added. Validate on production React 19/Vite build before claiming Phase 1 is signed off.
- Local browser storage may contain *fabricated demo edits only*. No authentication/backend at this stage.

## Phases and explicit boundaries

| Phase | Core deliverable | Data acquisition |
|---|---|---|
| Phase 1 | Desktop UI, synthetic ledger, charts, manual transaction entry, CSV dry-run | Synthetic manual entries, synthetic test CSV previews |
| Phase 2 | Secure backend/API/DB/auth/audit, idempotent import commit, encrypted backups | Real Axio and supported statement imports after security gates; optional MacroDroid SMS pilot behind owner opt-in |
| Phase 3 | Native Kotlin/Compose Android with encrypted local database and secure sync | On-device SMS extraction, durable offline queue, review, native capture |
| Phase 4 | Rules/merchant learning, budgets, subscriptions, forecasts, security and recovery | Shared source/provenance and reconciliation |
| Phase 5 | Hostinger hardening and signed APK distribution | Production rollout and verification |

## Pre-Android SMS bridge decision

**Phase 2B optional experimental track, after Phase 2A backend/security prerequisites.** Pilot MacroDroid SMS trigger, local extraction with strict financial-message allowlist / OTP exclusion, encrypted HTTPS POST of **structured financial event** to owner-authenticated Budget IO ingestion endpoint. Direct API preferred over ntfy for transactional ingestion. ntfy may be used for generic operational notifications, not raw SMS/event storage. Backend must enforce replay resistance, device authentication, rate limits, idempotent ingestion, source history and review. No silent ingestion of unverified values. See `PHASE2_SMS_BRIDGE_DECISION.md`.

## Definition of done and unresolved decisions

Canonical strict TS/Vite compilation, all 70 Chromium/Firefox production-browser cases, native history/back/forward and reload persistence now pass in GitHub Actions; see `BUILD_VERIFICATION.md`. UI, tests and docs **do not themselves sign off Phase 1**: comprehensive accessibility/contrast review and owner UX approval remain pending. Backend security design, full-history import commit, message capture reliability and regulated-distribution review remain separate gates.
