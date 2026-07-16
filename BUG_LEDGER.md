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

| BUG-003 | P2 | New Appointment dialog (owner calendar) | Owner → New Booking. The dialog (`glass-panel`, whose background is only white-gradient films over a non-compositing backdrop-blur → no solid base) lets the calendar behind (staff columns, appointment blocks, time labels) bleed through and clutter the form. Same class → also affects other Dialog-based modals. | s2-03, s3-01 | ✅ CLOSED | c2-newappt-fixed: dialog now opaque/crisp; c2-dashboard-regression: dashboard cards/charts unaffected (dark base invisible over the dark app bg) |

Confirmed WORKING with evidence (not bugs):
- Reschedule HAPPY PATH end-to-end: SAL-0039 moved July 16 09:00 → **July 20 15:00** in the DB after picking a slot outside the window; dialog closed, no error. (reschedule-09)
- Public booking page loads clean on 390px mobile, zero console errors. (client-01)
- FULL public booking end-to-end (mobile): service → Any-available staff → date → 30 slots → 9:00 AM → details → Confirm. "Booking confirmed!" screen + DB row SAL-…25 @ Jul 17 13:00 UTC, confirmed. Zero errors. (s1-07)
- Owner login → dashboard loads; nav trim VERIFIED (Marketing/Reviews/Gift Cards gone). (s2-02)
- "New Booking" opens the appointment dialog directly (/calendar?new=1). (s2-03)
- Walk-in client feature: "New" → first-name-only form ("Only a first name is needed to book") → Next advances to Step 2. Works. (s3-01)
- Cross-flow: the client created via public booking (QaTester) shows in the owner's client picker. (s2-03)

| BUG-004 | P3 | Transactional emails (branding) | All customer emails show "Sent by SAL Platform" in the footer and the SAL platform logo in the header, not the *business* the customer booked with ("SAL Salon & Spa"). White-label off-brand for the end client. | email-confirmation-desktop | OPEN (polish) | — |

Confirmed WORKING with evidence — emails (rendered from real template fns + screenshotted mobile/desktop):
- **Confirmation email**: clean SAL-branded layout, Service/Staff/Date/Reference card, working "Manage Your Booking" button, contact line. **Accented name "Éloïse François" renders correctly** (no mojibake). (email-confirmation-desktop/mobile)
- **Reschedule email**: previous time shown **struck-through**, new time prominent green, "View Booking Details" button — matches Fresha/Calendly standard. (email-reschedule-desktop)
- **Cancel email**: renders cleanly. (email-cancel-desktop)
- Note: emails aren't *delivered* locally (Resend key not set in the QA rig) — templates + content verified by rendering; live delivery is a production-only check.

- Client CANCEL flow: manage SAL-0053 → Cancel → email verify → confirm. Result page "Cancelled" + DB status=cancelled. (s4-03). Slot-freeing on open days covered by availability-metamorphic tests; the day I happened to test (Jul 19) is a closed Sunday, so 0 slots there is correct.

## Status log — cycle 2 (multi-scenario sweep)
Ran client full-booking + owner login + walk-in scenarios in the browser. All happy
paths PASS with evidence. Found BUG-003 (dialog transparency, same root cause class as
BUG-002 but on the shared glass-panel). Fixed at the shared DialogContent/glass-panel
level; verifying the dialog is clean AND the dashboard didn't regress from the
glass-panel base-color change.

## Status log
- (cycle 1) Stood up a local browser-testable full-stack env (local Postgres + seeded
  data + `next start`, driven by Playwright on localhost — the deployed preview was
  unreachable by the browser through the proxy). Fixed an `UntrustedHost` blocker
  (`trustHost: true` in the shared auth config) to make local auth work.
  Tested the **reschedule flow** first (owner-reported P0): the flow WORKS end-to-end,
  but a blocked reschedule showed no visible feedback (BUG-001) and the modal bled
  through (BUG-002). Both fixes applied; verifying in-browser next.
