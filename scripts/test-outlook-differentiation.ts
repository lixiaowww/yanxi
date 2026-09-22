/**
 * Two fixes to the F12 freshness cap, prompted by a real observation: an
 * undated single-source paste (the overwhelming majority of real pastes)
 * always got Outlook likelihood clamped to "low" across every scenario,
 * with zero differentiation — the four-piece forecast work was invisible
 * in the single most common case. See docs/DP-brief-quality.md §4.9.
 *
 * 1. A relative time cue ("近日") is weaker evidence than a real date, but
 *    it is not NO evidence — it now gets its own "weak" freshness band
 *    (distinct from "unknown"/no date at all) with a higher likelihood cap.
 * 2. The cap still legally collapses several scenarios to the same
 *    displayed word, but scenario ORDER now still reflects which one the
 *    rule engine ranked higher before capping, so relative signal survives
 *    even when the label doesn't.
 */
import { buildTemporalCut } from "../src/lib/temporal.js";
import { outlookLikelihoodCap } from "../src/lib/brief-quality.js";
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { listDomainFixtures } from "../src/lib/domains.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

// 1. "weak" band + cap.
const briefed = new Date("2026-09-22T12:00:00Z");
const relativeCue = buildTemporalCut({
  text: "据新华社北京电，近日召开的中央经济工作会议强调高质量发展。",
  briefedAt: briefed,
});
assert(relativeCue.freshness.band === "weak", "relative cue must land on the weak band, not unknown");
assert(outlookLikelihoodCap(relativeCue) === "medium", "weak band should cap at medium, not low");

const noDateAtAll = buildTemporalCut({
  text: "各地各部门要提高政治站位，坚持高质量发展。",
  briefedAt: briefed,
});
assert(noDateAtAll.freshness.band === "unknown", "genuinely no time cue must still be unknown");
assert(outlookLikelihoodCap(noDateAtAll) === "low", "unknown band still caps at low — no regression");

console.log("✅ freshness bands: relative cue (weak→medium cap) is distinct from no date at all (unknown→low cap)");

// 2. Scenario order survives capping even when the fixture is undated.
const fixtures = listDomainFixtures();
const evFixture = fixtures.find((f) => f.id === "hot-electric-vehicles")!;
const result = await runBriefingPipeline({
  sourceText: evFixture.sourceText,
  sourceLabel: evFixture.sourceLabel,
  forceOffline: true,
});
assert(
  result.briefing.temporal?.freshness?.band === "unknown",
  "this fixture has no dateline — exercising the tightest cap on purpose"
);
const scenarios = result.briefing.policy_outlook?.scenarios || [];
assert(scenarios.length >= 2, "expected at least 2 scenarios to check ordering");
assert(
  scenarios.every((s) => s.likelihood === "low"),
  "under the tightest cap every displayed likelihood is still (correctly) low"
);
// The pre-clamp order is a fixed property of the domain profile's scenario
// factory (electric_vehicles: publicationScenario always first). Confirm
// clamping didn't shuffle it away — order is still meaningful even though
// the label is now uniform.
assert(
  /publish|measure|technical/i.test(scenarios[0].label || ""),
  `expected the publication scenario to stay first after clamping, got: "${scenarios[0].label}"`
);

console.log("✅ scenario order survives likelihood clamping (relative signal isn't destroyed by the cap)");
console.log("✅ test:outlook-differentiation OK");
