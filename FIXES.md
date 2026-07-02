# FIXES.md — Plain-English change log

*What changed and why, written so a non-coder can follow. Newest first. Each entry maps to a TASKS.md item.*

---

## P3 batch A · Polish & hardening (P3-2,3,6,7,8,9,16,18)

- **P3-2:** The public booking page no longer shows staff internal roles ("admin"/"staff") to clients; the role is also no longer sent to the browser at all.
- **P3-3:** Report summary cards now label the comparison correctly for the chosen range ("vs last week", "vs yesterday", etc.) instead of always "vs last month".
- **P3-6:** The onboarding "template services added" message now tells the truth — it says how many were added, or that they were already in your list.
- **P3-7:** The sidebar data endpoint now reports a real error instead of returning fake zeros, so an outage can't masquerade as "your shop has $0 and no clients."
- **P3-8:** Removed a dead, unreachable code branch in the search endpoint.
- **P3-9:** Review links now expire after 30 days (they were valid forever).
- **P3-16:** Form templates now reject service IDs that don't belong to your shop.
- **P3-18:** The two embed-code snippets now use the same URL parameter (were inconsistent).

## P2-4 / P2-11 / P2-12 / P2-17 / P2-18 · Billing toast, deletion trail, MCP oversell, real QR, Terms

- **P2-4:** The "Subscription active" message used to appear just from the URL after checkout, even if payment didn't actually go through. It now only shows when the subscription is genuinely active; otherwise it shows a "finishing up" message.
- **P2-11:** Account-deletion requests send a team email that can silently fail. The app now checks whether that email actually sent and, if not, writes a durable audit record so the request can't vanish unnoticed.
- **P2-12:** Closed the same group-overselling race (from P1-6) in the AI-integration tool — it now locks and re-counts seats inside the transaction. (Feature is off in beta; fixed anyway.)
- **P2-17:** The QR code in settings was a fake, non-scannable decoration and its Download/Print buttons always failed. It now shows a real scannable QR of your booking link, and Download/Print work.
- **P2-18:** The Terms of Service now describe the real "free to start, pay when you subscribe" model, matching the landing page (they previously described only the paid plan). *(Decision logged: aligned Terms to the beta reality — registration is free, charges begin at checkout.)*

## P2-7 / P2-8 / P2-9 / P2-10 / P3-4 / P3-5 · Onboarding wizard hardening

**Problems (setup wizard):** Adding two services with the same name crashed "Finish" with a raw database error and blocked setup (P2-7). If the final step half-failed, clicking Finish again kept erroring — the owner looked stuck until they reloaded (P2-8). Coming back to finish setup later silently reset your working hours to defaults and could overwrite what you'd saved (P2-9). You could set a closing time earlier than the opening time, making a day silently unbookable (P2-10). The hours save wasn't atomic, so a mid-save failure could wipe your hours (P3-4). And several errors showed raw technical text (P3-5).

**Fixes:** Duplicate service names are de-duplicated and the save skips duplicates, so Finish never crashes on them and is safe to retry. Resuming setup now loads your previously-saved hours instead of defaults. Reversed open/close times are rejected with a clear per-day message. Hours are saved in a single all-or-nothing transaction. Error messages are now plain and friendly. **Proof:** new tests cover dedupe, reversed-range rejection, and atomic write; full suite green.

## P2-5 · VIP clients are no longer excluded from VIP campaigns

**Problem:** Clients get tagged "VIP" (capitals), but the campaign audience matched "vip" (lowercase). The database treats those as different, so VIP-tagged clients were silently left out of "VIP" campaigns (unless they also had loyalty points).

**Fix:** The audience now matches "VIP" to align with how clients are actually tagged. Test updated to lock in the casing.

## P2-6 · Bookings can't slip onto a second same-day time-off block

**Problem:** If a barber had two time-off blocks in one day (say 9–10 and 2–3), the booking guard only checked one of them, so a client could be booked right on top of the other block.

**Fix:** The guard now checks every time-off block for the day. **Proof:** new test books onto the second of two blocks and confirms it's refused, while a slot that misses both is allowed.

## P2-13 · Waitlist entries can't reference another shop's records

**Problem:** The "add to waitlist" action didn't verify the client/service/staff it was given actually belonged to your shop — the API and AI paths already checked this, but the dashboard action didn't.

**Fix:** It now verifies every referenced record belongs to your business before saving, matching the other paths.

## P2-16 · Blocked dangerous links in the social-media settings

**Problem:** Instagram/Facebook/website links from settings are shown as real clickable links on your public booking page, but they were saved with no checking — so a `javascript:` link could have been stored and run in a visitor's browser (a classic injection).

**Fix:** Saving now rejects anything that isn't a normal web link (http/https) or a plain handle; dangerous schemes like `javascript:` and `data:` are refused. **Proof:** 3 new tests.

## P1-14 · Blocked recording "collected" online payments that were never charged

**Problem:** Through the API and AI-integration surfaces, someone could record a sale paid "online" and it would be logged as fully collected money — even though there's no real card charge behind an online payment in beta (that feature is switched off). That means fake revenue in the books. Card payments were already blocked this way; online wasn't.

**Fix:** "Online" is now rejected everywhere the same way "card" is (dashboard, API, and AI tool), plus a final backstop in the core money-recording code so no future path can slip a fake online payment through. Cash, gift card, and "other" still work. **Proof:** existing checkout tests updated to assert both card and online are refused; full suite green.

## P1-5 · Cancelled salons can't re-activate by re-opening an old payment link

**Problem:** A completed Stripe checkout link stays "successful" forever. The app re-activated a subscription whenever someone landed on the success URL — so a cancelled salon could regain full paid access just by re-visiting its old `?billing=success` link.

**Fix:** Before activating, the app now checks the *live* subscription status at Stripe. If the subscription is cancelled (or can't be confirmed), it refuses to activate. **Proof:** 4 new tests (cancelled → denied, unretrievable → denied, active/trialing → activated).

## P1-6 · Fixed a group-booking overselling race (API)

**Problem:** When two staff added the last seat to a group appointment at the same instant via the API, both checks passed and both were added — overselling the class. The dashboard already had this protected; the API route didn't.

**Fix:** The API route now takes a per-appointment lock, re-counts seats under it, and only then adds the participant — the same proven pattern the dashboard uses. The concurrency proof runs in the Phase-5 stress test.

## P1-7 · OAuth consent screen now shows where you're being sent

**Problem:** The "authorize this app" screen showed only the app's self-chosen name (which anyone can set) and never showed where the login code would actually be sent — a setup ripe for a phishing app named "SAL Official" that forwards your access elsewhere. (This surface is switched off in production, but fixed anyway.)

**Fix:** The consent screen now shows the real redirect destination and marks the app name as "unverified / self-reported."

## P1-8 · Booking-link field no longer hands owners dead links

**Problem:** The Online Presence settings had an editable "Custom Slug" box, but saving never stored it — yet the copied booking URL, embed code, and QR code all used the unsaved value. An owner could "change" their link, copy it, share it, and it would 404.

**Fix:** The booking link is now shown as fixed (read-only) so everything you copy always resolves. Changing the booking URL will be a proper dedicated flow later (it needs uniqueness checks and old-link handling).

## P1-9 · Support & legal emails now use a real address

**Problem:** Terms of Service, Privacy Policy, and the in-app Support button all pointed to `hello@salplatform.com` — a domain that isn't registered, so every message a customer sent would bounce into the void.

**Fix:** Replaced all of them with `support@meetsal.ai` (and the calendar-invite fallback with `noreply@meetsal.ai`). *(Decision logged: chose meetsal.ai since that's the live product domain; if you'd rather use a different inbox, it's a one-line change.)*

## P1-11 · Closed the "forgot the shop ID = see everyone's data" hole

**Problem:** About 30 reporting, review, marketing, membership, and waitlist data functions had a quiet fallback: if the shop ID was ever missing, they'd return data across *every* shop on the platform instead of erroring. Nothing exploited it today, but one forgotten argument in future code would leak another business's numbers.

**Fix:** Every one of those functions now refuses to run without a shop ID — it throws immediately instead of querying globally. All current screens already pass the ID, so nothing changes for real usage; the dangerous fallback is simply gone.

**Proof:** 7 new tests confirm the functions throw (and never touch the database) when the shop ID is missing. Full suite green.

## P1-4 / P2-14 · Review-request links now work; deleted the dead duplicate funnel

**Problem:** The "leave us a review" emails linked to `/r/<token>`, but the app's security gate didn't allow that address for logged-out people — so every client who clicked a review link hit a login wall. The whole review-collection feature was silently dead. Separately, there was a second, unused copy of the review system sitting in the codebase that (if ever switched on) would publish 1-star reviews with no spam protection.

**Fix:** Allowed the public review link through the gate (verified: a logged-out visit to a review link now loads the star form). Deleted the dead duplicate review code entirely so it can't become a trap later.

## P2-1 / P2-2 / P2-3 / P3-1 / P2-19 · Fixed misleading numbers on the dashboard and reports

**Problem (all seen live in the browser):** The dashboard showed "0000%" under Total Clients (a raw count wrongly rendered as a percentage), the Average Rating showed the ugly raw number "4.4375", and the Booking Channels chart legend showed "[object Object]" instead of channel names. The Reports revenue tab showed "+-100%" (a plus sign glued onto a negative number, with an up-arrow on a decline), and the Clients tab showed a hardcoded fake "+2.3%" retention change that wasn't computed from anything.

**Fix:** Counts now render as counts ("+1 new this month", no % sign), the rating rounds to one decimal ("4.4"), the pie chart legend shows real channel names, the revenue deltas show the correct single sign and correct arrow direction, and the fake retention delta was replaced with an honest label. Verified the dashboard fixes live.

## P1-1 / P1-2 / P1-10 · Settings & bundles: closed cross-tenant reads and added role gates

**Problem:** Three "back office" data functions were reachable as raw web endpoints that trusted whatever shop-ID the caller sent. In theory someone could read another shop's tax setup, message templates, or service bundles by passing a different ID. Separately, saving booking/payment/notification/online-presence settings only checked you were *logged in* — a plain staff member (not an admin) could rewrite deposit rules, tax rates, and templates.

**Fix:** The sensitive settings readers (payment, notification) and the bundles reader now authenticate and refuse any shop-ID that isn't your own. The four settings-save actions now require **admin** role, matching the main business-settings save. (The public-facing readers — social links and booking rules shown to clients on the booking page — were intentionally left open, since that data is displayed publicly anyway.)

**Proof:** 7 new tests: cross-tenant reads throw "Forbidden" with no DB query, and staff-role saves are denied with no write. Full suite green (565 tests).

---

## P0-1 · Removed team members can no longer keep access

**Problem:** When you removed a staff member, they kept full access to your shop's data for up to 7 days — until their login "cookie" happened to expire. Removal only hid them from the team list; it didn't actually lock them out.

**Fix:** The app now checks, on every single request, whether the person is *still* an active member of your shop right now — not just whether their login once said so. The moment you remove someone (or a barber is deactivated), their next click is denied. As a bonus, role changes (e.g. demoting an admin to staff) also take effect immediately instead of lingering in their session. This reused the same live-membership check the API and AI-integration paths already had, so all three doors are now locked the same way.

**Proof:** 8 new automated tests cover a removed staffer being denied, a deactivated owner being denied, and the correct fresh role being used. Full suite green (558 tests).
