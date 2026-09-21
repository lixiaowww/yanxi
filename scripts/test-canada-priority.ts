/**
 * Canada nexus is a core ranking parameter (not a minor tie-breaker):
 * - it moves importance grading by up to a full P-band (canada-nexus.ts)
 * - it reorders related-brief suggestions ahead of equally-matched candidates
 *   that don't touch Canada (related-briefs.ts)
 * See docs/RELIABILITY.md and docs/DP-brief-quality.md §4.6.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { canadaNexusImportanceBump } from "../src/lib/canada-nexus.js";
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { writePasteBrief } from "../src/lib/outbox.js";
import { findRelatedBriefs } from "../src/lib/related-briefs.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

assert(canadaNexusImportanceBump({ level: "direct" } as never) === 0.25, "direct bump is 0.25");
assert(canadaNexusImportanceBump({ level: "possible" } as never) === 0.12, "possible bump is 0.12");
assert(canadaNexusImportanceBump({ level: "none" } as never) === 0, "none bump is 0");
console.log("✅ canadaNexusImportanceBump: 0 / 0.12 / 0.25");

// Two same-topic candidates (shared subject "动力电池") — one also names
// Canada, one doesn't. Equal topical match; Canada nexus should decide order.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "yanxi-canada-priority-"));

const withCanada =
  "工业和信息化部有关负责人称，要巩固新能源汽车产业优势，并与加拿大方面就动力电池供应链开展对话。会议要求有关部门于2026年底前出台配套办法，安排专项资金不少于30亿元支持动力电池与充电桩试点，严禁骗补。";
const withoutCanada =
  "工业和信息化部有关负责人称，要巩固新能源汽车产业优势。会议要求有关部门于2026年底前出台配套办法，安排专项资金不少于20亿元支持动力电池与充电桩试点，严禁骗补。";

const rCanada = await runBriefingPipeline({
  sourceText: withCanada,
  sourceLabel: "canada-ev-dialogue",
  forceOffline: true,
});
assert(rCanada.briefing.canada_nexus?.level === "direct", "fixture must actually trip canada_nexus=direct");
writePasteBrief(rCanada, { label: "canada-ev-dialogue", text: withCanada }, root);

const rPlain = await runBriefingPipeline({
  sourceText: withoutCanada,
  sourceLabel: "plain-ev-notice",
  forceOffline: true,
});
assert((rPlain.briefing.canada_nexus?.level ?? "none") === "none", "control fixture must not trip canada_nexus");
writePasteBrief(rPlain, { label: "plain-ev-notice", text: withoutCanada }, root);

// A third, new excerpt on the same subject (动力电池) — related to both.
const query =
  "国家发展改革委表示，将支持动力电池行业扩大产能，相关试点年内启动。";
const rQuery = await runBriefingPipeline({
  sourceText: query,
  sourceLabel: "query-battery-capacity",
  forceOffline: true,
});

const related = findRelatedBriefs({
  briefing: rQuery.briefing,
  sourceText: query,
  root,
  limit: 6,
});
assert(related.length >= 2, `expected both candidates to match, got ${related.length}`);
assert(
  related[0].label === "canada-ev-dialogue",
  `Canada-relevant candidate should rank first, got order: ${related.map((r) => r.label).join(", ")}`
);
assert(related[0].canada_nexus === "direct", "top hit should carry canada_nexus=direct");

console.log("✅ findRelatedBriefs ranks a same-topic Canada-relevant candidate first");
console.log("✅ test:canada-priority OK");
