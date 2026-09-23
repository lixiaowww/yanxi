/**
 * Regression test for docs/DP-V3.md §4 — corroboration.channel_tier_spread.
 * Cross-source agreement is more informative when the sources sit at
 * different institutional levels than when they're at the same level.
 * Requires SourceInput.channelTier to survive normalizeSources → buildCorroboration.
 */
import { runBriefingPipeline } from "../src/lib/pipeline.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const a = "国务院办公厅近日印发通知，要求有关部门制定实施方案，因地制宜推进新质生产力相关试点。";
const b = "据本省日报报道，省政府转发国办通知，要求各地做好新质生产力试点落地工作。";

const crossTier = await runBriefingPipeline({
  sources: [
    { label: "gov.cn notice", text: a, channelTier: "ministry_official" },
    { label: "provincial paper", text: b, channelTier: "local_party_organ" },
  ],
  forceOffline: true,
});
const spread = crossTier.briefing.corroboration?.channel_tier_spread;
assert(spread, "channel_tier_spread must be populated when ≥2 sources carry known channel tiers");
assert(spread.cross_tier === true, "sources at different tiers must set cross_tier=true");
assert(
  spread.tiers?.includes("ministry_official") && spread.tiers?.includes("local_party_organ"),
  "tiers list must name both institutional levels"
);

const sameTier = await runBriefingPipeline({
  sources: [
    { label: "gov.cn notice", text: a, channelTier: "ministry_official" },
    { label: "another ministry notice", text: b, channelTier: "ministry_official" },
  ],
  forceOffline: true,
});
assert(
  sameTier.briefing.corroboration?.channel_tier_spread?.cross_tier === false,
  "sources at the same tier must set cross_tier=false"
);

const noTierInfo = await runBriefingPipeline({
  sources: [
    { label: "source A", text: a },
    { label: "source B", text: b },
  ],
  forceOffline: true,
});
assert(
  noTierInfo.briefing.corroboration?.channel_tier_spread === undefined,
  "channel_tier_spread must stay undefined when no source carries a known channel tier — never fabricate a spread"
);

console.log("✅ test:channel-tier-corroboration OK");
