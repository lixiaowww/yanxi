/**
 * Multi-source corroboration + related-brief discovery smoke test.
 */
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { listDomainFixtures } from "../src/lib/domains.js";
import { topicKeysFromBriefing } from "../src/lib/related-briefs.js";

const fixtures = listDomainFixtures();
const meeting = fixtures.find((f) => f.id === "macro-cewc");
const instrument = fixtures.find((f) => f.id === "macro-instrument");
if (!meeting || !instrument) {
  console.error("missing macro fixtures");
  process.exit(1);
}

const single = await runBriefingPipeline({
  sourceText: meeting.sourceText,
  sourceLabel: meeting.sourceLabel,
  forceOffline: true,
});
const merged = await runBriefingPipeline({
  sources: [
    { label: meeting.sourceLabel, text: meeting.sourceText },
    { label: instrument.sourceLabel, text: instrument.sourceText },
  ],
  forceOffline: true,
});

const sCorr = single.briefing.corroboration?.score_0_to_3 ?? 0;
const mCorr = merged.briefing.corroboration?.score_0_to_3 ?? 0;
console.log(`single corr=${sCorr} sources=${single.sourceCount}`);
console.log(`merged corr=${mCorr} sources=${merged.sourceCount} shared=${(merged.briefing.corroboration?.shared_subjects || []).join(",")}`);

if (merged.sourceCount < 2) {
  console.error("merged run should report ≥2 sources");
  process.exit(1);
}
if (mCorr <= sCorr) {
  console.error(`expected merged corroboration > single (${mCorr} vs ${sCorr})`);
  process.exit(1);
}

const keys = topicKeysFromBriefing(merged.briefing, meeting.sourceText + instrument.sourceText);
if (!keys.some((k) => k.startsWith("subj:") || k.startsWith("desk:"))) {
  console.error("expected topic keys on merged brief", keys);
  process.exit(1);
}

console.log("✅ test:multi-source OK");
