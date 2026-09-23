/**
 * Regression test for "absence as signal" (docs/DP-V3.md §4, task #7).
 * Writes a real prior brief to a temp outbox root via the actual pipeline,
 * then calls detectAbsenceSignal with an injected `now` far enough in the
 * future to simulate a real silence gap — no need to wait for real
 * collection history to accumulate (see absence-signal.ts's module doc for
 * why that requirement was wrong).
 */
import fs from "fs";
import os from "os";
import path from "path";
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { writePasteBrief } from "../src/lib/outbox.js";
import { detectAbsenceSignal, GAP_DAYS_THRESHOLD } from "../src/lib/absence-signal.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "yanxi-absence-signal-"));

// A prior brief with real coverage of a specific subject.
const priorText =
  "中央经济工作会议强调，要统筹发展和安全，稳妥化解地方债与隐性债务风险，持续做好保交楼工作，促进房地产市场平稳健康发展。";
const priorResult = await runBriefingPipeline({
  sourceText: priorText,
  sourceLabel: "prior-coverage",
  forceOffline: true,
});
writePasteBrief(priorResult, { label: "prior-coverage", text: priorText }, root);

// A new, thin, terse item on the SAME subject — the "one unified notice
// after silence" shape.
const terseText = "有关部门就地方债风险问题发布权威通报，要求各地稳妥处置。";
const newResult = await runBriefingPipeline({
  sourceText: terseText,
  sourceLabel: "terse-followup",
  forceOffline: true,
});

// Simulate a real gap by moving `now` forward, rather than needing to wait
// for real time to pass or fabricating a backdated outbox file.
const farFuture = new Date(Date.now() + (GAP_DAYS_THRESHOLD + 5) * 86_400_000);
const signal = detectAbsenceSignal({
  briefing: newResult.briefing,
  sourceText: terseText,
  substanceBand: newResult.briefing.substance_cut?.band,
  now: farFuture,
  root,
});

assert(signal, "expected an absence signal when prior coverage + a gap + a thin new item all line up");
assert(signal.hits.length > 0, "expected at least one subject hit");
const flagged = signal.hits.find((h) => h.pattern_match);
assert(flagged, `expected at least one pattern_match=true hit, got: ${JSON.stringify(signal.hits)}`);
assert(flagged.prior_coverage_count >= 1, "prior_coverage_count must reflect the real prior brief");
assert(flagged.gap_days > GAP_DAYS_THRESHOLD, "gap_days must exceed the threshold for pattern_match");
console.log("✅ absence-signal: flags coverage → silence → terse-notice pattern");

// Control: same subject, but `now` stays close to the prior brief — no gap,
// must not flag even though prior coverage + thin item are both present.
const noGapSignal = detectAbsenceSignal({
  briefing: newResult.briefing,
  sourceText: terseText,
  substanceBand: newResult.briefing.substance_cut?.band,
  now: new Date(),
  root,
});
assert(
  !noGapSignal?.hits.some((h) => h.pattern_match),
  "must not flag pattern_match when there is no real gap yet"
);
console.log("✅ absence-signal: does not false-positive without a real gap");

// Control: a subject with no prior coverage at all must not appear in hits.
const brandNewText = "国家医疗保障局发布关于跨省异地就医结算的最新工作方案。";
const brandNewResult = await runBriefingPipeline({
  sourceText: brandNewText,
  sourceLabel: "brand-new-subject",
  forceOffline: true,
});
const noneSignal = detectAbsenceSignal({
  briefing: brandNewResult.briefing,
  sourceText: brandNewText,
  substanceBand: brandNewResult.briefing.substance_cut?.band,
  now: farFuture,
  root,
});
assert(
  !noneSignal || noneSignal.hits.length === 0,
  "a genuinely new subject with no prior coverage must not be treated as absent"
);
console.log("✅ absence-signal: a new subject (no prior coverage) is not flagged as absent");

console.log("✅ test:absence-signal OK");
