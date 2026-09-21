/**
 * Unit tests for the optional F13 LLM enrichment (src/lib/scenario-enrich.ts).
 * Mocks global fetch — no real network/API key needed — and asserts the
 * soft-fail contract: any malformed/duplicate/mismatched response must fall
 * back to null (rule-based fields), never throw and never break the brief.
 */
process.env.LLM_API_KEY = "test-key";
process.env.LLM_BASE_URL = "https://example.invalid/v1";
process.env.LLM_MODEL = "test-model";

import {
  enrichScenarioAlternatives,
  resetScenarioEnrichCooldown,
} from "../src/lib/scenario-enrich.js";
import type { PolicyScenario } from "../src/lib/gate.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const scenarios: PolicyScenario[] = [
  { label: "A publishes an implementing notice", basis: "b1", trigger: "t1", likelihood: "low", tag: "hypothesis" },
  { label: "B narrows to a pilot", basis: "b2", trigger: "t2", likelihood: "medium", tag: "hypothesis" },
  { label: "C slips past the deadline", basis: "b3", trigger: "t3", likelihood: "low", tag: "hypothesis" },
];

function mockFetchOnce(content: string, ok = true, status = 200) {
  (globalThis as { fetch: typeof fetch }).fetch = (async () =>
    ({
      ok,
      status,
      text: async () =>
        JSON.stringify({ choices: [{ message: { content } }] }),
    }) as Response) as typeof fetch;
}

async function run() {
  // 1. Happy path: distinct alternatives, all fields present → applied.
  mockFetchOnce(
    JSON.stringify({
      scenarios: [
        { index: 0, alternative: "Alt zero", falsifier: "Falsifier zero" },
        { index: 1, alternative: "Alt one", falsifier: "Falsifier one" },
        { index: 2, alternative: "Alt two", falsifier: "Falsifier two" },
      ],
    })
  );
  const good = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(good, "happy path should return enriched scenarios");
  assert(good!.length === 3, "happy path preserves scenario count");
  assert(good![0].alternative === "Alt zero", "happy path maps by index");
  assert(good![0].label === scenarios[0].label, "happy path never touches label");

  // 2. Duplicate alternatives across scenarios → reject the whole batch (ACH
  // discrimination failed), keep rule-based fields.
  mockFetchOnce(
    JSON.stringify({
      scenarios: [
        { index: 0, alternative: "Same reading", falsifier: "f0" },
        { index: 1, alternative: "Same reading", falsifier: "f1" },
        { index: 2, alternative: "Different", falsifier: "f2" },
      ],
    })
  );
  const dup = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(dup === null, "duplicate alternative text must soft-fail to null");

  // 3. Wrong scenario count → null.
  mockFetchOnce(
    JSON.stringify({ scenarios: [{ index: 0, alternative: "a", falsifier: "f" }] })
  );
  const shortCount = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(shortCount === null, "mismatched scenario count must soft-fail to null");

  // 4. Missing field → null.
  mockFetchOnce(
    JSON.stringify({
      scenarios: [
        { index: 0, alternative: "a0", falsifier: "" },
        { index: 1, alternative: "a1", falsifier: "f1" },
        { index: 2, alternative: "a2", falsifier: "f2" },
      ],
    })
  );
  const missingField = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(missingField === null, "empty falsifier must soft-fail to null");

  // 5. Malformed JSON from the model → null, never throws.
  mockFetchOnce("not json at all");
  const malformed = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(malformed === null, "malformed JSON must soft-fail to null, not throw");

  // 6. HTTP error → null, never throws.
  mockFetchOnce("server error", false, 500);
  const httpError = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(httpError === null, "HTTP error must soft-fail to null, not throw");

  // 7. HTTP 429 → null, and starts a cooldown so the next call doesn't even
  // hit the network (avoid digging a rate-limited provider's budget deeper).
  resetScenarioEnrichCooldown();
  mockFetchOnce("rate limited", false, 429);
  const rateLimited = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(rateLimited === null, "HTTP 429 must soft-fail to null");
  let fetchCalledDuringCooldown = false;
  (globalThis as { fetch: typeof fetch }).fetch = (async () => {
    fetchCalledDuringCooldown = true;
    throw new Error("should not be called during cooldown");
  }) as typeof fetch;
  const duringCooldown = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(duringCooldown === null, "call during 429 cooldown must soft-fail to null");
  assert(!fetchCalledDuringCooldown, "call during 429 cooldown must not hit the network");
  resetScenarioEnrichCooldown();

  // 8. Disabled via env switch → null without even calling fetch.
  process.env.YANXI_SCENARIO_ENRICH = "0";
  let fetchCalled = false;
  (globalThis as { fetch: typeof fetch }).fetch = (async () => {
    fetchCalled = true;
    throw new Error("should not be called");
  }) as typeof fetch;
  const disabled = await enrichScenarioAlternatives("source excerpt", scenarios);
  assert(disabled === null, "YANXI_SCENARIO_ENRICH=0 must disable enrichment");
  assert(!fetchCalled, "disabled enrichment must not call fetch at all");
  delete process.env.YANXI_SCENARIO_ENRICH;

  console.log("✅ test:scenario-enrich OK");
}

run().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
