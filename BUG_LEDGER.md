# SAL — BUG LEDGER

Relentless QA loop. Nothing is "ready." A bug is only CLOSED when a verified-fixed
screenshot proves it. Evidence lives in `qa-evidence/` (screenshots) with paths below.

Severity: **P0** = a flow is broken · **P1** = wrong data / permissions ·
**P2** = ugly UI / broken layout · **P3** = polish.

## Environment for QA
- Local full-stack run: app on `http://localhost:3000`, local Postgres (docker-less,
  `postgres` user, port 55432), seeded demo data (`admin@sal.app` / `password`).
- Browser evidence via Playwright against localhost (no proxy, no protection wall).
- The deployed preview could not be driven by a browser (proxy/TLS reset), so all
  browser evidence is captured against the identical local build.

## Ledger

| # | Sev | Area | Steps to reproduce | Screenshot | Status | Verified-fixed screenshot |
|---|-----|------|--------------------|-----------|--------|---------------------------|
| BUG-001 | P1 | Reschedule (client, mobile) | Manage a booking inside the change window (SAL-0014), Reschedule → pick date+time → "Confirm New Time". Rejection message ("Online changes close 24h before…") renders at the BOTTOM of the scroll area, below the slots and behind the sticky button footer → on mobile the user sees NOTHING happen. Looks broken. | reschedule-07/08 | ✅ CLOSED | reschedule-fixed-01: red error now shows above the buttons AND a toast fires — both read the reason, no scrolling needed |
| BUG-002 | P2 | Reschedule + Cancel dialogs | Open the reschedule/cancel modal. Panel (`glass-popover`, 0.88 alpha, inline not portal'd → blur not compositing) lets page text ("Service Details", "$120.00", "Location"…) bleed through and overlap the calendar. | reschedule-02/08 | ✅ CLOSED | reschedule-fixed-02: panel raised to 0.96 + backdrop to 0.80 — readable bleed-through eliminated (faint edge ghosting only, acceptable) |

Confirmed WORKING with evidence (not bugs):
- Reschedule HAPPY PATH end-to-end: SAL-0039 moved July 16 09:00 → **July 20 15:00** in the DB after picking a slot outside the window; dialog closed, no error. (reschedule-09)
- Public booking page loads clean on 390px mobile, zero console errors. (client-01)

## Status log
- (cycle 1) Stood up a local browser-testable full-stack env (local Postgres + seeded
  data + `next start`, driven by Playwright on localhost — the deployed preview was
  unreachable by the browser through the proxy). Fixed an `UntrustedHost` blocker
  (`trustHost: true` in the shared auth config) to make local auth work.
  Tested the **reschedule flow** first (owner-reported P0): the flow WORKS end-to-end,
  but a blocked reschedule showed no visible feedback (BUG-001) and the modal bled
  through (BUG-002). Both fixes applied; verifying in-browser next.
