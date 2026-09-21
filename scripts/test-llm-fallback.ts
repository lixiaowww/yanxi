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
      source_label: "paste-1", // not the real label — model invented this
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

console.log("✅ test:llm-fallback OK");
