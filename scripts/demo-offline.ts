import { runBriefingPipeline } from "../src/lib/pipeline.js";
import fs from "fs";
import path from "path";

const SAMPLE = `据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展，因地制宜发展新质生产力，继续推进改革开放，在发展中保障和改善民生，维护社会和谐稳定。会议指出，当前外部环境复杂多变，要增强忧患意识，同时坚定信心，推动经济持续回升向好。`;

const instrument = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "examples/sample-instrument.json"), "utf8")
) as { sourceLabel: string; sourceText: string };

const single = await runBriefingPipeline({
  sourceText: SAMPLE,
  sourceLabel: "sample-xinhua-style-excerpt",
  forceOffline: true,
});

if (!single.gate.passed) {
  console.error("single-source gate fail", single.gate.findings);
  process.exit(1);
}

const need = ["party-state-lexicon", "macro-policy-cycle", "policy-signaling-valves"];
for (const card of need) {
  if (!single.matchedCards.includes(card)) {
    console.error(`Expected ${card}; got`, single.matchedCards);
    process.exit(1);
  }
}

const card = single.briefing.signaling_scorecard;
if (!card?.rules || card.rules.length < 10) {
  console.error("Expected signaling_scorecard.rules");
  process.exit(1);
}

const triage = single.briefing.info_triage;
if (!triage?.importance?.grade) {
  console.error("Expected info_triage");
  process.exit(1);
}

const merged = await runBriefingPipeline({
  sources: [
    { label: "sample-xinhua-style-excerpt", text: SAMPLE },
    { label: instrument.sourceLabel, text: instrument.sourceText },
  ],
  forceOffline: true,
});

if (!merged.gate.passed) {
  console.error("merged gate fail", merged.gate.findings);
  process.exit(1);
}
if (merged.sourceCount !== 2) {
  console.error("Expected sourceCount=2", merged.sourceCount);
  process.exit(1);
}
const labeled = (merged.briefing.source_digest_zh || []).some((r) => r.source_label);
if (!labeled) {
  console.error("Expected source_label on digest rows");
  process.exit(1);
}

const newCards = [
  "five-year-plan-lexicon",
  "finance-risk-lexicon",
  "ideology-education-lexicon",
  "rural-revitalization-lexicon",
  "dual-circulation-lexicon",
];
const probe = await runBriefingPipeline({
  sourceText:
    "十四五规划纲要强调产业链供应链安全可控，推进乡村振兴与粮食安全，同时统筹金融风险防范，开展主题教育学习贯彻。双循环格局下要建设全国统一大市场。",
  sourceLabel: "cards-probe",
  forceOffline: true,
});
const hitNew = newCards.filter((c) => probe.matchedCards.includes(c));
if (hitNew.length < 3) {
  console.error("Expected ≥3 new context cards; got", probe.matchedCards);
  process.exit(1);
}

console.log(JSON.stringify({ singleCards: single.matchedCards.length, mergedSources: merged.sourceCount, newCardHits: hitNew }, null, 2));
console.log("\n✅ offline demo OK (yanxi) — Phase D multi-source + new cards");
console.log(
  `scorecard: ${card.rules.length} rules, band=${card.band}; triage=${triage.importance.grade}; newCards=${hitNew.join(",")}`
);
