# Budget IO v0.2.0 | Owner review and QA checklist

- [ ] Desktop dashboard conforms to approved dark theme screenshots.
- [ ] Click all chart segments/KPIs and confirm row-level evidence and reconciled sums.
- [ ] Progressive category -> merchant -> tag and account/date filtering; Back/Forward/breadcrumbs restore filters.
- [ ] Transactions -> **+ Add Transaction**: fabricate a debit expense, optional time, tags/comment; Save; find it in table and category charts.
- [ ] Repeat with a debit **card repayment**, debit investment and credit income; verify expense totals exclude card repayment and investment.
- [ ] Invalid amount/date/blank payee should not save; edit and reload a fabricated created row; verify only demo local storage is involved.
- [ ] Transactions -> **Import CSV** -> Load sample CSV: expect 6 candidate rows, 3 ready, 2 review (one ambiguous credit, one probable duplicate), 1 invalid (broken amount), and a disabled commit control.
- [ ] Upload a fabricated Axio CSV containing quoted commas/tags and an overlapping same-day purchase; ensure probable-duplicate flag but no silent discard.
- [ ] Navigate away or reload after preview: no imported candidate transaction was saved.
- [ ] Verify original five acceptance tests still pass.
- [x] Canonical React 19/Vite build, 15 domain tests and 16 production Chromium browser tests pass. See `BUILD_VERIFICATION.md`; owner checklist items above still require owner UAT.
- [ ] Confirm Linux CI (including Firefox); local Windows Firefox cannot launch because its side-by-side runtime configuration is missing.
- [ ] Complete comprehensive accessibility/contrast review and owner approval. Real-data production remains gated by Phase 2A security; SMS bridge remains Phase 2B.

**Do not provide genuine SMS or banking files to this Phase 1 prototype.**
