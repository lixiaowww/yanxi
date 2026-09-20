import { runBriefingPipeline } from "../src/lib/pipeline.js";

const SAMPLE = `据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展，因地制宜发展新质生产力，继续推进改革开放，在发展中保障和改善民生，维护社会和谐稳定。会议指出，当前外部环境复杂多变，要增强忧患意识，同时坚定信心，推动经济持续回升向好。`;

const result = await runBriefingPipeline({
  sourceText: SAMPLE,
  sourceLabel: "sample-xinhua-style-excerpt",
  forceOffline: true,
});

console.log(JSON.stringify(result, null, 2));
if (!result.gate.passed) process.exit(1);

const need = ["party-state-lexicon", "macro-policy-cycle"];
for (const card of need) {
  if (!result.matchedCards.includes(card)) {
    console.error(`Expected ${card} match; got:`, result.matchedCards);
    process.exit(1);
  }
}

if (!result.briefing.policy_outlook?.scenarios?.length) {
  console.error("Expected policy_outlook.scenarios");
  process.exit(1);
}

console.log("\n✅ offline demo OK (yanxi)");
