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

Create `.env.local` if you want to point at a different backend:

```bash
NEXT_PUBLIC_API_URL=https://psb-back.onrender.com
```

If unset, it defaults to the Render URL.

---

## Deploying to Vercel

1. Push this folder to a Git repo (it is already the repo root).
2. Import the repo in Vercel — the Next.js preset is detected automatically.
3. Add the environment variable `NEXT_PUBLIC_API_URL` pointing at your backend.
4. Deploy.

No other configuration is needed. There is no server-side state; every route is
a client component, so the whole app is statically prerendered and hydrated.

**Backend CORS:** `psb-back` already runs `app.use(cors())` with a permissive
default, so the Vercel origin is accepted as-is.

---

## Architecture

```
src/
  app/
    layout.tsx            fonts, providers, phone frame
    page.tsx              entry: location gate -> routes by on-device state
    (auth)/               register, set-pin, password-login, login, blocked
    (app)/                layout (drawer + bottom nav) + all banking screens
  components/
    PhoneFrame.tsx        device mockup, collapses on small viewports
    ui/                   Button, Input, TopAppBar, PinKeypad, Drawer, ...
  context/
    TelemetryContext      aggregates all telemetry, calls /api/assess
    BalanceContext        in-memory mocked balance
    AlertContext          replaces React Native's Alert.alert
    DrawerContext         replaces navigation.openDrawer()
  hooks/                  the six telemetry collectors
  services/
    auth.ts               local account: WebCrypto hashing + localStorage
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
| `expo-secure-store` | `localStorage` + WebCrypto SHA-256 | Same salted-hash scheme; browsers have no Keystore/Keychain equivalent, so raw credentials are still never stored, but the store is not hardware-backed. |
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
