# Budget IO by AyeBee | Phase 1 revised scope, exit criteria and test results

**Date: 2026-10-18 · Build: 0.2.0 · Synthetic data only · Phase 1 NOT formally signed off.**

**Current canonical verification:** strict TypeScript/Vite production build PASS; 15/15 domain tests PASS; 16/16 Chromium tests against production preview PASS. Real browser history, reload persistence and actual file uploads are verified. Local Firefox cannot start because of a missing Windows side-by-side runtime configuration; Linux CI includes Firefox. See `BUILD_VERIFICATION.md` for current execution evidence and limitations.

## Implementation

- Canonical application: React 19 / TypeScript + Vite, desktop-first dark theme, URL-driven filters, History API, clickable charts/KPIs and account/tag/category/merchant drill-down, transaction editor, report reconciliation, fabricated budgets.
- New manual entry page `src/App.tsx`, validated with `src/ingestion.ts`: amount paise, date/time, merchant, account, debit/credit, classification, category, subcategory, tags and note. Synthetic transaction added to ledger state; changes recalculate reports and charts. Reload stores *fabricated demo-only* rows in localStorage.
- New CSV preview page `src/App.tsx` + parser `src/ingestion.ts`: RFC4180 quoting, Axio/Budget IO header recognition, date/amount/time validation, conservative accounting mapping, preview classifications, potential duplicate warnings. Import is deliberately *dry-run only*, no commit.
- Sample file embedded is entirely fabricated. The original Axio sample provided for requirements remains **outside** application source/artifacts and was not copied into fixtures.
- Phase 2 SMS pilot is documented as a *conditional implementation option*, not completed.

## Mandatory acceptance gates

| Test | Required outcome | Status |
|---|---|---|
| AT-01 Category donut | Clicking Groceries shows expense transactions; rows and ring reconcile | Domain and canonical Chromium PASS |
| AT-02 Trend | Click August expenses and income; month filters match plotted totals | Domain and canonical Chromium PASS |
| AT-03 Progressive filters | Category -> merchant -> tag intersects previous conditions | Domain and canonical Chromium PASS |
| AT-04 Back/Forward | Visible Back, breadcrumbs, browser history restore state | Real native History API and reload: canonical Chromium PASS |
| AT-05 Exclusion and editing | Card payment/transfer excluded, edits recalculate and difference ₹0.00 | Domain and canonical Chromium PASS |
| **AT-06 required** | Create a fabricated transaction; validate inputs, preserve direction/class, update relevant charts, reload/edit and reconcile | Domain and canonical Chromium PASS |
| **AT-07 required** | Fabricated CSV upload/sample dry-run; parse, validate, separate classes; flag ambiguous/possible dupes/invalid; commit disabled | Domain and canonical Chromium PASS |

### Historical compatibility execution from the original archive

- `npm run test:domain`: **13/13 tests pass** (domain, navigation, manual entry validation, CSV preview logic).
- `python tests/offline-preview-smoke.py`: **5** existing Chromium scenarios pass, with injected fake History API.
- `python tests/input-offline-smoke.py`: manual creation + reconciliation + edit and CSV sample + local upload + malformed format scenarios pass; no JS page errors.
- Compatibility preview rebuild: `node tools/build-preview.cjs`. It uses a local React 16 compatibility adapter and is not a production or React 19 assurance artifact.

### Formal Phase 1 exit checklist

- [x] Seven gates specified and source implementation written.
- [x] Domain tests and compatibility-runtime browser smoke pass using fabricated records.
- [x] Product, build, data input and SMS-bridge architecture docs updated.
- [x] Install dependencies, generate lockfile, and pass canonical React 19 TypeScript/Vite build and Chromium browser suite. CI configured to use `npm ci`.
- [x] Test genuine browser Back/Forward, manual-entry reload persistence, and file-upload/validation with production React runtime.
- [x] Desktop/narrow viewport and chart keyboard smoke verification.
- [ ] Comprehensive accessibility/contrast review, owner UAT and Firefox/Linux CI confirmation.
- [x] Create the private GitHub repository; prepare production-build GitHub Actions workflow.
- [ ] Verify the remote CI run after publication; assess branch-protection availability and owner policy without claiming it is enabled.

## Subsequent phases

**Phase 2A:** Hostinger APIs, DB, authentication, immutable audit records, encrypted backups and restore drill, transaction persistence, full CSV migration/re-import/commit with deduplication and review. **Phase 2B option:** a strict, opt-in, tested MacroDroid structured-SMS event bridge before Android completion. Do not depend on it for financial completeness.

**Phase 3:** Kotlin/Jetpack Compose Android, local SMS parsing, protected queue, offline-first reconciliation and secure synchronization. **Phase 4:** categorization automation, persistent budgets, recurring items, forecast, hardening. **Phase 5:** hardened deployment and signed APK.

## Security boundary

Do not use real records or raw SMS in the prototype, static preview, public staging, git, analytics, logs or browser demo storage. Production migration only after Phase 2 security/backup gates.
