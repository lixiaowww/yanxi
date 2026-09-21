/**
 * DP-brief-quality smoke: single → partial; dual+dated → complete;
 * unknown freshness caps likelihood; scenarios carry alternative/falsifier.
 */
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { listDomainFixtures } from "../src/lib/domains.js";
import {
  clampLikelihood,
  evaluateBriefQuality,
  outlookLikelihoodCap,
} from "../src/lib/brief-quality.js";
import { buildTemporalCut } from "../src/lib/temporal.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const fixtures = listDomainFixtures();
const meeting = fixtures.find((f) => f.id === "macro-cewc");
const instrument = fixtures.find((f) => f.id === "macro-instrument");
assert(meeting && instrument, "missing macro fixtures");

{
  const undated = buildTemporalCut({
    text: "各地各部门要提高政治站位，坚持高质量发展。",
    briefedAt: new Date("2026-09-21T15:00:00Z"),
  });
  assert(outlookLikelihoodCap(undated) === "low", "unknown → low cap");
  assert(clampLikelihood("high", "low") === "low", "clamp high→low");
  assert(clampLikelihood("medium", "medium") === "medium", "clamp medium stays");

  const partial = evaluateBriefQuality({
    adopted: true,
    distinctSourceCount: 1,
    temporal: undated,
  });
  assert(partial.level === "partial", "single undated → partial");
  assert(partial.missing.includes("second_public_source"), "missing second source");
  assert(partial.missing.includes("source_as_of"), "missing as-of");

  const dated = buildTemporalCut({
    text: "据新华社北京2026年9月18日电，会议要求出台配套办法。",
    briefedAt: new Date("2026-09-21T15:00:00Z"),
  });
  const complete = evaluateBriefQuality({
    adopted: true,
    distinctSourceCount: 2,
    temporal: dated,
  });
  assert(complete.level === "complete", "dual+dated → complete");

  const rejected = evaluateBriefQuality({
    adopted: false,
    distinctSourceCount: 1,
    temporal: undated,
  });
  assert(rejected.level === "rejected", "not adopted → rejected");
}

{
  // Direction-only meeting paste is not adopted → rejected quality.
  const thin = await runBriefingPipeline({
    sourceText: meeting.sourceText,
    sourceLabel: meeting.sourceLabel,
    forceOffline: true,
  });
  assert(thin.briefing.brief_quality?.level === "rejected", "meeting-only → rejected");
  console.log(`thin quality=${thin.briefing.brief_quality?.level}`);
}

{
  // Adopted single instrument → partial (needs second source and/or as-of).
  const single = await runBriefingPipeline({
    sourceText: instrument.sourceText,
    sourceLabel: instrument.sourceLabel,
    forceOffline: true,
  });
  const q = single.briefing.brief_quality;
  assert(q?.level === "partial", `instrument-only should be partial, got ${q?.level}`);
  assert(
    (q?.missing || []).includes("second_public_source"),
    "single missing second_public_source"
  );

  const scenarios = single.briefing.policy_outlook?.scenarios || [];
  assert(scenarios.length > 0, "adopted instrument should have outlook");
  for (const s of scenarios) {
    assert(s.alternative, `scenario missing alternative: ${s.label}`);
    assert(s.falsifier, `scenario missing falsifier: ${s.label}`);
  }
  if (single.briefing.temporal?.freshness?.band === "unknown") {
    assert(
      scenarios.every((s) => (s.likelihood || "low") === "low"),
      "unknown freshness must cap likelihood to low"
    );
  }
  console.log(
    `single quality=${q?.level} missing=${(q?.missing || []).join("|") || "—"} scenarios=${scenarios.length}`
  );
}

{
  const merged = await runBriefingPipeline({
    sources: [
      { label: meeting.sourceLabel, text: meeting.sourceText },
      { label: instrument.sourceLabel, text: instrument.sourceText },
    ],
    forceOffline: true,
    sourcePublishedAt: "2026-09-18",
  });
  const q = merged.briefing.brief_quality;
  assert(q?.level === "complete", `merged+dated should be complete, got ${q?.level}`);
  assert(!(q?.missing || []).length, "complete should have empty missing");
  const scenarios = merged.briefing.policy_outlook?.scenarios || [];
  assert(scenarios.length > 0, "merged adopted brief should have outlook");
  for (const s of scenarios) {
    assert(s.alternative, `merged scenario missing alternative: ${s.label}`);
    assert(s.falsifier, `merged scenario missing falsifier: ${s.label}`);
  }
  console.log(
    `merged quality=${q?.level} corr=${merged.briefing.corroboration?.score_0_to_3} scenarios=${scenarios.length}`
  );
}

console.log("✅ test:brief-quality OK");
