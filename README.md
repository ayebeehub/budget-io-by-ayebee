# Budget IO by AyeBee | Phase 1 Interactive Desktop (v0.2.0)

**Status (18 October 2026):** Canonical TypeScript/Vite production build and **35/35 Chromium production-browser tests pass**, plus **16/16 domain/ingestion/navigation tests**. Manual creation, Axio CSV dry-run, charts, KPI drilldowns, native browser history, persistence and reconciliation are exercised with synthetic records. Firefox on this Windows host cannot launch because its side-by-side runtime configuration is missing; CI includes Firefox on Linux. Owner UAT and comprehensive accessibility review remain pending. No live SMS, account access, database or authentication is connected. See [build evidence](docs/BUILD_VERIFICATION.md).

**GitHub Actions verified:** [run #5](https://github.com/ayebeehub/budget-io-by-ayebee/actions/runs/39151001572) passes locked dependency installation, 16 domain tests, strict production build and **70/70 Chromium + Firefox browser cases** on code commit `3aa2f46`.

## What's new in v0.2.0

- Selecting any spending category switches the donut to **vendor spending percentages**. Vendor slices and legend entries open their underlying transactions; all current filters are respected and every vendor is listed.

- Nearby **Back** and **Consolidated view** controls on drilldown chart/list panels, plus a fixed navigation dock while scrolling. Consolidated view clears drilldown dimensions and keeps the original period.
- Responsive hamburger menu at phone/tablet widths (up to 900 px) exposes all seven pages; selection, Escape and outside click close it.

- Transactions → **+ Add Transaction**: creates validated fabricated debit/credit transactions with independently chosen financial classification, optional time, account, category/subcategory, tags and comments. Synthetic demo rows persist locally in browser storage and reconcile into existing clickable charts.
- Transactions → **Import CSV**: select a fabricated Axio/Budget IO CSV, preview parsing and validation, probable duplicates, ambiguous classifications and debit/credit/expense subtotals. Load/download a deliberately fabricated example. **Import commit is disabled until Phase 2.**
- Two *mandatory* new Phase 1 exit criteria and tests (AT-06, AT-07), in addition to the existing five interaction/navigation cases.
- Phase 2B conditional, opt-in MacroDroid SMS-capture bridge ADR; direct API preferred to ntfy for ingestion, after Phase 2A backend/security prerequisites.

## Source and build

- `src/App.tsx`: canonical React 19 desktop app and interaction flows.
- `src/domain.ts`: integer-paise accounting and deterministic fabricated ledger.
- `src/ingestion.ts`: manual validation and ephemeral CSV preview. Never commits uploaded data.
- `src/navigation.ts`: filter-aware browser navigation.
- `budget-io-preview.html`: historical **React 16 compatibility preview** in the original archive, excluded from Git. Use the canonical production build for review and testing.
- `docs/PRODUCT_SPEC.md`, `docs/PHASE1_PLAN.md`, `docs/DATA_INPUT_PLAN.md`, `docs/PHASE2_SMS_BRIDGE_DECISION.md`, `docs/REVIEW_CHECKLIST.md`: product, QA and architecture decisions.

## Canonical React build (requires packages)

```bash
npm ci
npm run build
npm run test:domain
npx playwright install chromium firefox
npm run test:ui
npm run preview
```

The lockfile records the verified dependency set. Playwright starts a separate production preview on port 4175 and refuses to reuse another server. `npm run dev` remains available for development. To run only the verified local Chromium project: `npm run test:ui -- --project=chromium`. GitHub Actions builds and tests both Chromium and Firefox and retains private reports and failure traces for 14 days.

## Historical offline compatibility checks

```bash
npm run test:domain              # 13 deterministic test cases pass
node tools/build-preview.cjs    # requires local global TypeScript + preview-only runtime
python tests/offline-preview-smoke.py # 5 existing browser scenarios pass
python tests/input-offline-smoke.py   # new manual/CSV browser scenarios pass
```

The offline checks above are historical results from the source archive, not the canonical verification performed in this workspace. The legacy builder uses paths from the old environment and is not a supported Windows build command. On actual deployment use production-built React, authenticated APIs, backed-up database and CSP/security controls.

## Security and hygiene

**Never commit original Axio files, exported real banking records, message bodies, OTPs, API keys, or plaintext database dumps.** `.gitignore` blocks CSV/db/secrets; synthetic fixtures live in TypeScript strings and tests only. LocalStorage is unencrypted and therefore **never acceptable for real banking records**. SMS before Android completion is proposed as a limited MacroDroid local-extraction-to-API pilot, not a guaranteed feature.
