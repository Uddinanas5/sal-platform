# SAL Bug Log

Append-only log from autonomous tester agents. Coder agent reads from here and ships fixes, then marks entries `[FIXED in <commit/PR>]`.

Format per entry:

```
## [<timestamp>] <severity: P0/P1/P2/P3> <area> — <one-line summary>
- **Flow**: <what the agent was trying to do>
- **Expected**: <what should have happened>
- **Actual**: <what did happen — include status code, error message, screenshot path>
- **Repro**: <exact request / steps>
- **Status**: open | fixed | wontfix
```

---

## [2026-05-21] P2 api/availability — Raw Prisma error string leaked to anonymous callers on 500
- **Flow**: Anonymous client (no session, no API key) hits public `/api/availability` with valid-shape but nonexistent `serviceId`. Endpoint reaches `prisma.service.findUnique`, query throws, catch block forwards `error.message` to response body.
- **Expected**: Generic `{ "error": "Failed to check availability" }` (or similar) with no ORM/driver detail. Real error logged server-side only.
- **Actual**: HTTP 500 with body `{"error":"\nInvalid \`prisma.service.findUnique()\` invocation:\n\n\nError opening a TLS connection: The server does not support SSL connections"}`. Leaks (a) ORM identity, (b) exact Prisma method invoked, (c) underlying driver error including TLS state. Same `error instanceof Error ? error.message : ...` pattern exists in `src/app/api/bookings/route.ts` — likely systemic across other route handlers, worth a sweep.
- **Repro**:
  ```bash
  curl -s "http://localhost:3000/api/availability?serviceId=fake&locationId=fake&date=2026-05-22"
  ```
- **Source**: `src/app/api/availability/route.ts:220-227`
- **Status**: [FIXED in 5c0eb0f + 8f6d457] — catch blocks no longer forward `error.message`; public api routes are now wrapped in `withSafeErrors` which returns a generic `{ "error": "Internal server error" }` and logs the real cause server-side. Verified live on agents/coder preview 2026-05-23: invalid params 400 cleanly, no Prisma/ORM strings in response body.

## [2026-05-21] P3 book/[businessSlug] — Public booking page has no error boundary; transient DB errors render generic Next error page mid-booking
- **Flow**: Anonymous customer navigates to `/book/<slug>`. Server component calls `prisma.business.findFirst()` (twice — once in `generateMetadata`, once in `PublicBookingPage`) with no try/catch. If Prisma throws (DB blip, pool exhausted, transient TLS, etc.), the unhandled error bubbles up.
- **Expected**: A friendly "We're having trouble loading this booking page — please try again in a moment" fallback that keeps the customer on the salon's branded page. Error reported to server-side logging.
- **Actual**: In dev (currently reproducible — local DB unreachable, TLS error), the page returns HTTP 500 with the full Prisma stack trace + absolute filesystem paths (`/Users/anasuddin/sal-platform/node_modules/...`) embedded in the rendered HTML. In production this would render Next's generic global error page with no salon branding and no retry affordance, abandoning a paying customer mid-funnel.
- **Repro**:
  ```bash
  # With DB unreachable / any transient prisma failure:
  curl -s -L -w "%{http_code}\n" http://localhost:3000/book/demo-salon
  # → 500, body contains "PrismaClientKnownRequestError" + node_modules path
  ```
- **Suggested fix**: Wrap the two `prisma.business.findFirst` calls in try/catch and on failure return `notFound()` (or better, render a dedicated `BookingErrorBoundary` client component with retry). Same pattern applies to the other prisma calls further down the file (`location.findFirst`, business-hours fetch, etc.). Consider a Next `error.tsx` co-located in `src/app/book/[businessSlug]/` as a catch-all.
- **Source**: `src/app/book/[businessSlug]/page.tsx:14-46`
- **Status**: [FIXED in a78ecce] — page.tsx now catches Prisma connection errors and rethrows as ServiceUnavailableError; new `book/error.tsx` renders branded retry UI. `/api/health` also categorizes failures and redacts in prod.

## [2026-05-22] P0 infra/db — Local Postgres unreachable; all DB-backed routes 500 on localhost:3000
- **Flow**: Filed on behalf of Tester (no write perms on bug-log). Hitting `/api/health` and any DB-backed route on `localhost:3000` (the prod-mode app, not the `:3001` agent dev server).
- **Expected**: 200 from `/api/health`, DB-backed pages render.
- **Actual**: `/api/health` returns 503. Direct Prisma calls error with `code: ECONNREFUSED` on `127.0.0.1:5432`. `.env` `DATABASE_URL` points at `localhost:...` but no Postgres process is bound to 5432 (verified: no listening socket).
- **Repro**: `curl -s -w "%{http_code}\n" http://localhost:3000/api/health` → 503.
- **Likely cause**: env/infra, not code. Either (a) local Postgres should be running and isn't, (b) `.env` should point at Supabase pooler not `localhost`, or (c) Supabase project paused. Needs Anas to confirm.
- **Status**: open — env issue, not a code fix. Logging as P0 because every DB-backed route on `:3000` is down.

