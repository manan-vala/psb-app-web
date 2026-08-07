import { NextResponse } from 'next/server';

/**
 * Auth and CORS for the `/api/analyst/*` routes, which are called by the
 * separate `psb-dashboard` SPA rather than by this app's own screens.
 *
 * Two things make these routes different from everything else under
 * `src/app/api/*`:
 *
 *   1. They're cross-origin, so they need explicit CORS headers and an OPTIONS
 *      handler. `x-analyst-key` is not a CORS-safelisted request header, so
 *      every one of these calls triggers a real preflight — omitting OPTIONS
 *      makes them fail in the browser while working fine from curl, which is a
 *      genuinely confusing way to lose an afternoon.
 *   2. They authenticate with a shared key instead of a session cookie,
 *      because the caller is an analyst console with no user session in this
 *      app at all.
 *
 * ⚠️ The dashboard is a static SPA, so its copy of this key ships in the
 * client bundle and is readable by anyone who opens devtools. That is accepted
 * for the demo and documented in DEMO-IMPLEMENTATION-PLAN.md §2.4 — it is not
 * a production auth model. A real deployment puts a session-authenticated
 * backend-for-frontend in front of these routes instead.
 */

const ANALYST_KEY_HEADER = 'x-analyst-key';

/**
 * Allowed dashboard origins. Comma-separated in the env var so a deployed
 * dashboard and a local one can both work without a redeploy.
 *
 * Defaults cover Vite's dev server on the two ports it actually picks.
 */
function allowedOrigins(): string[] {
  const configured = process.env.ANALYST_ALLOWED_ORIGINS;
  if (configured) {
    return configured.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return ['http://localhost:5173', 'http://localhost:4173'];
}

/**
 * CORS headers for a given request origin.
 *
 * Echoes the origin back when it's allowed rather than replying `*`. These
 * responses carry onboarding details and device bindings; reflecting a
 * known-good origin keeps that off any page that merely knows the URL, and
 * leaves the door open for cookie-based analyst auth later, which `*` would
 * forbid outright.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowed = allowedOrigins();

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, ${ANALYST_KEY_HEADER}`,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/** Preflight handler. Every analyst route re-exports this as its `OPTIONS`. */
export function handleAnalystOptions(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** JSON response with CORS headers attached. */
export function analystJson(
  req: Request,
  body: unknown,
  init?: { status?: number }
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: corsHeaders(req),
  });
}

/**
 * Gate for every analyst route.
 *
 * Returns a ready-to-send error response when the request should be refused,
 * or `null` when it may proceed — so a route reads:
 *
 *     const denied = requireAnalyst(req);
 *     if (denied) return denied;
 *
 * Fails closed when `ANALYST_API_KEY` is unset. An unset secret is a
 * misconfiguration, and the alternative — treating "no key configured" as "no
 * key required" — turns a forgotten env var into an open door over the whole
 * onboarding queue.
 */
export function requireAnalyst(req: Request): NextResponse | null {
  const expected = process.env.ANALYST_API_KEY;

  if (!expected) {
    console.error('ANALYST_API_KEY is not set — refusing all analyst API requests.');
    return analystJson(req, { error: 'Analyst API is not configured.' }, { status: 503 });
  }

  const provided = req.headers.get(ANALYST_KEY_HEADER);
  if (!provided || provided !== expected) {
    return analystJson(req, { error: 'Invalid or missing analyst key.' }, { status: 401 });
  }

  return null;
}

/**
 * Who to record as the reviewer on an approval or rejection.
 *
 * There is no analyst login yet (deferred — see the plan's §9), so decisions
 * are attributed to a single configured name. It's read from an env var rather
 * than hardcoded so the demo can be run under a real reviewer's name, and it
 * keeps `onboarding_requests.reviewed_by` populated with something meaningful
 * from day one, so adding real analyst identities later doesn't require a
 * backfill or a schema change.
 */
export function demoAnalystName(): string {
  return process.env.ANALYST_DISPLAY_NAME || 'A. Kumar';
}
