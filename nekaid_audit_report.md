# NekaID Production Audit Report

**Date:** 2026-06-19  
**Auditor:** Claude Sonnet 4.6 (read-only audit, no files were changed)  
**Codebase:** `c:\Users\metod\myapp`  
**Framework:** Next.js 16.2.3, React 19.2.4, Supabase, Vercel  

---

## 1. File Sizes

Files flagged by size (threshold: 500+ lines warrants review; 1500+ is critical):

| File | Approximate Lines | Severity |
|---|---|---|
| `app/agency/page.tsx` | ~2544 | CRITICAL |
| `app/company/page.tsx` | ~1600+ | CRITICAL |
| `app/agency/components/GroupMessages.tsx` | ~676 | WARNING |
| `app/agency/TimesheetSection.tsx` | ~672 | WARNING |
| `app/agency/components/AgencyTeamModal.tsx` | ~599 | WARNING |
| `app/agency/components/AgencyDashboardMenu.tsx` | ~321 | OK (borderline) |
| `app/api/agency/timesheets/[id]/send/route.ts` | ~160 | OK |
| `app/api/billing/webhook/route.ts` | ~186 | OK |

`app/agency/page.tsx` is the single most dangerous file in the codebase. It contains ~35 useState calls, an inline `PlacementOverview` sub-component, inline `getComplianceStatus` utility, all placement/client/worker modals, and all data-fetching logic for the entire agency dashboard.

`app/company/page.tsx` is similarly monolithic and contains visitor management, induction requests, attendance register, and manual sign-in all in one file.

---

## 2. Critical Bugs

### BUG-01 — Group chat access blocked for agency team members (BREAKING FEATURE)

**File:** `app/api/group-chats/[id]/messages/route.ts`

The `verifyAccess` function checks `chat.agency_id === user.id`. Agency team members (who joined via the team join flow) have a different `user_id` than the agency owner whose `id` was stored in `chat.agency_id`. This means all non-owner agency team members receive 403 Forbidden when trying to access any group chat. The correct check would be to look up the team member's `organisation_id` and compare it against the owner's organisation.

### BUG-02 — VAPID_SUBJECT hardcoded in group chat message route

**File:** `app/api/group-chats/[id]/messages/route.ts`

The VAPID subject is hardcoded as `'mailto:hello@nekaid.co.uk'` instead of reading from `process.env.VAPID_SUBJECT`. Every other push notification route reads it from env. This means changing the contact email requires a code deploy.

### BUG-03 — autoSignOut client-side library uses anon Supabase client directly

**File:** `app/lib/attendance/autoSignOut.ts`

This library reads and writes `site_attendance` using the imported anon `supabase` client from `app/lib/supabase.ts`. It is triggered from the company dashboard client component. There is no server-side auth validation — any code that calls `runEndOfDayAutoSignOut(companyId)` can pass any arbitrary `companyId` and the function will sign out workers for that company. The server-side cron (`/api/auto-signout`) has the same logic rewritten correctly with the admin client. The client library is redundant and unsafe.

### BUG-04 — Organisation invite URL hardcoded as production domain

**File:** `app/api/organisations/invite/route.ts`, line 93

```ts
const inviteUrl = `https://nekaid.co.uk/join?token=${invite.token}`
```

Every other magic link in the codebase uses `process.env.NEXT_PUBLIC_SITE_URL`. This invite link is always sent pointing to production, so invite links generated in staging/development environments will break.

### BUG-05 — delete-account does not cancel Stripe subscription

**File:** `app/api/delete-account/route.ts`

The account deletion flow deletes qualifications, saved_workers, scan_logs, workers, profile, and the auth user. It does not cancel the Stripe subscription or delete the `subscriptions` table row. After account deletion, the user's subscription remains active in Stripe and the orphaned row remains in the database, causing billing to continue after account deletion.

### BUG-06 — Timesheet public token route uses module-level service role client

**File:** `app/api/timesheet/[token]/route.ts`

The module-level `supabaseAdmin` is created with the service role key. This route is explicitly public (no auth). While the token-based protection is intentional by design, a leaked `submit_token` exposes: worker full name, client name, site name, and all timesheet entry hours. Token values are UUIDs (sufficient entropy) but there is no token expiry and no rate limiting on this endpoint.

---

## 3. Duplicate / Copy-Pasted Logic

### DUPLICATE-01 — `getAgencyId` helper copied 6+ times

The following files all contain an identical or near-identical `getAgencyId` async function:

- `app/api/agency/clients/route.ts`
- `app/api/agency/clients/[clientId]/placements/route.ts`
- `app/api/agency/placements/route.ts`
- `app/api/agency/timesheets/route.ts`
- `app/api/agency/timesheets/[id]/route.ts`
- `app/api/agency/timesheets/[id]/send/route.ts`

The function creates an anon Supabase client scoped to the user's token, calls the `get_my_agency_owner_id` RPC, and returns the owner's user ID. This is 15–20 lines of repeated code across six files. A shared utility at `app/api/lib/getAgencyId.ts` would eliminate all duplication.

There is a slight variation: `clients/route.ts` also calls `getUser()` before the RPC for a null check, while the timesheet routes skip the intermediate `getUser` call and only check the RPC result. This means the two variants can behave differently under edge cases (e.g., user exists but has no agency).

### DUPLICATE-02 — `getAdminClient()` + `getUser()` pattern duplicated in 8 routes

The team and organisation routes all define their own local `getAdminClient()` and `getUser()` helper functions:

- `app/api/agency/team/code/route.ts`
- `app/api/agency/team/join/route.ts`
- `app/api/agency/team/members/route.ts`
- `app/api/agency/team/members/[id]/route.ts`
- `app/api/agency/team/leave/route.ts`
- `app/api/organisations/route.ts`
- `app/api/organisations/invite/route.ts`
- `app/api/organisations/invite/accept/route.ts`
- `app/api/organisations/members/[id]/route.ts`
- `app/api/organisations/sites/[userId]/route.ts`

These are byte-for-byte identical across all files. Both patterns (`getAgencyId` and `getAdminClient`/`getUser`) should be extracted to a shared `app/api/lib/` directory.

### DUPLICATE-03 — `mapWorkerRow` function defined in 3+ page files

The function mapping database snake_case worker rows to camelCase Worker types is independently defined in:

- `app/scan/[id]/page.tsx`
- `app/worker/page.tsx`
- `app/worker/[id]/page.tsx`

Each version has slightly different fields included. This creates a maintenance risk where adding a new field to the workers table requires finding and updating three separate mapping functions.

### DUPLICATE-04 — `formatDate` / `getStatus` utilities duplicated across pages

Date formatting helpers (`formatDate`, `getStatus`, `getExpiryStatus`) are independently defined in at least 4 page files. These should live in a shared `app/lib/utils.ts`.

### DUPLICATE-05 — Supabase URL and anon key hardcoded in `app/lib/supabase.ts`

```ts
const supabaseUrl = 'https://abeveiimcmroceakyvli.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

The anon key is a long-lived JWT that is safe to expose on the client (it is designed to be public). However, hardcoding it in source control is bad practice: rotating it requires a code change and deploy instead of a Vercel environment variable update. The fix is `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 4. Performance Bottlenecks

### PERF-01 — N+1 photo URL signing in agency and company dashboards

**Files:** `app/agency/page.tsx` (lines ~453–462), `app/company/page.tsx` (lines ~708–717)

Both pages loop over all loaded workers and call `supabase.storage.createSignedUrl()` sequentially for each photo and face photo:

```ts
for (const w of mapped) {
  if (w.photo && !w.photo.startsWith('http')) {
    const { data: photoSigned } = await supabase.storage
      .from('worker-photos').createSignedUrl(w.photo, 3600)
  }
  if (w.facePhoto && !w.facePhoto.startsWith('http')) {
    const { data: faceSigned } = await supabase.storage
      .from('worker-photos').createSignedUrl(w.facePhoto, 3600)
  }
}
```

For 50 workers with 2 photos each, this is 100 sequential API calls on page load. These should be parallelised with `Promise.all` and ideally the signed URL generation should be moved to the API route so it happens server-side.

### PERF-02 — Auto-signout cron loads ALL attendance records with no date filter

**File:** `app/api/auto-signout/route.ts` (line ~71)

```ts
const { data: attendanceRows } = await supabaseAdmin
  .from('site_attendance')
  .select('id, company_id, worker_id, site_id, status, created_at')
  .eq('company_id', company.id)
  .order('created_at', { ascending: false })
// No .limit() or .gte() date filter
```

This loads the entire `site_attendance` table for each company to determine which workers are currently signed in. For a company with 12 months of attendance data, this could be tens of thousands of rows per company. The cron runs every 30 minutes for every company. The fix is to add a date filter: `.gte('created_at', startOfToday)` — only today's records are needed to determine current status.

The same pattern exists in `app/lib/attendance/autoSignOut.ts` (the client-side variant of this logic).

### PERF-03 — Morning reminder cron: no date filter on attendance query

**File:** `app/api/send-morning-reminders/route.ts` (lines 90–95)

Similarly, the morning reminder cron fetches all attendance rows for each company's workers with no date filter, just to find their latest status. A `.gte('created_at', startOfToday)` filter would reduce this significantly.

### PERF-04 — Messages inbox has no pagination

**File:** `app/api/messages/inbox/route.ts`

The inbox route loads ALL messages for the user with no `.limit()`. As message history grows, this will become increasingly slow and load unnecessarily large payloads to the client.

### PERF-05 — Group chat messages have no pagination

**Files:** `app/api/group-chats/[id]/messages/route.ts`, `app/worker/components/WorkerGroupMessages.tsx`, `app/agency/components/GroupMessages.tsx`

All group chat message loading fetches the complete message history for a chat. For long-running placements this will become a significant payload. A limit of 50–100 most recent messages with infinite scroll would be the correct pattern.

### PERF-06 — Agency dashboard fetches ALL workers, ALL placements, ALL clients

**File:** `app/agency/page.tsx`

The `loadData` function fetches all agency workers, all placements, and all clients in parallel with no limit. This works when an agency has 20 workers but will degrade at scale. The only place in the codebase with a limit is `app/company/page.tsx` which uses `.limit(50)`.

### PERF-07 — N+1 entry updates in timesheet PATCH

**File:** `app/api/agency/timesheets/[id]/route.ts` (lines 51–63)

The PATCH handler loops over `body.entries` and issues a separate UPDATE per entry:

```ts
for (const entry of body.entries) {
  await supabaseAdmin.from('timesheet_entries').update({...}).eq('id', entry.id)
}
```

For a 7-day timesheet this is 7 sequential round-trips. PostgreSQL's `CASE WHEN` or an upsert with an array could replace this with a single query.

### PERF-08 — Check expiring credentials cron has O(alerts × companies × managers) loop

**File:** `app/api/check-expiring-credentials/route.ts`

The cron iterates: for each expiring credential → for each company that has saved that worker → for each manager of that company → look up push subscriptions → send notification. The push subscription lookup is done individually per manager inside the loop, generating a large number of small queries. Batching the user ID collection and doing a single `.in()` query would reduce round-trips significantly.

### PERF-09 — N+1 real-time message resolution in GroupMessages

**File:** `app/agency/components/GroupMessages.tsx`

The real-time subscription handler resolves sender names per incoming message by making individual Supabase queries for each new message. For active group chats with rapid message volume, this creates bursts of N individual queries.

---

## 5. TypeScript / Type Safety

### TS-01 — Strict mode disabled

**File:** `tsconfig.json`

```json
"strict": false
```

TypeScript strict mode is off. This disables: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`. The codebase can compile with implicit `any` and unchecked null access without any warnings. This is a major regression risk and the single most impactful change that could be made to improve type safety.

### TS-02 — Widespread use of `any`

Multiple files use `any` typed state and function parameters:

- `app/agency/page.tsx`: `clients: any[]`, `editingClient: any | null`, `editingPlacement: any`, `clientPlacements: Record<string, any[]>`
- `app/company/billing/page.tsx`: `subscription: any`
- `app/agency/billing/page.tsx`: `subscription: any`
- All API routes use `t: any`, `w: any`, `r: any` inline in `.map()` calls

With strict mode off, these do not even produce warnings. Typed Supabase types (generated via `supabase gen types typescript`) would eliminate most of these.

### TS-03 — `params` typed as `Promise<{...}>` but treated inconsistently

In dynamic API routes, `params` is typed as `Promise<{ id: string }>` and properly awaited in most routes. However the pattern is applied differently — some routes destructure immediately, some use intermediate variables — creating cognitive overhead when reading the code.

### TS-04 — `Record<string, any>` used for timesheet update payload

**File:** `app/api/agency/timesheets/[id]/route.ts`, line 66

```ts
const tsUpdate: Record<string, any> = {}
```

This allows arbitrary keys and values to be passed to Supabase's `.update()` method. A typed interface would prevent accidentally updating wrong columns.

---

## 6. Security Issues

### SEC-01 — Supabase anon key hardcoded in source control

**File:** `app/lib/supabase.ts`

The Supabase anon key is committed to the repository as a string literal. While the anon key is intentionally public (Row Level Security is the protection layer), its rotation requires a code change and deploy. It should use `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` to allow rotation via Vercel environment variables without touching source code.

The service role key is correctly stored only in server-side environment variables and is never exposed to the client.

### SEC-02 — Worker bank and NI details accessible via QR scan page with anon client

**File:** `app/scan/[id]/page.tsx` (lines 311–313)

When a company or agency user is authenticated, the scan page fetches the worker with `select('*')` for agency users, which includes `bank_name`, `bank_account_number`, `bank_sort_code`, and `ni_number`. These are fetched directly from the anon Supabase client in the browser. Protection relies entirely on Supabase RLS policies. If an RLS policy is misconfigured, bank details would leak. These fields should ideally be excluded from the public scan view and accessed only through dedicated, authenticated API routes that explicitly list the columns returned.

### SEC-03 — `saveStatus` and `saveNotes` write directly to Supabase without API validation

**File:** `app/agency/page.tsx`

The agency dashboard writes worker status notes directly from the client via the anon Supabase client to a Supabase table. There is no server-side ownership check — a malicious user who obtained another agency's worker ID could potentially update their status/notes if RLS is not correctly enforced. These writes should go through an API route that validates agency ownership.

### SEC-04 — Invite URL hardcoded to production (see BUG-04)

This is both a bug and a security issue in staging/testing environments where test invites would redirect to production.

### SEC-05 — Stripe price IDs hardcoded in source

**File:** `app/lib/stripe.ts`

All 16 Stripe price IDs are hardcoded as string literals. This is not a direct security vulnerability but means that if prices are archived and replaced in Stripe (common during plan restructuring), it requires a code deploy to update them. These should be environment variables.

### SEC-06 — No rate limiting on any API route

None of the API routes implement rate limiting. The public timesheet token endpoint (`/api/timesheet/[token]`) is particularly exposed — an attacker could enumerate UUID tokens. The push subscription endpoint (`/api/push-subscribe`) could be used to spam subscriptions. Vercel's middleware or a service like Upstash Redis would be appropriate for rate limiting.

### SEC-07 — XSS risk in timesheet email HTML

**File:** `app/api/agency/timesheets/[id]/send/route.ts` (lines 114–117)

Worker name, client name, and site name are interpolated directly into the HTML email body:

```html
<tr><td>Worker:</td> <td>${workerName}</td></tr>
<tr><td>Client:</td> <td>${clientName}</td></tr>
<tr><td>Site:</td>   <td>${siteName}</td></tr>
```

If any of these values contain HTML characters (e.g., a client name of `<script>alert(1)</script>`), the email HTML will be malformed. While most email clients strip scripts, the correct fix is to HTML-escape all interpolated values before insertion.

---

## 7. Scalability Risks

### SCALE-01 — Auto-signout cron will collapse under load

**File:** `app/api/auto-signout/route.ts`

The cron currently:
1. Fetches ALL companies
2. For each company: fetches ALL their `site_attendance` rows (no date filter)
3. For each worker still signed in: makes an additional point query + an INSERT

For a platform with 100 companies each with 6 months of attendance history, this could be loading tens of millions of rows per cron run. The cron runs every 30 minutes. Adding a `gte('created_at', yesterday)` filter on step 2 would reduce data volume by 99%+.

### SCALE-02 — `app/agency/page.tsx` loads all data on mount

The agency dashboard loads all agency_workers, all agency_placements, and all agency_clients on every page mount. For a large agency with 500 workers and 200 clients, this is a multi-megabyte payload on every dashboard load. Pagination or virtual scrolling is required before the agency grows beyond ~100 workers.

### SCALE-03 — `app/company/page.tsx` has a 50-worker hard limit with no pagination UI

The company dashboard fetches `.limit(50)` workers. When a company has >50 workers, workers beyond the first 50 will silently not appear. There is no pagination UI or "load more" button. This limit is invisible to the user.

### SCALE-04 — Morning reminders cron loads all attendance to determine sign-in status

**File:** `app/api/send-morning-reminders/route.ts`

The same attendance query pattern as the auto-signout cron: for each company in the reminder window, it loads ALL their attendance rows to find the latest status per worker. A date-filtered query (today only) would resolve this.

### SCALE-05 — No connection pooling strategy

All API routes create Supabase admin clients inline or at module level. With Vercel's serverless functions, each invocation may create a new connection. For high-traffic endpoints, this could saturate the Supabase connection pool. A connection pooler (Supabase's built-in PgBouncer or Supavisor) should be configured.

### SCALE-06 — Real-time subscriptions leak when component unmounts during async work

Several pages subscribe to real-time Supabase channels in a `useEffect`. The subscription cleanup function calls `supabase.removeChannel(channel)`, but if the channel setup code is asynchronous and the component unmounts before the subscription completes, the cleanup runs before the channel is established. The cleanup is correct in most cases but a ref-based guard (like `isMounted`) would prevent edge case leaks.

---

## 8. Maintainability Issues

### MAINT-01 — `app/agency/page.tsx` at ~2544 lines is unmaintainable

This single file is responsible for:
- Agency dashboard layout and hero section
- Worker list with compliance status calculation (`getComplianceStatus` inline utility)
- Client management (add, edit, delete)
- Placement management (add, edit, delete)
- Worker assignment to placements
- Excel export (`exportToExcel` function with N+1 API calls)
- `PlacementOverview` sub-component defined inline (lines 65–226)
- All modal UIs defined inline in the JSX
- 35+ useState declarations

Suggested split:
```
app/agency/
  page.tsx               (layout shell + data orchestration, <200 lines)
  components/
    WorkerList.tsx
    ClientList.tsx
    PlacementOverview.tsx  (extract from inline)
    AssignWorkerModal.tsx
    AddClientModal.tsx
    EditPlacementModal.tsx
  lib/
    getComplianceStatus.ts  (extract from inline)
    exportToExcel.ts
```

### MAINT-02 — No shared API utility layer

Every API route re-defines auth helpers from scratch. A `app/api/lib/` directory with:
- `getAgencyId.ts`
- `getAdminClient.ts`
- `getUser.ts`
- `requireRole.ts`

would eliminate the copy-paste problem across 15+ route files and centralise auth logic for easier auditing and changes.

### MAINT-03 — No shared client-side utility layer

Date formatting, expiry status calculation, and worker row mapping are independently defined in 3–5 files each. A `app/lib/utils.ts` module would centralise these.

### MAINT-04 — `next.config.ts` is empty

```ts
const nextConfig: NextConfig = {}
```

There is no security headers configuration, no `images` domain allowlist, no `headers()` callback adding CSP, no bundle analyser. For a production app handling sensitive worker data, Content-Security-Policy and X-Frame-Options headers should be set at minimum.

### MAINT-05 — No server components used anywhere

Every page file starts with `'use client'`. None of the data fetching takes advantage of React Server Components, which would allow initial data to be rendered server-side without exposing the Supabase session to the client bundle. This is an architectural choice but means all auth bootstrapping happens client-side on every page load, causing visible loading states.

### MAINT-06 — Supabase types are not generated

There is no `types/supabase.ts` or equivalent in the repository. All Supabase query results are typed as `any` or cast manually. Running `supabase gen types typescript --project-id <id>` would generate accurate types for all tables and eliminate most `any` usage in data access code.

### MAINT-07 — Module-level Supabase admin clients in cron routes

**Files:** `app/api/send-morning-reminders/route.ts`, `app/api/billing/webhook/route.ts`, `app/api/auto-signout/route.ts`

These files create the admin client at module level:

```ts
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

In Vercel's serverless environment, module-level initialisation runs on cold starts. If the env vars are not set at deploy time, the client will be instantiated with `undefined` values and silently fail at runtime. Creating the client inside the handler and adding a null-guard on the env vars (as done in `delete-account/route.ts`) is the safer pattern.

---

## 9. API Route Quality Checklist

| Route | Auth | Role Check | Ownership | Pagination | Error Handling |
|---|---|---|---|---|---|
| `GET /api/agency/clients` | Bearer token | Agency via RPC | Via agency ID | No | Good |
| `GET /api/agency/placements` | Bearer token | Agency via RPC | Via agency ID | No | Good |
| `GET /api/agency/timesheets` | Bearer token | Agency via RPC | Via agency ID | No | Good |
| `PATCH /api/agency/timesheets/[id]` | Bearer token | Agency via RPC | .eq(agency_id) | N/A | Good |
| `POST /api/agency/timesheets/[id]/send` | Bearer token | Agency via RPC | .eq(agency_id) | N/A | Good |
| `GET /api/timesheet/[token]` | **NONE — public** | N/A | Token lookup | N/A | Good |
| `POST /api/timesheet/[token]` | **NONE — public** | N/A | Token lookup | N/A | Good |
| `GET /api/attendance/register` | Bearer token | Company role | Site ownership | **No** | Good |
| `POST /api/attendance/manual` | Bearer token | Company role | Site ownership | N/A | Good |
| `DELETE /api/attendance/manual/[id]` | Bearer token | Company role | Site ownership | N/A | Good |
| `POST /api/push-subscribe` | Bearer token | Any | N/A | N/A | Good |
| `GET /api/auto-signout` | CRON_SECRET | N/A | N/A | N/A | Good |
| `GET /api/send-morning-reminders` | CRON_SECRET | N/A | N/A | N/A | Good |
| `GET /api/check-expiring-credentials` | CRON_SECRET | N/A | N/A | N/A | Good |
| `POST /api/billing/checkout` | Bearer token | Any | N/A | N/A | Good |
| `POST /api/billing/portal` | Bearer token | Any | N/A | N/A | Good |
| `POST /api/billing/webhook` | Stripe signature | N/A | N/A | N/A | Good |
| `GET /api/messages/inbox` | Bearer token | Any | User ID | **No** | Good |
| `POST /api/messages/send` | Bearer token | Any | N/A | N/A | Good |
| `GET/POST /api/group-chats` | Bearer token | Agency only | Via agency_id | N/A | Good |
| `GET/POST /api/group-chats/[id]/messages` | Bearer token | **BUG: owner only** | Via chat lookup | **No** | Good |
| `GET /api/group-chats/worker` | Bearer token | Worker only | Via placements | N/A | Good |
| `GET /api/organisations` | Bearer token | Any | Membership | N/A | Good |
| `POST /api/organisations/invite` | Bearer token | Owner/Admin | Membership | N/A | Good |
| `GET /api/organisations/invite` | **None** | N/A | Token lookup | N/A | Good |
| `POST /api/organisations/invite/accept` | Bearer token | Any | Token lookup | N/A | Good |
| `GET /api/organisations/members/list` | Bearer token | Owner/Admin | Membership | N/A | Good |
| `DELETE /api/organisations/members/[id]` | Bearer token | Owner | Membership | N/A | Good |
| `GET /api/organisations/sites/[userId]` | Bearer token | Owner/Admin | Membership | N/A | Good |
| `GET /api/toolbox-talks` | Bearer token | Company role | Via company_id | **No** | Good |
| `POST /api/toolbox-talks` | Bearer token | Company role | Via company_id | N/A | Good |
| `POST /api/toolbox-talks/sign/[id]` | Bearer token | Worker role | Via worker_id | N/A | Good |
| `GET /api/toolbox-talks/worker` | Bearer token | Worker role | Via worker_id | **No** | Good |
| `GET /api/profiles/company` | Bearer token | Any | N/A | N/A | Good |
| `POST /api/delete-account` | Bearer token | Any | Via user_id | N/A | Good |
| `POST /api/agency/team/leave` | Bearer token | Non-owner | Membership | N/A | Good |

Summary of patterns across all routes:
- **Auth:** All routes except `/api/timesheet/[token]` and `GET /api/organisations/invite` require authentication. Both of these are intentionally public by design.
- **Pagination:** Missing on: `attendance/register`, `messages/inbox`, `group-chats/[id]/messages`, `toolbox-talks`, `toolbox-talks/worker`, `agency/clients`, `agency/placements`, `agency/timesheets`.
- **Role/ownership:** Solid across most routes. The group chat `verifyAccess` bug (BUG-01) is the only known role bypass.

---

## 10. Prioritised Fix List

### Priority 1 — Fix immediately (bugs causing broken functionality or data loss)

1. **BUG-01** — Agency team members cannot access group chats. Fix `verifyAccess` in `app/api/group-chats/[id]/messages/route.ts` to check organisation membership, not exact `user.id === chat.agency_id`.

2. **BUG-05** — Account deletion does not cancel Stripe subscription. Add Stripe `subscriptions.cancel()` call in `app/api/delete-account/route.ts` before deleting the profile.

3. **BUG-04** — Organisation invite URL hardcoded to production. Change to `process.env.NEXT_PUBLIC_SITE_URL` in `app/api/organisations/invite/route.ts` line 93.

4. **SCALE-03** — Company dashboard silently drops workers beyond 50 with no UI feedback. Either add pagination, increase the limit to match the subscription's worker cap, or show a "showing first 50" notice.

### Priority 2 — Fix before scaling (performance issues that will cause outages under load)

5. **PERF-02 + SCALE-01** — Auto-signout cron loads all attendance with no date filter. Add `.gte('created_at', todayISO)` in `app/api/auto-signout/route.ts`.

6. **PERF-03 + SCALE-04** — Morning reminder cron: same fix as above in `app/api/send-morning-reminders/route.ts`.

7. **PERF-01** — Parallelise photo URL signing in agency and company dashboards using `Promise.all`.

8. **PERF-04 + PERF-05** — Add `.limit()` to messages inbox and group chat message queries.

### Priority 3 — Security hardening

9. **SEC-01** — Move Supabase URL and anon key to environment variables in `app/lib/supabase.ts`.

10. **SEC-07** — HTML-escape `workerName`, `clientName`, `siteName` before interpolating into email HTML in `app/api/agency/timesheets/[id]/send/route.ts`.

11. **BUG-02** — Replace hardcoded `'mailto:hello@nekaid.co.uk'` VAPID subject with `process.env.VAPID_SUBJECT` in `app/api/group-chats/[id]/messages/route.ts`.

12. **MAINT-04** — Add security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) in `next.config.ts`.

### Priority 4 — Type safety and maintainability

13. **TS-01** — Enable `"strict": true` in `tsconfig.json`. Work through resulting errors systematically (expect 50–200 fixable errors).

14. **MAINT-06** — Generate Supabase TypeScript types. Run `supabase gen types typescript --project-id abeveiimcmroceakyvli > types/supabase.ts`. Use generated types in data access code.

15. **DUPLICATE-01+02** — Extract `getAgencyId`, `getAdminClient`, `getUser` to `app/api/lib/` shared utilities.

16. **DUPLICATE-03+04** — Extract `mapWorkerRow`, `formatDate`, `getExpiryStatus` to `app/lib/utils.ts`.

### Priority 5 — Architectural refactoring (safe to plan, not urgent)

17. **MAINT-01** — Split `app/agency/page.tsx` into sub-components and extract inline utilities.

18. **PERF-06** — Add pagination or virtual scrolling to agency dashboard worker/client lists.

19. **MAINT-05** — Migrate data-heavy pages to Server Components to eliminate client-side loading flicker and reduce bundle size.

---

## 11. Refactoring Strategy

### Phase 1 — Zero-risk fixes (1–2 days)

These changes are isolated and cannot break anything:

- Fix the hardcoded invite URL (single line change)
- Fix the hardcoded VAPID subject (single line change)
- Move Supabase URL/anon key to env vars in `app/lib/supabase.ts`
- Add date filter to auto-signout and morning reminder crons
- Add `.limit()` to messages inbox and group chat routes
- HTML-escape email template interpolations
- Add security headers to `next.config.ts`

### Phase 2 — Shared utility extraction (2–3 days)

Create `app/api/lib/` with shared auth helpers:

```ts
// app/api/lib/adminClient.ts
export function getAdminClient() { ... }

// app/api/lib/getUser.ts
export async function getUser(req: NextRequest) { ... }

// app/api/lib/getAgencyId.ts
export async function getAgencyId(req: NextRequest) { ... }
```

Then update all 14+ affected API routes to import from these shared modules. Each route change is a search-and-replace — remove local function definitions, add import. Test each endpoint after updating.

Create `app/lib/utils.ts`:

```ts
export function formatDate(value: string): string { ... }
export function getExpiryStatus(dateString: string): 'valid' | 'soon' | 'expired' { ... }
export function mapWorkerRow(worker: any, qualifications: any[]): Worker { ... }
```

### Phase 3 — Bug fixes requiring logic changes (1–2 days)

- Fix `verifyAccess` in group chats to support team members (query `organisation_members` table)
- Add Stripe subscription cancellation to the delete-account flow
- Fix company dashboard to show pagination UI or load all workers up to the subscription cap

### Phase 4 — Type safety (2–4 days)

1. Generate Supabase types: `supabase gen types typescript`
2. Enable `strict: true` in tsconfig
3. Fix all TypeScript errors (expect 50–150 of them, mostly null checks and `any` annotations)
4. Replace `any` typed state in `app/agency/page.tsx` and `app/company/page.tsx` with proper interfaces

### Phase 5 — Performance and architecture (ongoing)

- Add pagination to all list endpoints (agency workers, clients, placements, messages)
- Parallelise photo URL signing with `Promise.all`
- Split `app/agency/page.tsx` into sub-components
- Evaluate migrating initial data fetching to Server Components for the company and agency dashboards

---

## Appendix: File Inventory (all .ts/.tsx files audited)

### API Routes (all read)
- `app/api/agency/clients/route.ts`
- `app/api/agency/clients/[clientId]/placements/route.ts`
- `app/api/agency/placements/route.ts`
- `app/api/agency/team/code/route.ts`
- `app/api/agency/team/join/route.ts`
- `app/api/agency/team/leave/route.ts`
- `app/api/agency/team/members/route.ts`
- `app/api/agency/team/members/[id]/route.ts`
- `app/api/agency/timesheets/route.ts`
- `app/api/agency/timesheets/[id]/route.ts`
- `app/api/agency/timesheets/[id]/send/route.ts`
- `app/api/attendance/register/route.ts`
- `app/api/attendance/manual/route.ts`
- `app/api/attendance/manual/[id]/route.ts`
- `app/api/auto-signout/route.ts`
- `app/api/billing/checkout/route.ts`
- `app/api/billing/portal/route.ts`
- `app/api/billing/webhook/route.ts`
- `app/api/check-expiring-credentials/route.ts`
- `app/api/delete-account/route.ts`
- `app/api/group-chats/route.ts`
- `app/api/group-chats/[id]/messages/route.ts`
- `app/api/group-chats/worker/route.ts`
- `app/api/messages/inbox/route.ts`
- `app/api/messages/send/route.ts`
- `app/api/organisations/route.ts`
- `app/api/organisations/invite/route.ts`
- `app/api/organisations/invite/accept/route.ts`
- `app/api/organisations/members/[id]/route.ts`
- `app/api/organisations/members/list/route.ts`
- `app/api/organisations/sites/[userId]/route.ts`
- `app/api/profiles/company/route.ts`
- `app/api/push-subscribe/route.ts`
- `app/api/send-morning-reminders/route.ts`
- `app/api/timesheet/[token]/route.ts`
- `app/api/toolbox-talks/route.ts`
- `app/api/toolbox-talks/sign/[id]/route.ts`
- `app/api/toolbox-talks/worker/route.ts`

### Pages and Components (read, selected portions for large files)
- `app/agency/page.tsx` (~2544 lines, read in chunks)
- `app/agency/billing/page.tsx`
- `app/agency/TimesheetSection.tsx`
- `app/agency/components/AgencyDashboardMenu.tsx`
- `app/agency/components/AgencyTeamModal.tsx`
- `app/agency/components/GroupMessages.tsx`
- `app/company/page.tsx` (~1600 lines, read in chunks)
- `app/company/billing/page.tsx`
- `app/company/components/CompanyMessages.tsx`
- `app/company/components/OrganisationPanel.tsx`
- `app/layout.tsx`
- `app/login/page.tsx`
- `app/scan/[id]/page.tsx`
- `app/site/[token]/page.tsx`
- `app/timesheet/[token]/page.tsx`
- `app/worker/page.tsx`
- `app/worker/create/page.tsx`
- `app/worker/[id]/page.tsx`
- `app/worker/components/WorkerGroupMessages.tsx`
- `app/worker/site-scan/page.tsx`

### Library / Config (all read)
- `app/lib/supabase.ts`
- `app/lib/usePushNotifications.ts`
- `app/lib/attendance/autoSignOut.ts`
- `app/lib/stripe.ts`
- `tsconfig.json`
- `next.config.ts`
- `vercel.json`
- `package.json`
