/**
 * Shared HTTP guards for the public demo server.
 *
 * Civilian scope: this only protects the operator's own LLM quota and the free
 * Render instance. It is not user tracking — IPs are used as short-lived
 * in-memory counter keys and are never persisted or written to the outbox.
 */
import fs from "fs";
import path from "path";
import type { Request } from "express";

export type HttpErrorLike = Error & { status: number; retryAfterSeconds?: number };

export function httpError(status: number, message: string, retryAfterSeconds?: number): HttpErrorLike {
  const err = new Error(message) as HttpErrorLike;
  err.status = status;
  if (retryAfterSeconds !== undefined) err.retryAfterSeconds = retryAfterSeconds;
  return err;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Number of proxy hops to trust for client IP resolution.
 * Render terminates TLS in front of the app and appends the real client IP as
 * the last X-Forwarded-For entry, so trusting exactly one hop keeps the value
 * unspoofable. Locally there is no proxy, so trust none.
 */
export function trustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return isProduction() ? 1 : 0;
}

/**
 * Token check for privileged actions (currently `/api/collect/run` only).
 * Convention: `x-yanxi-token` header, or `?token=` for convenience.
 *
 * `/api/brief` LLM runs are intentionally open when `LLM_API_KEY` is set;
 * abuse control there is IP rate limiting, not a shared secret.
 *
 * Fail-safe: in production an unset token means the action is refused, never
 * left open. Outside production an unset token means frictionless local dev.
 */
export function requireApiToken(
  req: Request,
  opts: { envVar: string; fallbackEnvVar?: string; action: string }
): void {
  const expected =
    process.env[opts.envVar] ||
    (opts.fallbackEnvVar ? process.env[opts.fallbackEnvVar] : undefined) ||
    "";
  if (!expected) {
    if (isProduction()) {
      throw httpError(
        403,
        `This deployment refuses ${opts.action} until the operator sets ${opts.envVar}.`
      );
    }
    return;
  }
  const got = String(req.headers["x-yanxi-token"] || req.query.token || "");
  if (got !== expected) {
    throw httpError(401, `Valid access token required (x-yanxi-token header) for ${opts.action}.`);
  }
}

export function clientKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  check(key: string): RateLimitDecision;
  reset(): void;
};

/**
 * Fixed-window counter, in-process, no runtime dependency.
 * The map is bounded: expired windows are pruned and the oldest entries are
 * evicted once `maxKeys` is reached, so a spray of unique IPs cannot grow it.
 */
export function createFixedWindowLimiter(opts: {
  windowMs: number;
  max: number;
  maxKeys?: number;
}): RateLimiter {
  const maxKeys = opts.maxKeys ?? 5000;
  const hits = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number): void {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next();
      if (oldest.done) break;
      hits.delete(oldest.value);
    }
  }

  return {
    check(key: string): RateLimitDecision {
      const now = Date.now();
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        prune(now);
        entry = { count: 0, resetAt: now + opts.windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return {
        allowed: entry.count <= opts.max,
        remaining: Math.max(0, opts.max - entry.count),
        retryAfterSeconds,
      };
    },
    reset(): void {
      hits.clear();
    },
  };
}

/**
 * Resolve `name` inside `baseDir` or return null.
 * Blocks traversal via encoded separators (`..%2F`) and absolute paths, which
 * express decodes into route params before we ever touch the filesystem.
 */
export function resolveInsideDir(baseDir: string, name: string): string | null {
  if (!name || name.includes("\0")) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  if (name === "." || name === "..") return null;
  const base = path.resolve(baseDir);
  const full = path.resolve(base, name);
  if (full !== path.join(base, name)) return null;
  if (!full.startsWith(base + path.sep)) return null;
  return full;
}

export function readFileInsideDir(baseDir: string, name: string): string | null {
  const full = resolveInsideDir(baseDir, name);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return fs.readFileSync(full, "utf8");
}
