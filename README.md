# psb-app-web

Web build of **Bob World / Aegis** — the PSB Identity Trust System banking app.
It renders inside a phone mockup on desktop and full-screen on mobile browsers,
and talks to the same Express + Socket.io backend (`psb-back`) already deployed
on Render.

The Expo app (`psb-app`) is untouched; this is a parallel client built from it.

---

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Create `.env.local` (see `.env.example`):

```bash
DATABASE_URL=postgresql://...          # Neon connection string — required, auth reads/writes here
NEXT_PUBLIC_API_URL=https://psb-back.onrender.com   # optional, defaults to the Render URL
```

`DATABASE_URL` is required — every auth route (`/api/auth/*`) fails without
it. `NEXT_PUBLIC_API_URL` only affects the telemetry/risk endpoints
(`/api/assess`, `/api/payment`, `/api/ping`), which still call the separate
Express backend.

---

## Deploying to Vercel

1. Push this folder to a Git repo (it is already the repo root).
2. Import the repo in Vercel — the Next.js preset is detected automatically.
3. Add environment variables: `DATABASE_URL` (Neon pooled connection string)
   and `NEXT_PUBLIC_API_URL` pointing at your backend.
4. Deploy.

Auth routes (`/api/auth/*`) run as Vercel serverless functions backed by
Neon's HTTP driver, so no connection pooling setup is needed on Vercel's side.

**Backend CORS:** `psb-back` already runs `app.use(cors())` with a permissive
default, so the Vercel origin is accepted as-is.

---

## Architecture

```
src/
  app/
    layout.tsx            fonts, providers, phone frame
    page.tsx              landing page -> /register or /login
    (auth)/               register, set-pin, password-login, login, blocked
    (app)/                layout (drawer + bottom nav) + all banking screens
    api/auth/              register, login, logout, status, verify-password,
                           pin/verify, pin/set — Postgres-backed, see below
  components/
    PhoneFrame.tsx        device mockup, collapses on small viewports
    ui/                   Button, Input, TopAppBar, PinKeypad, Drawer, ...
  context/
    TelemetryContext      aggregates all telemetry, calls /api/assess
    BalanceContext        in-memory mocked balance
    AlertContext          replaces React Native's Alert.alert
    DrawerContext         replaces navigation.openDrawer()
  hooks/                  the six telemetry collectors
  lib/
    db.ts                 Neon serverless Postgres client
    password.ts           bcrypt hashing for account password + PIN
    session.ts             httpOnly cookie + sessions table
    hash.ts                client-side SHA-256 (Web Crypto) for device fingerprint only
  services/
    auth.ts               fetch wrapper over /api/auth/* (see Auth & data storage)
    api.ts                /api/ping, /api/assess, /api/payment
  types/telemetry.ts      shared contract with the backend
```

Route groups `(auth)` and `(app)` don't appear in URLs, exactly like
expo-router — so `usePathname()` yields `/login`, `/home`, `/transfer`, and the
journey screen names the backend receives match the native client's.

---

## What changed vs. the Expo app, and why

The telemetry layer existed in `psb-app` but was never called from any screen —
only `isVpnActive` was consumed. **In this build it is actually wired up:**
`/api/assess` is called on login and again at transfer confirmation, and the
returned `ALLOW` / `STEP_UP` / `BLOCK` drives real navigation.

| Native capability | Web approach | Notes |
|---|---|---|
| `expo-secure-store` | Postgres (Neon) + bcrypt + httpOnly session cookie | Credentials never touch the browser's storage at all — see **Auth & data storage** below. |
| Keystroke dynamics | `keydown` / `keyup` | **More accurate than native.** RN has no `onKeyUp`, so the app approximated hold time as `flightTime * 0.8`; the browser measures it directly. |
| Paste detection | `paste` event | **Exact**, vs. the native >4-char length-delta heuristic (kept as a secondary signal for programmatic injection). |
| Gyroscope | DeviceMotion `rotationRate` | Desktop has no gyro; iOS needs permission from a user gesture. Degrades to variance `0`, which the backend already treats as "no signal". |
| Device fingerprint | UA + screen + CPU + timezone + canvas hash | No `modelName` / `totalMemory` in a browser; canvas hashing supplies the entropy. |
| `expo-local-authentication` | **Removed** | Biometric login is not offered on the web build — most desktops have no fingerprint or face sensor, so it could not be demonstrated reliably. Login is PIN-only, and the `STEP_UP` modal uses the PRD's mocked 1.5s verification. |
| `expo-network` VPN detection | Timezone ↔ geolocation-longitude drift | **This is a heuristic, not a detection.** Browsers cannot see the network transport. A >3h disagreement between the OS timezone and the reported longitude suggests a proxy. Conservative by design, and silently `false` if location is denied. |
| `Alert.alert` | `AlertContext` modal | Renders inside the phone frame rather than as a browser `alert()`. |
| Drawer navigator | `DrawerContext` + slide-over panel | Same nav items and active-route highlighting. |

Two behavioural differences worth calling out:

- **Blocking is now backend-driven.** The native app force-redirected to a block
  screen from a client-side VPN poll. Here, `/blocked` is reached when the risk
  orchestrator returns `BLOCK`, which is the design the TRD actually describes.
- **`/api/payment` reports the real verdict.** The native `success.tsx`
  hardcoded `riskScore: 10, action: 'ALLOW'`; this build sends the assessment
  the transaction was genuinely approved under.

- **No biometric login.** The native app's fingerprint/Face ID option is absent
  here; the PIN (and password, for PIN reset) is the only credential. The
  Settings screen has no biometric toggle as a result.

Settings also gained a **Session Security** panel showing the live trust score,
last decision, active flags, device ID, and session ID — surfacing data the
native app collected but never displayed.

Note that **device fingerprinting is unrelated to biometrics** and is still
fully active — `useDeviceFingerprint` hashes browser/hardware characteristics
to feed the risk engine's device score.

---

## Auth & data storage

Account, password, and PIN data live in **Postgres on Neon** — not in
localStorage, and not in the separate Express backend (`psb-back`). Auth is
handled entirely by this app's own Next.js Route Handlers under
`src/app/api/auth/*`, so it works the same way whether you run `next dev`
locally or deploy to Vercel.

**Schema** (`users`, `sessions`):

```sql
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      text NOT NULL,
  mobile         varchar(15) NOT NULL UNIQUE,
  account_number varchar(14) NOT NULL UNIQUE CHECK (account_number ~ '^[0-9]{14}$'),
  email          text UNIQUE,
  password_hash  text NOT NULL,
  pin_hash      text,
  pin_attempts  integer NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
```

Left intentionally simple/extensible — future data (accounts, transactions,
beneficiaries, etc.) can reference `users.id` as new tables are added.

**Sessions, not JWT.** Login/register/PIN-verify set a `psb_session` cookie
(httpOnly, `Secure` in production, `SameSite=Lax`, 30-day expiry) whose value
is a row id in `sessions`. This makes logout and forced-expiry immediate —
revoking a session just deletes the row — which a stateless JWT can't do.
Expired rows are lazily deleted the next time they're looked up.

**Passwords and PINs are hashed with bcrypt** (cost factor 12), server-side
only, via `src/lib/password.ts`. This is unrelated to the `sha256` helper in
`src/lib/hash.ts`, which runs client-side purely to hash device/browser
characteristics for the telemetry fingerprint — no credential ever goes
through it.

**PIN brute-force protection.** Because a PIN is only 4 digits, `POST
/api/auth/pin/verify` locks the account for 15 minutes after 5 wrong
attempts (`pin_attempts` / `pin_locked_until` columns), returning `423` while
locked.

**API routes:**

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/status` | GET | `{ hasAccount, hasPin, isAuthenticated, profile }` for the current cookie |
| `/api/auth/register` | POST | Create account, hash password, start session |
| `/api/auth/login` | POST | Password login by mobile or email, start session |
| `/api/auth/verify-password` | POST | Re-check password for the *signed-in* session (transfer confirmation) |
| `/api/auth/pin/verify` | POST | PIN quick-login, rate-limited |
| `/api/auth/pin/set` | POST | Set/replace PIN for the signed-in session |
| `/api/auth/logout` | POST | Destroy the session |

**Environment variable required:** `DATABASE_URL` (Neon pooled connection
string). Set it in `.env.local` for local dev and in Vercel's project
environment variables for deploys — the app throws on startup if it's unset
when a DB call is made.

**Known limitations:**

- **Accounts are global, not per-browser.** The old localStorage version made
  `hasAccount` per-browser, so every visitor could register their own demo
  account. Postgres makes accounts a single shared table, so `hasAccount`
  and the PIN-login flow currently apply to whichever one account exists
  across *all* visitors. This is fine for a single-user demo but would need
  proper multi-user session scoping (e.g. per-mobile-number login instead of
  "the one account") before this could serve more than one real customer.
- **No rate-limiting on `/register` or `/login`** (password path) — only PIN
  verification is currently throttled.

---

## Backend endpoints used

From `psb-back/src/index.ts`:

- `GET /api/ping` — RTT measurement
- `POST /api/assess` — telemetry in, `RiskAssessment` out; also emits
  `risk_update` / `security_signal` over Socket.io
- `POST /api/payment` — emits `transaction_completed`, plus
  `high_value_payment` above ₹10,000

If the backend is unreachable, assessment **fails open** (`ALLOW` with an
`ASSESSMENT_UNAVAILABLE` flag) — per the TRD, a service outage must never lock
a legitimate customer out.
