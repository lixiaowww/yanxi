/**
 * Regression test for the Jev fast-triage gate (docs/DP-V3.md §7 task #5,
 * revised to add has_concrete_detail). Mocks fetch like test-llm-fallback.ts
 * does — no real TYPESAFE_API_KEY needed for CI. Covers: happy path (all
 * four questions answered), a boilerplate/no-detail answer, fail-open on
 * HTTP error, fail-open on malformed choice, and unconfigured (no key at
 * all) returning null immediately without calling fetch.
 */
process.env.TYPESAFE_API_KEY = "test-key";
process.env.JEV_BASE_URL = "https://example.invalid/v1";
process.env.JEV_MODEL = "test-jev-model";

import { jevGateCheck } from "../src/lib/jev-gate.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

function mockFetch(status: number, body: unknown) {
  (globalThis as { fetch: typeof fetch }).fetch = (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as Response) as typeof fetch;
}

// 1. Happy path.
mockFetch(200, {
  model: "test-jev-model",
  answers: {
    in_scope: { type: "choice", choice: "yes", confidence: 0.9 },
    language_quality: { type: "choice", choice: "clean", confidence: 0.95 },
    priority_hint: { type: "choice", choice: "P2", confidence: 0.7 },
    has_concrete_detail: { type: "choice", choice: "yes", confidence: 0.85 },
  },
});
const happy = await jevGateCheck({ text: "国务院办公厅近日印发通知……", label: "test" });
assert(happy, "happy path must return a result, not null");
assert(happy.in_scope === true, "in_scope must be true from choice=yes");
assert(happy.language_quality === "clean", "language_quality must pass through");
assert(happy.priority_hint === "P2", "priority_hint must pass through");
assert(happy.has_concrete_detail === true, "has_concrete_detail must be true from choice=yes");
assert(happy.confidence?.in_scope === 0.9, "per-question confidence must be carried");
assert(happy.confidence?.has_concrete_detail === 0.85, "has_concrete_detail confidence must be carried");
console.log("✅ jev-gate: happy path");

// 1b. Boilerplate/no-detail answer must parse to has_concrete_detail=false.
mockFetch(200, {
  model: "test-jev-model",
  answers: {
    in_scope: { type: "choice", choice: "yes", confidence: 0.9 },
    language_quality: { type: "choice", choice: "clean", confidence: 0.95 },
    priority_hint: { type: "choice", choice: "P4", confidence: 0.8 },
    has_concrete_detail: { type: "choice", choice: "no", confidence: 0.88 },
  },
});
const boilerplate = await jevGateCheck({ text: "要坚持不懈抓好各项工作，全面推动各项事业迈上新台阶。", label: "test" });
assert(boilerplate, "boilerplate case must still return a result, not null");
assert(boilerplate.has_concrete_detail === false, "has_concrete_detail must be false from choice=no");
console.log("✅ jev-gate: boilerplate/no-detail answer");

// 2. HTTP failure → fail open (null), never throws.
mockFetch(500, {});
const httpFail = await jevGateCheck({ text: "x" });
assert(httpFail === null, "HTTP failure must fail open (null), not throw");
console.log("✅ jev-gate: HTTP failure fails open");

// 3. Malformed/missing choice → fail open (null), never a half-valid result.
mockFetch(200, { model: "test-jev-model", answers: {} });
const malformed = await jevGateCheck({ text: "x" });
assert(malformed === null, "malformed response must fail open (null)");
console.log("✅ jev-gate: malformed response fails open");

// 4. Unconfigured (no key) → null immediately, fetch never called.
delete process.env.TYPESAFE_API_KEY;
delete process.env.JEV_API_KEY;
let fetchCalled = false;
(globalThis as { fetch: typeof fetch }).fetch = (async () => {
  fetchCalled = true;
  throw new Error("must not be called when unconfigured");
}) as typeof fetch;
const unconfigured = await jevGateCheck({ text: "x" });
assert(unconfigured === null, "unconfigured must return null");
assert(!fetchCalled, "unconfigured must not call fetch at all");
console.log("✅ jev-gate: unconfigured short-circuits before any network call");

console.log("✅ test:jev-gate OK");
