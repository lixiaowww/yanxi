/**
 * Smoke checks for temporal / freshness extraction.
 */
import { buildTemporalCut } from "../src/lib/temporal.js";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const briefed = new Date("2026-09-21T15:00:00Z");

{
  const t = buildTemporalCut({
    text: "据新华社北京2026年9月18日电，会议要求有关部门于2026年底前出台配套办法。",
    briefedAt: briefed,
  });
  assert(t.source_as_of === "2026-09-18", `expected 2026-09-18 got ${t.source_as_of}`);
  assert(t.source_as_of_precision === "day", "precision day");
  assert(t.freshness.band === "fresh", `band fresh got ${t.freshness.band}`);
  assert(t.forward_deadlines_en.length === 0, "deadlines passed separately");
}

{
  const t = buildTemporalCut({
    text: "据新华社北京电，近日召开的中央经济工作会议强调高质量发展。",
    briefedAt: briefed,
  });
  assert(t.source_as_of_precision === "relative", "relative cue");
  assert(t.freshness.band === "weak", "relative cue → weak (distinct from no date at all)");
  assert(t.source_as_of_evidence === "近日", "evidence 近日");
}

{
  const t = buildTemporalCut({
    text: "各地各部门要提高政治站位，坚持高质量发展。",
    briefedAt: briefed,
  });
  assert(t.freshness.band === "unknown", "no date → unknown");
  assert(!t.source_as_of, "no as_of");
}

{
  const t = buildTemporalCut({
    text: "有关部门表示将继续推进相关工作。",
    briefedAt: briefed,
    sourcePublishedAt: "2026-06-01",
  });
  assert(t.source_as_of === "2026-06-01", "provided date");
  assert(t.source_as_of_method === "provided", "method provided");
  assert(t.freshness.band === "aging" || t.freshness.band === "stale", `aging/stale got ${t.freshness.band}`);
}

console.log("✅ test:temporal OK");
