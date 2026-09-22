/**
 * Optional second LLM provider (src/lib/llm.ts): when the primary call
 * fails for any reason, retry against LLM_FALLBACK_* before giving up to
 * the offline template path. Added after a real production incident: the
 * primary (Groq free/on-demand tier) was hitting its per-minute token
 * limit on ordinary traffic, so every real paste fell back to offline —
 * see docs/DP-brief-quality.md §4.7.
 *
 * Mocks fetch — no real network/API keys needed.
 */
process.env.LLM_API_KEY = "primary-key";
process.env.LLM_BASE_URL = "https://primary.invalid/v1";
process.env.LLM_MODEL = "primary-model";
process.env.LLM_FALLBACK_API_KEY = "fallback-key";
process.env.LLM_FALLBACK_BASE_URL = "https://fallback.invalid/v1";
process.env.LLM_FALLBACK_MODEL = "fallback-model";

import { callLlmJson, callLlmJsonWithFallback, llmFallbackConfigured } from "../src/lib/llm.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

function mockFetch(byUrl: Record<string, { ok: boolean; status?: number; content?: string }>) {
  (globalThis as { fetch: typeof fetch }).fetch = (async (url: string) => {
    const key = Object.keys(byUrl).find((u) => url.startsWith(u));
    const spec = key ? byUrl[key] : undefined;
    if (!spec) throw new Error(`unexpected fetch to ${url}`);
    return {
      ok: spec.ok,
      status: spec.status ?? (spec.ok ? 200 : 500),
      text: async () =>
        spec.ok
          ? JSON.stringify({ choices: [{ message: { content: spec.content ?? "{}" } }] })
          : "primary provider error body",
    } as Response;
  }) as typeof fetch;
}

assert(llmFallbackConfigured(), "fallback should be reported as configured when all 3 vars are set");

// 1. Primary succeeds — fallback never touched.
mockFetch({
  "https://primary.invalid/v1": { ok: true, content: JSON.stringify({ hello: "primary" }) },
  "https://fallback.invalid/v1": { ok: false }, // would fail if ever called
});
const primaryOk = await callLlmJsonWithFallback<{ hello: string }>("sys", "user");
assert(primaryOk.provider === "primary", "should report primary when it succeeds");
assert(primaryOk.data.hello === "primary", "should return the primary's data");

// 2. Primary fails (e.g. Groq 429) — falls through to fallback provider.
mockFetch({
  "https://primary.invalid/v1": { ok: false, status: 429 },
  "https://fallback.invalid/v1": { ok: true, content: JSON.stringify({ hello: "fallback" }) },
});
const fellBack = await callLlmJsonWithFallback<{ hello: string }>("sys", "user");
assert(fellBack.provider === "fallback", "should report fallback when primary fails");
assert(fellBack.data.hello === "fallback", "should return the fallback's data");

// 3. Both fail — throws the PRIMARY's error (operators have a dashboard for it).
mockFetch({
  "https://primary.invalid/v1": { ok: false, status: 429 },
  "https://fallback.invalid/v1": { ok: false, status: 500 },
});
let threw = false;
try {
  await callLlmJsonWithFallback("sys", "user");
} catch (e) {
  threw = true;
  assert(e instanceof Error && /429/.test(e.message), "should surface the primary's error when both fail");
}
assert(threw, "should throw when both providers fail");

// 4. callLlmJson (single-provider, used by scenario-enrich) never touches fallback.
mockFetch({
  "https://primary.invalid/v1": { ok: true, content: JSON.stringify({ hello: "primary-only" }) },
  "https://fallback.invalid/v1": { ok: false },
});
const single = await callLlmJson<{ hello: string }>("sys", "user");
assert(single.hello === "primary-only", "callLlmJson should still hit only the primary provider");

console.log("✅ test:llm-fallback-provider OK");
