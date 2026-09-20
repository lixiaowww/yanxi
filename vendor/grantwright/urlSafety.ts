// Vendored from lixiaowww/grantwright src/lib/urlSafety.ts (dependency-free).
// Sibling checkout: /mnt/external_storage/File/grantwright

// SSRF protection for every server-side fetch of a caller-supplied URL.
//
// Lives in src/lib/ so regression-static.ts (no network, no secrets —
// CLAUDE.md §7) can test it directly, same reason as hardGates.ts and
// matchBuckets.ts.
//
// WHY THIS FILE EXISTS (2026-08-01 architecture audit):
//
// This logic previously existed as THREE byte-identical private copies, in
// assess.ts (isBlockedUrl), candidates.ts (isUnsafeUrl) and missed.ts
// (isUnsafeUrl). missed.ts's own comment acknowledged the duplication —
// "Kept deliberately in sync with assess.ts's list rather than imported" —
// i.e. the drift risk was known and accepted. They had not yet drifted; that
// was luck, not structure, and it is exactly the "one fact, several
// independent implementations" pattern CLAUDE.md §8 exists to close.
//
// The audit also found a REAL, live vulnerability that the duplication
// hid: checking the host is necessary but NOT sufficient, because
// `redirect: "follow"` lets an allowed public URL 302 into a private
// address, and the browser/undici follows it without re-checking.
// assess.ts's tryFetch() got this right (manual hop loop, re-validating
// every hop — its own comment: "a public URL may 302 to an internal
// address"). candidates.ts did NOT: quoteIsOnLivePage() and autoResearch()
// both validated once, then fetched with redirect: "follow".
//
// THREAT MODEL — corrected 2026-08-02. The original version of this note
// (and commit 6fdac56's message) claimed /api/missed was a PUBLIC,
// unauthenticated endpoint where anyone could submit a source_url. That was
// WRONG: missed.ts's POST path is behind isAuthed. Recorded here rather
// than quietly edited, because an overstated severity left in the tree is
// its own hazard — it distorts every later risk decision that cites it.
//
// The accurate model is a privilege step-up, not an anonymous attack:
//   1. A consultant-level token (shared SESSION_SECRET, so a low bar — any
//      of Mia/Karla/Sean's credentials, or a leak of any one of them)
//      submits a source_url. It only has to pass the initial host check.
//   2. Later, a reviewer runs verify or auto_research on that report, and
//      the SERVER fetches the URL from inside the deployment.
//   3. An attacker-controlled page redirecting to 169.254.169.254 (cloud
//      metadata) or an internal host would have been followed.
// So: not externally reachable, but it converts consultant-level access
// into server-side request forgery, which reaches things a consultant
// cannot — and the fix is cheap either way.
//
// So this module deliberately exports BOTH the guard and a redirect-safe
// fetch. Exporting only the guard is what produced the vulnerability: every
// caller then has to independently remember that the guard alone doesn't
// cover redirects, and one of three didn't.

const MAX_REDIRECT_HOPS = 4;

// Blocks anything that isn't a plain public http(s) address: non-http
// schemes, localhost/.local/.internal, cloud metadata endpoints, RFC1918
// and link-local ranges, IPv6 loopback/ULA/link-local.
//
// Known limitation, stated rather than implied: this is a HOSTNAME check,
// so it does not stop DNS rebinding or a public hostname whose A record
// resolves to a private address. Closing that needs resolve-then-connect
// pinning, which neither undici's fetch nor Vercel's runtime exposes
// cleanly. The redirect-hop re-validation below is the higher-value fix
// (a real, demonstrated bypass); rebinding remains accepted risk for a
// consultant-facing tool whose fetch targets are government program pages.
export function isUnsafeUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return true; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return true;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "169.254.169.254" || host === "metadata.google.internal") return true;
  if (/^(127|10|0)\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  return false;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

// A discriminated union, so `if (!result.ok)` narrows and callers cannot
// reach `.response` on a failure without TypeScript stopping them.
//
// This shipped briefly as a flat interface with optional fields, because
// tsconfig.json had no `strict`/`strictNullChecks` and TS therefore refused
// to narrow the union — every call site failed to compile. Enabling strict
// (2026-08-02) turned out to cost 7 errors project-wide, not the ~1162 a
// first measurement suggested; that number was almost entirely cascading
// noise from @types/react never having been installed. With types installed
// and strict on, the union works as intended and the optional-field
// workaround is gone.
// `text` is read here rather than left to the caller (2026-08-03). Returning
// a Response leaked an armed timer: the AbortSignal.timeout below stays live
// after this function returns, so a page whose HEADERS arrived inside the
// budget but whose BODY finished after it threw DOMException [TimeoutError]
// out of the caller's `await resp.text()` — a line that reads like a pure
// string operation and so was written outside anyone's try/catch. It cost a
// whole regression run (every result discarded at the point of the throw)
// and, in production, would have turned candidates.ts's deliberate
// "could not be fetched" 422 into an unhandled rejection with no response
// written at all. Two call sites existed; one had a try/catch and one did
// not, which is the tell that the trap was in the contract, not the caller.
// Reading the body inside the same try that owns the timeout puts every
// timeout on one path with one shape, and leaves callers nothing to forget.
export type SafeFetchResult =
  | { ok: true; response: Response; text: string; finalUrl: string }
  | { ok: false; reason: string; blocked: boolean };

// Fetches a caller-supplied URL with SSRF protection that holds ACROSS
// redirects: every hop is re-validated before it is followed, using
// redirect: "manual" so nothing is followed implicitly.
//
// `blocked: true` distinguishes "we refused this on safety grounds" from
// "the remote side failed", so callers can report the two differently —
// a safety refusal needs human review, a 404 just needs a better URL.
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { headers = {}, timeoutMs = 15000 } = opts;
  let current = rawUrl;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    if (isUnsafeUrl(current)) {
      return {
        ok: false,
        blocked: true,
        reason: hop === 0
          ? `failed the SSRF safety check (${current})`
          : `redirected to an unsafe address after ${hop} hop(s) (${current}) — a public URL that redirects into a private range is the exact bypass this check exists to stop`,
      };
    }
    let resp: Response;
    try {
      resp = await fetch(current, { headers, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    } catch (e: any) {
      return { ok: false, blocked: false, reason: `could not be fetched (${e?.message || "unknown error"})` };
    }
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) return { ok: false, blocked: false, reason: `returned HTTP ${resp.status} with no Location header` };
      try {
        current = new URL(loc, current).toString();
      } catch {
        return { ok: false, blocked: true, reason: `returned an unparseable redirect target (${loc})` };
      }
      continue;
    }
    let text: string;
    try {
      text = await resp.text();
    } catch (e: any) {
      // Same shape as the fetch failure above: from the caller's side a body
      // that never finished arriving is indistinguishable from one that never
      // started, and both mean "we do not know what this page says".
      return { ok: false, blocked: false, reason: `could not be fetched (${e?.message || "unknown error"})` };
    }
    return { ok: true, response: resp, text, finalUrl: current };
  }
  return { ok: false, blocked: false, reason: `exceeded ${MAX_REDIRECT_HOPS} redirects` };
}
