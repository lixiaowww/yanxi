/**
 * findRelatedBriefs must rank a clean single-topic match ahead of a
 * kitchen-sink candidate that only shares the topic because it merges many
 * unrelated domains into one giant excerpt (real production case: an
 * outbox entry from an old `job-fit-domain-battery` test run — 14 domains,
 * ~1800 chars — outranked a 150-char single-topic fixture on the same
 * subject purely by raw overlapping-key count). See docs/ROADMAP.md
 * "已知缺口" (now fixed) and src/lib/related-briefs.ts.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { writePasteBrief } from "../src/lib/outbox.js";
import { findRelatedBriefs } from "../src/lib/related-briefs.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "yanxi-related-specificity-"));

// Clean, single-topic candidate — same subject as the query, nothing else.
const singleTopic = `据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展，因地制宜发展新质生产力，继续推进改革开放，在发展中保障和改善民生，维护社会和谐稳定。`;
const rSingle = await runBriefingPipeline({
  sourceText: singleTopic,
  sourceLabel: "single-topic-cewc",
  forceOffline: true,
});
writePasteBrief(rSingle, { label: "single-topic-cewc", text: singleTopic }, root);

// Kitchen-sink candidate: same CEWC subject, but bolted onto several
// unrelated domains — mimics the real merged job-fit-domain-battery fixture.
const kitchenSink = [
  singleTopic,
  "外交部发言人指出，中加双边关系应相互尊重，加方在菜籽油、软木等产品上的措施引发关注。",
  "工业和信息化部有关负责人指出，要加快关键核心技术攻关，提升芯片与半导体产业链供应链韧性和安全可控水平。",
  "国防部新闻发言人表示，中方在台海问题上的立场一贯明确，反对任何形式的台独分裂活动。",
  "民政部有关负责人介绍，将持续做好社会救助兜底保障工作，巩固拓展脱贫攻坚成果。",
].join(" ");
const rSink = await runBriefingPipeline({
  sourceText: kitchenSink,
  sourceLabel: "kitchen-sink-merged-domains",
  forceOffline: true,
});
writePasteBrief(rSink, { label: "kitchen-sink-merged-domains", text: kitchenSink }, root);

// A new query excerpt on the same CEWC subject.
const query = `国务院办公厅近日印发通知，要求有关部门制定实施方案，因地制宜推进新质生产力相关试点，确保中央经济工作会议部署落到实处。`;
const rQuery = await runBriefingPipeline({
  sourceText: query,
  sourceLabel: "query-cewc-followup",
  forceOffline: true,
});

const related = findRelatedBriefs({ briefing: rQuery.briefing, sourceText: query, root, limit: 6 });
assert(related.length >= 2, `expected both candidates to match, got ${related.length}`);
assert(
  related[0].label === "single-topic-cewc",
  `clean single-topic candidate should rank first, got order: ${related.map((r) => r.label).join(", ")}`
);

console.log("✅ findRelatedBriefs ranks a clean single-topic match ahead of a merged kitchen-sink one");
console.log("✅ test:related-specificity OK");
