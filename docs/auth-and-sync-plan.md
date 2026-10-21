# Accounts & cross-device sync — plan

Status: **implemented** (Phases 1–4) — waiting on Phase 0 accounts/env to go live · Target: Next.js 14.2 (App Router) on Vercel · Users: 4–5, internal

> **Changes made during implementation** (details in the sections below):
> - **Sign-up is open to any Google account** (decided 2026-10-21). `ALLOWED_EMAILS` is now an
>   optional invite list, enforced by Better Auth 1.7's `user.validateUserInfo` gate (runs
>   on sign-up *and* every Google sign-in) instead of two `databaseHooks`. A later admin
>   panel will manage users (planned: Better Auth's admin plugin — ban/unban, remove, roles).
> - No `prompt: 'select_account'`: sign-in is one click for a returning user.
> - Continue Watching entries also store the **video server** (`server`); a title
>   resumes on the server it was last played on, on any device.
> - The Better Auth browser client (~12 KB gzip) loads only on a sign-in/out click;
>   the session is read with one call to Better Auth's `GET /api/auth/get-session`
>   (`lib/session.ts`). The sync engine loads only for signed-in users.

## 1. Goal

Today every user signal lives in `localStorage` (`cinejoy.taste`, `cinejoy.watchlist`,
`cinejoy.continue`, `cinerang.popup_block`), so it is tied to one browser. We want:

- **Sign in / sign out with Google.**
- **Taste, likes, dislikes, watchlist and Continue Watching stored server-side**, so they
  follow the user to any device (start an episode on the laptop, resume it on the phone).
- **No regression in speed.** Catalog pages stay static/ISR; the UI never waits on the
  network to show or change a like, a watchlist entry or a resume point.
- **Free to run forever** for a handful of users, with nothing that silently pauses.

Non-goals: email/password, social features. (Roles / admin panel: later.)

## 2. Decisions

| Area | Choice | Why |
|---|---|---|
| Auth library | **Better Auth** (`better-auth` 1.7) + Google | Runs inside our Next.js app (no third-party auth service), free, keeps users in our own DB. The Auth.js/NextAuth team joined Better Auth in Sept 2025 and recommends it for new projects. Peer deps verified: `next ^14 \|\| ^15 \|\| ^16`, `react ^18 \|\| ^19`, `mongodb ^6 \|\| ^7`. |
| Sign-in method | **Google only** | Everyone has one; no passwords to store or reset. |
| Access control | **Open sign-up**: any Google account. Google app published *In production* (basic scopes only — no Google review). Optional `ALLOWED_EMAILS` switches to invite-only. | Anyone may use the site; each account only ever reads/writes its own profile. User management moves to a future admin panel. |
| Database | **MongoDB Atlas M0 (free)** | Our data is one small document per user — a natural document-DB fit. Free tier does **not** pause for low traffic: it only pauses after **60 days with zero connections** (vs Supabase free: paused after **1 week** of inactivity). A daily keep-alive ping removes even that risk. |
| Sessions | DB-backed sessions + Better Auth **cookie cache** (5 min) | Session checks are answered from a signed cookie, so they normally cost **no DB call**, while DB sessions still allow "sign out everywhere". 30-day sessions, refreshed daily. |
| Sync model | **Local-first, op-based sync** | `localStorage` stays the instant UI source; every change is also recorded as a small operation and sent in batches. Explained in §5. |
| Hosting region | Vercel functions + Atlas cluster **in the same region, near the users** (Mumbai `bom1` + Atlas AWS Mumbai if M0 is offered there, else Singapore `sin1` + Atlas Singapore) | DB round-trips become ~1–5 ms instead of ~200 ms across continents. Hobby allows one function region. |

### Alternatives considered

| Option | Verdict |
|---|---|
| **NextAuth v4** (next-auth.js.org) / **Auth.js v5** | Both work with Next 14, and v4's stateless JWT sessions need no DB. But both are now maintenance-only (security fixes) under the Better Auth team, and v5 never left beta. Fine for an existing app; not the best start for a new integration. |
| **Supabase Auth + Postgres** | Free projects pause after one week without activity — a real problem for 4–5 occasional users. |
| **Auth0 / Clerk** | Hosted, polished, generous free tiers — but an extra vendor, heavier client SDKs and user data outside our DB. Overkill for 5 people. |
| **Neon Postgres** | Viable; free compute scales to zero when idle, so the first request after a quiet period pays a cold start. Relational schema adds ceremony for what is one document per user. |

## 3. Architecture

```
Browser                                   Vercel (bom1)                      Atlas M0 (Mumbai)
────────────────────────────────          ─────────────────────────────      ─────────────────
UI components                              /api/auth/[...all]  (Better Auth)  user, session,
  │ read/write (sync, instant)               ↳ Google OAuth callback          account,
  ▼                                          ↳ session cookie + cookie cache  verification
lib/preferences.ts, lib/storage.ts                                            
  │ apply op locally ─► localStorage       /api/sync  GET  → profile + ETag   profiles
  │ record op ─► outbox (localStorage)               POST → apply op batch    (1 doc / user)
  ▼                                        /api/cron/keepalive (daily ping)
lib/sync/engine.ts ── batched POST ───────►
                   ◄─ GET (304 if same) ───
```

Key properties:

1. **Static pages stay static.** No server component reads the session (`headers()` /
   `cookies()` would force every page dynamic and switch off the ISR caching we rely on).
   Session state is read client-side (`authClient.useSession()`) and inside API routes only.
2. **No middleware.** Nothing is login-gated — signed-out visitors keep today's local-only
   "guest" behaviour — so we skip an edge invocation on every request.
3. **One document per user.** Everything a device needs is a single `_id` lookup.
4. **Writes never block the UI.** A like is applied to `localStorage` immediately and synced
   within ~1.5 s in the background; offline changes queue and flush when back online.

## 4. Data model

Better Auth owns its collections (`user`, `session`, `account`, `verification`). App data
lives separately in `profiles`, keyed by the Better Auth user id, so the auth library's
schema and ours never collide.

```ts
// profiles collection — one document per user (typically 5–50 KB)
interface Profile {
  _id: string;                 // Better Auth user id
  rev: number;                 // +1 per applied batch; used as the ETag
  taste: UserTaste;            // exactly the shape in lib/preferences.ts
  watchlist: ContinueItem[];   // newest first, cap 500
  continue: ContinueItem[];    // newest first, cap 30 (was 20 locally);
                               // each has season/episode + `server` (lib/servers id)
  prefs: { popupBlock: boolean };
  appliedOps: string[];        // last 500 op ids → retries are idempotent
  createdAt: Date;
  updatedAt: Date;
}
```

Caps (enforced by the shared reducer, §5.3): liked/disliked/watched ≤ 2,000 ids per media
type, watchlist ≤ 500, continue ≤ 30, appliedOps ≤ 500. Worst case stays far below Mongo's
16 MB document limit and keeps every read/write a few KB.

Indexes (created once by `scripts/setup-db.mjs`):

| Collection | Index | Purpose |
|---|---|---|
| `user` | `email` unique | Better Auth lookup |
| `session` | `token` unique, `userId` | Better Auth lookup / revoke-all |
| `session` | `expiresAt` TTL (0 s) | Mongo deletes expired sessions itself |
| `account` | `userId` | Better Auth lookup |
| `verification` | `identifier`; `expiresAt` TTL | OAuth state cleanup |
| `profiles` | `_id` (built-in) | All profile access is by primary key — nothing else needed |

## 5. Sync design

### 5.1 Why ops instead of uploading snapshots

Uploading the whole taste object ("last write wins") loses data when two devices change
things close together: the laptop's older copy overwrites the like just made on the phone,
and genre-score increments from one device vanish. Recording **intent** ("liked title 123
with genres 28, 12") and applying it on the server makes concurrent changes merge
naturally — adds, removes and score increments all commute.

### 5.2 Operations

Each existing mutation in `lib/preferences.ts` / `lib/storage.ts` maps to exactly one op.
Public function signatures stay the same, so components don't change.

```ts
type Kind = 'movie' | 'tv';
type Op = { id: string; at: number } & (            // id: crypto.randomUUID()
  | { t: 'taste.like';    kind: Kind; titleIds: number[]; genreIds: number[]; languages: string[] }
  | { t: 'taste.unlike';  kind: Kind; titleId: number;    genreIds: number[]; languages: string[] }
  | { t: 'taste.dislike'; kind: Kind; titleId: number;    genreIds: number[] }
  | { t: 'taste.set';     fields: Partial<UserTaste> }   // quiz start/finish/Back restore
  | { t: 'watchlist.add';    item: ListItem }
  | { t: 'watchlist.remove'; mediaType: Kind; titleId: number }
  | { t: 'continue.upsert';  item: ContinueItem }
  | { t: 'continue.remove';  mediaType: Kind; titleId: number }
  | { t: 'continue.clear' }
  | { t: 'prefs.set';     popupBlock: boolean }
  | { t: 'import';        snapshot: LocalSnapshot }      // first sign-in merge, §5.6
);
```

| Existing function | Op |
|---|---|
| `addQuizSignals` / `recordTitleLiked` | `taste.like` |
| `recordTitleUnliked` | `taste.unlike` |
| `recordTitleDisliked` | `taste.dislike` |
| `saveTaste` (TasteQuiz begin/finish/Back) | `taste.set` |
| `toggleWatchlist` (decides add vs remove locally) / `removeFromWatchlist` | `watchlist.add` / `watchlist.remove` |
| `saveContinue` / `removeContinue` / `clearContinue` | `continue.upsert` / `continue.remove` / `continue.clear` |
| Player popup-blocker toggle | `prefs.set` |

### 5.3 One reducer, used on both sides

`lib/sync/reducer.ts` is a pure function `applyOps(profile, ops) → profile` with no browser
or Node APIs. The **client** uses it to apply its own changes locally; the **server** uses
the same code to apply batches to the stored document. One implementation means the phone,
the laptop and the database can never disagree about what "unlike" does.

It also owns: dedupe, caps, cleaning scores ≤ 0, "like clears dislike", and skipping any op
whose id is already in `appliedOps`.

### 5.4 Client engine (`lib/sync/engine.ts`)

State in `localStorage` key `cinerang.sync`: `{ ownerId, rev, outbox: Op[], lastPullAt }`.

- **Record:** when signed in, every mutation appends its op to the outbox (persisted, so a
  crash or tab close doesn't lose it). Signed out → nothing is recorded (guest mode).
- **Push:** debounce 1.5 s after the last op (max wait 10 s); also flush on
  `visibilitychange → hidden` with `fetch(..., { keepalive: true })`, on `online`, and
  before sign-out. Batches ≤ 100 ops. On success, drop those ops and store the new `rev`.
- **Pull:** `GET /api/sync` with `If-None-Match: "<rev>"` → **304 with no body** when
  nothing changed. Runs when sync starts, when a tab becomes visible after > 30 s, and when
  a push reveals another device wrote in between (returned `rev` ≠ local `rev` + 1).
- **Rebase on pull:** local state = `applyOps(serverProfile, pendingOutbox)`, so changes
  not yet uploaded survive a pull.
- **Notify:** after a pull changes data, dispatch the existing `TASTE_EVENT` /
  `WATCHLIST_EVENT`, plus a new `CONTINUE_EVENT` (ContinueWatching currently reads once on
  mount) and a `SYNC_EVENT` so recommendation rows reload after the first sync of a device
  (e.g. a new phone going from "take the quiz" to real picks).

### 5.5 Server (`app/api/sync/route.ts`)

- `auth.api.getSession({ headers })` → user id (cookie cache: normally no DB hit). 401 if
  signed out; 403 if the email is no longer on `ALLOWED_EMAILS` (client then signs out).
- **GET:** read `rev` only (`projection: { rev: 1 }`); if it matches `If-None-Match` → 304.
  Otherwise return the profile (minus `appliedOps`). `Cache-Control: private, no-cache`.
- **POST:** validate the batch with **zod** (op shapes, integer ids, ≤ 100 ops, body
  ≤ 64 KB, `Origin` must be our site). Then read-modify-write:
  `findOne` → `applyOps` → `replaceOne({ _id, rev })`; on a rev mismatch (another device
  wrote between our read and write) retry up to 3×. Two in-region round-trips (~2–10 ms).
  Returns `{ rev }`.
- Trade-off noted: pure Mongo update operators would be one round-trip instead of two, but
  would duplicate the reducer's rules in a second language. At this scale correctness and a
  single source of truth win.

### 5.6 Sign-in, sign-out, shared devices

| Situation | Behaviour |
|---|---|
| First sign-in on a device with guest data | Send one `import` op with the local snapshot. Server merges: id sets → union (if a title ends up both liked and disliked, the server's existing choice wins); genre/language scores → per-key **max** (prevents double counting); watchlist/continue → union by `(mediaType, id)`, newest wins, re-capped. Then pull. |
| Sign-in when the device's data belongs to a different user (`ownerId` mismatch) | Discard local data, pull. |
| Sign-out | Flush outbox (≤ 3 s), call `authClient.signOut()`, clear taste/watchlist/continue/sync keys → back to an empty guest. Protects shared devices. |
| Removed from `ALLOWED_EMAILS` | New sign-ins rejected by a Better Auth hook; existing sessions get 403 from `/api/sync` and are signed out. |
| "Sign out of all devices" | Account menu item → Better Auth revoke-sessions API. |

## 6. Auth integration details

```ts
// lib/auth.ts  (server only) — created lazily by getAuth(), so builds need no secrets
import { betterAuth } from 'better-auth/minimal';   // adapter-only entry: excludes Kysely
import { mongodbAdapter } from '@better-auth/mongo-adapter';

betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db, { client }),          // Atlas = replica set → transactions
  socialProviders: {
    google: { clientId, clientSecret },              // Google only; no forced account chooser
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,                     // 30 days
    updateAge: 60 * 60 * 24,                          // refresh at most daily
    cookieCache: { enabled: true, maxAge: 5 * 60 },   // no DB read on most checks
  },
  user: {
    // Runs on sign-up and on every Google sign-in with the fresh email.
    // Rejection → redirect to errorCallbackURL with ?error=not_invited.
    validateUserInfo: ({ user }) =>
      isAllowedEmail(user.email) ? undefined : { error: 'not_invited' },
  },
});
```

- Route handler: `app/api/auth/[...all]/route.ts` → `toNextJsHandler((req) => getAuth().handler(req))`.
- Client: `lib/auth-client.ts` → `createAuthClient()` from `better-auth/react`, imported
  on demand by `lib/session.ts` (`signIn.social`, `signOut`, `revokeSessions`).
- Google callback URL: `<origin>/api/auth/callback/google`.
- Option names were verified against the installed `better-auth@1.7.12` type definitions.

**MongoDB client (`lib/db.ts`)** — one `MongoClient` per server instance, cached on
`globalThis` (survives dev hot reloads and warm serverless invocations):
`maxPoolSize: 5`, `maxIdleTimeMS: 10_000`, `serverSelectionTimeoutMS: 5_000`,
`appName: 'cinerang'`. Register it with `attachDatabasePool` from `@vercel/functions` so
idle connections close before a function suspends (Vercel lists MongoDB as supported;
confirm the call shape in Phase 1). Requires Node ≥ 20.19 (mongodb 7) — Vercel's default
runtime and local Node 24 both qualify.

## 7. UI changes

- **Navbar → `AccountButton`** (one instance for desktop and mobile). Signed out: Google
  "Sign in" → `signIn.social({ provider: 'google', callbackURL: <current page> })` — the
  Better Auth client is prefetched on hover, so the click goes straight to Google.
  Signed in: avatar → menu with name/email, "Sign out", "Sign out of all devices".
  A failed sign-in returns with `?signin=failed&error=…` and shows a short notice.
- **`<SyncProvider />`** in `app/layout.tsx`: renders nothing; follows the session and
  starts/stops the engine. Adds no server work to any page.
- **Continue Watching** subscribes to `CONTINUE_EVENT`, so a resume point saved on another
  device appears without a reload.
- **Player** starts on the saved server for the title. On a fresh device opened straight
  on a watch link, a resume point that arrives by sync within 15 s switches the player to
  its server — unless the viewer already picked one.
- Small "Sign in to sync … across devices" hint on the Taste and Watchlist pages for guests.

### Resume: episode, server, time (added 2026-10-21)

- **Episode.** A series opened without `?s=&e=` (any card) jumps to the saved episode.
  Picking an episode from the list records it at once; season tabs (`?s=` only) don't.
  If the player moves to another episode by itself (its own next button / episode
  menu) and reports it, CineRang follows — controls, URL, Continue Watching — without
  reloading the frame.
- **Server.** The saved server is used on open. If it fails to load, failover moves on
  and says so, with "Try <server> again".
- **Time.** Cross-origin players can't be inspected; the position comes from players
  that post VidLink-style `PLAYER_EVENT` messages (`lib/playback.ts`, accepted only from
  the player frame / its own site). Saved at most once a minute while playing, on pause,
  and when the tab is hidden or left; synced like any other change (queued resume
  points for the same title are collapsed). Reaching the credits moves the resume point
  to the next episode.
- **Resuming.** Servers with a documented `startAt` (VidLink, VidCore — `startAt: true`
  in `lib/servers.ts`) open at the saved time ("Resuming at 11:40 · Start over"); others
  show "You left at 11:40 — skip to 11:40 in the player". Continue Watching cards show
  a progress bar and "left at 11:40".

### Admin panel & watch history (added 2026-10-21)

- **Capture without extra traffic.** `/api/sync` files the ops it applies for the first
  time (`applyBatch().fresh`) into `watch_history` (upsert per account × title × episode:
  `firstAt`, `lastAt`, `$max maxTime`, `duration`, `completed`, `saves`, `server`) and
  `activity` (append-only likes / unlikes / dislikes / watchlist and Continue Watching
  removals). Retried uploads are never counted twice. Entries queued after a finish
  carry `upNext: true` and are not history; the finished episode's final position is
  saved first so it is marked complete. Outbox compaction now collapses only repeats of
  the same episode.
- **Admin.** Better Auth admin plugin (role / banned fields; banned accounts can't sign
  in — `BANNED_USER`). Owners = `ADMIN_EMAILS` (promoted on sign-in, protected in the
  panel). Admin checks read the session with `disableCookieCache`, so revocation is
  immediate; every admin page and route checks on its own (layouts don't re-run on
  in-app navigation). Actions run server-side through `auth.$context.internalAdapter`;
  delete also removes the profile, history and activity. `/api/sync` refuses banned
  accounts (403 → the client signs out).
- **Export.** `/api/admin/export?data=history|activity|taste[&user=]` streams JSON Lines;
  accounts by id, never email.
- **Privacy.** `/privacy` states that watch history is kept, who can see it and how to
  delete it.

## 8. Performance budget

| Metric | Target |
|---|---|
| Catalog pages (`/`, `/movies`, `/tv`, `/browse/*`) | Still static/ISR — no new server work per request |
| Like / watchlist / resume latency | 0 ms network wait (local first) |
| Extra requests per page load | `get-session` (served from cookie cache) + one sync `GET` (usually 304, ~200 B) |
| Writes | ≤ 1 request per ~1.5 s of activity, batched |
| DB work per pull | One `_id` lookup returning only `rev` when unchanged |
| Client JS added | Target ≤ 15 KB gzip. **Measured** (layout + page JS, gzip): +4.5 KB `/`, +5.5 KB `/movies`, +5.7 KB watch pages, +7.8 KB `/taste`, +8.8 KB `/watchlist`. Better Auth client (12 KB) and sync engine (1.4 KB) are separate on-demand chunks. |

## 9. Security

- User id always comes from the session, never from the request body.
- zod validation and size caps on every op; integer ids only; strings length-limited.
- `Origin` check on `POST /api/sync` (session cookie is `SameSite=Lax`; Better Auth
  protects its own routes).
- Atlas: a database user with `readWrite` on the `cinerang` database only; network access
  `0.0.0.0/0` is required for Vercel's changing IPs, so the credential is the boundary —
  long random password, stored only in env vars.
- Secrets never use the `NEXT_PUBLIC_` prefix.
- Keep-alive endpoint requires `Authorization: Bearer $CRON_SECRET` (Vercel sends it).

## 10. Implementation phases

**Phase 0 — accounts & config (you, ~20 min)**
1. Atlas: create an M0 cluster (Mumbai if listed for M0, else Singapore), database
   `cinerang`, a `readWrite` user, network access `0.0.0.0/0`, copy the SRV URI.
2. Google Cloud Console: OAuth consent screen (External, **Testing**, add the 4–5 Gmail
   addresses as test users); OAuth client (Web) with redirect URIs
   `http://localhost:3000/api/auth/callback/google` and
   `https://<your-vercel-domain>/api/auth/callback/google`.
3. Env vars in `.env.local` and Vercel (see §11).

**Phase 1 — auth**
- Add `better-auth`, `@better-auth/mongo-adapter`, `mongodb`, `zod`, `@vercel/functions`.
- `lib/db.ts`, `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`,
  allowlist hook, `scripts/setup-db.mjs` (indexes), Navbar account button.
- Done when: sign in/out works locally; a non-allowlisted Google account is refused.

**Phase 2 — profile API**
- `lib/sync/types.ts` (Profile, Op, zod schemas), `lib/sync/reducer.ts`,
  `app/api/sync/route.ts` (GET with ETag/304, POST with rev-guarded write).
- Done when: ops posted with curl update the document; replaying a batch changes nothing.

**Phase 3 — client sync**
- `lib/sync/engine.ts`, `components/SyncProvider.tsx`.
- Refactor mutation internals of `lib/preferences.ts` and `lib/storage.ts` to
  "build op → apply via reducer → save → record" (signatures unchanged); popup-blocker
  pref through `prefs.set`; `CONTINUE_EVENT` / `SYNC_EVENT` listeners.
- First-sign-in import, owner switching, sign-out clearing.
- Done when: a like on browser A shows on browser B after focusing it; offline changes sync
  after reconnecting.

**Phase 4 — ops & polish**
- `vercel.json`: `"regions": ["bom1"]` (or `sin1`, matching Atlas) and a daily cron →
  `/api/cron/keepalive` (`db.command({ ping: 1 })`) so Atlas never hits the 60-day pause.
- Guest hints, account menu, docs (README env section).

## 11. Environment variables

| Name | Example | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://cinerang:…@cluster0.xxxx.mongodb.net/cinerang?retryWrites=true&w=majority` | Server only |
| `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` | Different per environment |
| `BETTER_AUTH_URL` | `http://localhost:3000` / `https://<domain>` | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud | |
| `ALLOWED_EMAILS` | *(empty)* or `a@gmail.com,b@gmail.com` | Optional. Empty = anyone can sign up; set = invite-only. Comma-separated, case-insensitive |
| `CRON_SECRET` | random string | Vercel attaches it to cron calls |

## 12. Test checklist

- Sign in → existing guest likes/watchlist/resume points appear in the account (import).
- Two browsers, same account: like on A, focus B → visible. Watchlist add on both at once →
  both entries kept. Episode resume on phone → laptop's Continue Watching jumps to it, and
  opening it starts on the **same server** the phone was using.
- Go offline, like 3 titles, reload, go online → all 3 reach the server exactly once.
- Replay the same POST batch → `rev` unchanged, no double score increments.
- `ALLOWED_EMAILS` empty → any Google account signs in. Set → a non-listed account is
  refused with a clear message.
- Sign out → local data cleared; signing in as a different user shows only their data.
- `next build` output: `/`, `/movies`, `/tv` still marked static/ISR.

## 13. Decisions on the former open questions

1. Guest (signed-out) mode stays.
2. Local data is cleared on sign-out.
3. Production domain: **https://cinerang.vercel.app** — Google redirect URI
   `https://cinerang.vercel.app/api/auth/callback/google`, `BETTER_AUTH_URL` on Vercel set to
   the same origin. Branding: home page `https://cinerang.vercel.app`, privacy policy
   `https://cinerang.vercel.app/privacy`, authorized domain `cinerang.vercel.app`.
4. Atlas M0 cluster is on AWS Mumbai (`AP_SOUTH_1`) → Vercel region `bom1`.
