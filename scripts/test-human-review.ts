/**
 * Human-in-the-loop review points (non-blocking): the three places a
 * deterministic layer had to guess — source class with no lexicon hit,
 * intake's gray zone (reject_thin first cut), and a domain profile picked
 * off a defaulted desk assignment. Each should surface as an open
 * `human_review` point with options, and resolve when the matching
 * BriefRequest override is sent on a re-run. See docs/DP-brief-quality.md
 * §4.4.
 */
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { listDomainFixtures } from "../src/lib/domains.js";
import type { HumanReviewPoint } from "../src/lib/gate.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

function findPoint(
  review: HumanReviewPoint[] | undefined,
  id: HumanReviewPoint["id"]
): HumanReviewPoint | undefined {
  return review?.find((p) => p.id === id);
}

// Adopted (2 hard nuggets: a numeric_target and a timeline), no source-class
// lexicon hit, and no desk keyword strong enough to avoid the default —
// exercises source_class + domain_profile together.
const GUESS_TEXT =
  "该市文化馆升级项目安排资金1.2亿元，计划2027年6月落地完成，惠及周边社区。";

{
  const base = await runBriefingPipeline({
    sourceText: GUESS_TEXT,
    sourceLabel: "domain-guess-fixture",
    forceOffline: true,
  });
  assert(base.briefing.adoption?.adopted, "fixture should be adopted (2 hard nuggets)");

  const sc = findPoint(base.briefing.human_review, "source_class");
  assert(sc, "source_class review point should be open when no lexicon cue matched");
  assert(sc!.status === "open", "source_class point starts open");
  assert(sc!.system_pick === "unknown_public", "source_class system_pick is unknown_public");
  assert(sc!.options.length === 5, "source_class offers all 5 classes");

  const dp = findPoint(base.briefing.human_review, "domain_profile");
  assert(dp, "domain_profile review point should be open when desk assignment defaulted");
  assert(dp!.status === "open", "domain_profile point starts open");
  assert(
    base.briefing.desk_section?.rationale?.startsWith("No strong desk cue"),
    "fixture must actually hit the desk-default path, or this test proves nothing"
  );

  const overridden = await runBriefingPipeline({
    sourceText: GUESS_TEXT,
    sourceLabel: "domain-guess-fixture",
    forceOffline: true,
    sourceClass: "official_or_wire",
    forcedDomainProfile: "social_governance",
  });
  assert(
    overridden.briefing.source_class?.class === "official_or_wire",
    "source_class override should take effect"
  );
  assert(
    overridden.briefing.content_analysis?.domain === "social_governance",
    "forcedDomainProfile should replace the auto-picked domain in content_analysis"
  );
  assert(
    overridden.briefing.policy_outlook?.scenarios?.every((s) =>
      overridden.briefing.content_analysis?.scenarios?.some((cs) => cs.label === s.label)
    ),
    "forcedDomainProfile should also replace policy_outlook scenarios, not just content_analysis"
  );
  const scResolved = findPoint(overridden.briefing.human_review, "source_class");
  assert(scResolved?.status === "resolved" && scResolved.resolved_value === "official_or_wire",
    "source_class point should resolve and echo the override");
  const dpResolved = findPoint(overridden.briefing.human_review, "domain_profile");
  assert(dpResolved?.status === "resolved" && dpResolved.resolved_value === "social_governance",
    "domain_profile point should resolve and echo the override");
  assert(dpResolved?.system_pick === "macro_finance",
    "domain_profile system_pick should still show what the rule engine would have picked on its own");

  console.log("✅ source_class + domain_profile: open → resolved via override");
}

// Intake gray zone: a known reject_thin fixture, overridden to admit.
{
  const fixtures = listDomainFixtures();
  const gray = fixtures.find((f) => f.id === "ideology-party");
  assert(gray, "missing ideology-party fixture");

  const base = await runBriefingPipeline({
    sourceText: gray!.sourceText,
    sourceLabel: gray!.sourceLabel,
    forceOffline: true,
  });
  assert(base.briefing.intake?.first_cut === "reject_thin", "fixture must land in the gray zone");
  const gate = findPoint(base.briefing.human_review, "intake_gray");
  assert(gate, "intake_gray review point should be open in the gray zone");
  assert(gate!.status === "open", "intake_gray point starts open");
  assert(gate!.options.map((o) => o.value).sort().join(",") === "admit,defer,reject_thin",
    "intake_gray offers exactly admit/defer/reject_thin");
  assert(!base.briefing.content_analysis, "un-adopted gray-zone brief has no content_analysis yet");

  const admitted = await runBriefingPipeline({
    sourceText: gray!.sourceText,
    sourceLabel: gray!.sourceLabel,
    forceOffline: true,
    forcedIntakeLabel: "admit",
  });
  assert(admitted.briefing.intake?.label === "admit", "forcedIntakeLabel should win over the local_gray heuristic");
  assert(admitted.briefing.intake?.second_cut_engine === "human_override", "second_cut_engine records the override");
  assert(admitted.briefing.adoption?.adopted, "forcing admit must also force adoption.adopted");
  assert(admitted.briefing.adoption?.human_override, "adoption.human_override marks the provenance");
  assert(admitted.briefing.content_analysis, "forced-admit brief should get a real content_analysis");
  const gateResolved = findPoint(admitted.briefing.human_review, "intake_gray");
  assert(gateResolved?.status === "resolved" && gateResolved.resolved_value === "admit",
    "intake_gray point should resolve and echo the override");

  // Never overrides admit/social_downweight — only the actual gray zone.
  const clear = fixtures.find((f) => f.id === "macro-instrument");
  assert(clear, "missing macro-instrument fixture");
  const notGray = await runBriefingPipeline({
    sourceText: clear!.sourceText,
    sourceLabel: clear!.sourceLabel,
    forceOffline: true,
    forcedIntakeLabel: "defer",
  });
  assert(notGray.briefing.intake?.label === "admit",
    "forcedIntakeLabel must be ignored outside the gray zone (first_cut !== reject_thin)");
  assert(!findPoint(notGray.briefing.human_review, "intake_gray"),
    "intake_gray point must not appear for a clear-zone admit");

  console.log("✅ intake_gray: open → resolved via override; ignored outside the gray zone");
}

console.log("✅ test:human-review OK");
