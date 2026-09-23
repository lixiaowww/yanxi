/**
 * Regression test for a real production failure (found by hand against the
 * live Groq deployment, 2026-09-21): a small open model returned a
 * source_digest_zh quote with a self-invented source_label instead of
 * echoing the label given in the prompt, and omitted briefing_en entirely.
 *
 * Before the fix: gate.passed was false (quote-not-in-source, even though
 * the quote was a real substring) and briefing_en/policy_outlook were both
 * null — a "successful" mode:"llm" response with an empty reader-facing
 * brief and a false hard-gate failure.
 *
 * 2026-09-22: the most common shape of this failure — the model echoing the
 * system prompt's JSON-schema example placeholder ("paste-1"/"paste-2")
 * verbatim instead of substituting the real label — is now deterministically
 * corrected in pipeline.ts before the gate even runs (see the "paste-(\d+)"
 * remap next to `sources_used`). This test now covers both: a genuinely
 * invented label that isn't the placeholder pattern (still a soft gate
 * finding, not a hard fail) and the placeholder-echo case (silently fixed,
 * no finding at all).
 */
process.env.LLM_API_KEY = "test-key";
process.env.LLM_BASE_URL = "https://example.invalid/v1";
process.env.LLM_MODEL = "test-model";

import { runBriefingPipeline } from "../src/lib/pipeline.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const SOURCE_TEXT =
  "工业和信息化部有关负责人称，要巩固新能源汽车产业优势。会议要求有关部门于2026年底前出台配套办法，安排专项资金不少于30亿元支持动力电池与充电桩试点，严禁骗补。";

// Reproduces the exact malformed shape seen from production: a real quote,
// a self-invented source_label the pipeline never gave the model, and no
// briefing_en at all.
const MALFORMED_LLM_RESPONSE = {
  source_digest_zh: [
    {
      point: "MIIT commits funding and a deadline for EV pilots.",
      quote:
        "2026年底前出台配套办法，安排专项资金不少于30亿元支持动力电池与充电桩试点，严禁骗补",
      source_label: "wire-report-alpha", // not the real label, and not the paste-N placeholder pattern either
    },
  ],
  context_notes: [],
  info_triage: undefined,
};

(globalThis as { fetch: typeof fetch }).fetch = (async () =>
  ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(MALFORMED_LLM_RESPONSE) } }] }),
  }) as Response) as typeof fetch;

const result = await runBriefingPipeline({
  sourceText: SOURCE_TEXT,
  sourceLabel: "domain-hot-ev-fallback-test",
  forceOffline: false,
});

assert(result.mode === "llm", "the (malformed) LLM call should still count as mode llm");

assert(
  result.gate.passed,
  "a real quote must not hard-fail the gate just because source_label doesn't match — got: " +
    JSON.stringify(result.gate.findings)
);
const mismatch = result.gate.findings.find((f) => f.id === "quote-source-label-mismatch");
assert(mismatch && mismatch.severity === "soft", "label mismatch should still surface as a soft finding");

assert(
  Boolean(result.briefing.briefing_en?.what),
  "briefing_en.what must be synthesized when the LLM omits briefing_en entirely"
);
assert(
  Boolean(result.briefing.briefing_en?.so_what),
  "briefing_en.so_what must be synthesized from content_analysis when missing"
);
assert(
  (result.briefing.policy_outlook?.scenarios?.length || 0) > 0,
  "policy_outlook must be backfilled from content_analysis when the LLM omits briefing_en"
);

console.log("✅ test:llm-fallback OK (genuine label mismatch → soft finding)");

// Second scenario: the model echoes the schema example's literal
// placeholder ("paste-1") instead of a real invented label. This is the
// dominant real-world shape of the failure, and should be silently
// corrected to the actual source label — no gate finding at all.
const PLACEHOLDER_LLM_RESPONSE = {
  source_digest_zh: [
    {
      point: "MIIT commits funding and a deadline for EV pilots.",
      quote:
        "2026年底前出台配套办法，安排专项资金不少于30亿元支持动力电池与充电桩试点，严禁骗补",
      source_label: "paste-1",
    },
  ],
  context_notes: [],
  info_triage: undefined,
};
(globalThis as { fetch: typeof fetch }).fetch = (async () =>
  ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(PLACEHOLDER_LLM_RESPONSE) } }] }),
  }) as Response) as typeof fetch;

const result2 = await runBriefingPipeline({
  sourceText: SOURCE_TEXT,
  sourceLabel: "domain-hot-ev-fallback-test",
  forceOffline: false,
});

assert(
  result2.briefing.source_digest_zh?.[0]?.source_label === "domain-hot-ev-fallback-test",
  `paste-1 placeholder should be remapped to the real single source label, got: ${result2.briefing.source_digest_zh?.[0]?.source_label}`
);
assert(
  !result2.gate.findings.some((f) => f.id === "quote-source-label-mismatch"),
  "remapped placeholder label should not still surface as a mismatch finding"
);

console.log("✅ test:llm-fallback OK (paste-N placeholder echo → silently remapped)");

// Third scenario: the placeholder token leaks into free-text prose (e.g. a
// scenario's `basis` field), not just source_digest_zh.source_label — the
// real production shape found 2026-09-22 while reviewing showcase output.
// sanitizePasteholders (pipeline.ts) must sweep every string, not just the
// one field the earlier fix targeted.
const PROSE_LEAK_RESPONSE = {
  briefing_en: {
    what: "MIIT commits funding for EV pilots.",
    context: "Routine implementation step.",
    so_what: "Watch for the funded pilots to launch.",
    confidence: "medium",
  },
  policy_outlook: {
    horizon: "near",
    scenarios: [
      {
        label: "Pilots launch as funded",
        likelihood: "medium",
        basis: "paste-1 already names a funding commitment for EV pilots.",
        trigger: "Public pilot list appears.",
        alternative: "paste-1's funding language could be rhetorical.",
        falsifier: "No pilot list appears within a year.",
        tag: "hypothesis",
      },
    ],
  },
};
(globalThis as { fetch: typeof fetch }).fetch = (async () =>
  ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(PROSE_LEAK_RESPONSE) } }] }),
  }) as Response) as typeof fetch;

const result3 = await runBriefingPipeline({
  sourceText: SOURCE_TEXT,
  sourceLabel: "domain-hot-ev-fallback-test",
  forceOffline: false,
});
const basis = result3.briefing.policy_outlook?.scenarios?.[0]?.basis || "";
const alternative = result3.briefing.policy_outlook?.scenarios?.[0]?.alternative || "";
assert(!/paste-\d+/.test(basis), `scenario.basis must not still contain a paste-N placeholder, got: "${basis}"`);
assert(
  basis.includes("domain-hot-ev-fallback-test"),
  `scenario.basis should have "paste-1" replaced with the real source label, got: "${basis}"`
);
assert(!/paste-\d+/.test(alternative), `scenario.alternative must not still contain a paste-N placeholder, got: "${alternative}"`);

console.log("✅ test:llm-fallback OK (paste-N leaked into free-text prose → swept everywhere, not just one field)");
