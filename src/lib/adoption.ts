/**
 * Adoption gate: only keep briefs that contain actionable verifiable detail.
 * Bare lexicon hits (管理办法 / 专项资金 / a lone date / a population figure)
 * do not admit — those stay in the gray zone for a second cut.
 */

import type { SubstanceCut, SubstanceKind, SubstanceNugget } from "./substance.js";

/** Core hard detail: numbers / timelines / named instruments / funding. */
export const HARD_SUBSTANCE_KINDS: SubstanceKind[] = [
  "numeric_target",
  "timeline",
  "named_instrument",
  "resource_or_funding",
];

const SUPPORT_BODY: SubstanceKind = "responsible_body";
const SUPPORT_SECTOR: SubstanceKind = "named_sector_or_place";

export type AdoptionDecision = {
  framing: "civilian-detail-adoption";
  adopted: boolean;
  label_zh: string;
  reason_zh: string;
  hard_nuggets: SubstanceNugget[];
  rejected_as: "direction_only" | "none" | null;
  tag: "hypothesis";
  /** Set when a human review override forced adoption despite no hard nuggets. */
  human_override?: boolean;
};

/** True when the nugget is more than a bare vocabulary token. */
export function isActionableCore(n: SubstanceNugget): boolean {
  const ev = n.evidence || "";
  const en = n.value_en || "";
  switch (n.kind) {
    case "named_instrument":
      return /印发|通知|条例|决定|公告|意见|方案|配套办法|实施细则|管理办法已|已出台/.test(ev)
        || /\b(notice|circular|regulation|ordinance|issued)\b/i.test(en);
    case "resource_or_funding":
      return /\d/.test(ev) || /RMB|billion|million|yuan|USD/i.test(en);
    case "numeric_target":
      // Policy-scale figures / rates — not demographic filler like "50万人".
      return /亿|万亿|％|%|专项|试点|配套|产能|装机|备案/.test(ev)
        || /RMB|billion|percent|pilot/i.test(en);
    case "timeline":
      // A date alone is weak; actionable when tied to an instrument/funding clause.
      return /出台|印发|实施|落地|安排|专项|试点|配套|办法|通知/.test(ev);
    default:
      return false;
  }
}

export function evaluateAdoption(substance: SubstanceCut): AdoptionDecision {
  const nuggets = substance.nuggets || [];
  const core = nuggets.filter((n) => HARD_SUBSTANCE_KINDS.includes(n.kind));
  const strong = core.filter(isActionableCore);
  const bodies = nuggets.filter((n) => n.kind === SUPPORT_BODY);
  const sectors = nuggets.filter((n) => n.kind === SUPPORT_SECTOR);
  const support = [...bodies.slice(0, 2), ...sectors.slice(0, 2)];

  // Need at least one actionable core cue, plus either a second strong cue or
  // a named body/sector companion. Body+sector alone no longer admits.
  const weight = strong.length + (support.length ? 1 : 0);
  const adopted = strong.length >= 1 && weight >= 2;

  if (adopted) {
    const hard = [...strong, ...support].slice(0, 10);
    return {
      framing: "civilian-detail-adoption",
      adopted: true,
      label_zh: "Adopted (verifiable detail/data)",
      reason_zh: `Found ${strong.length} actionable hard cue(s) with supporting context (${hard.length} cue(s) kept).`,
      hard_nuggets: hard,
      rejected_as: null,
      tag: "hypothesis",
    };
  }

  return {
    framing: "civilian-detail-adoption",
    adopted: false,
    label_zh: "Not adopted (no detail/data)",
    reason_zh:
      "Missing actionable verifiable detail — need a real notice/funding amount/policy figure tied to a body, sector, or second hard cue. Bare instrument/funding/date tokens or body+sector talk alone do not admit.",
    hard_nuggets: [],
    rejected_as: "direction_only",
    tag: "hypothesis",
  };
}

/** Keep digest rows whose quote overlaps a hard nugget evidence window. */
export function filterDigestByHardNuggets<T extends { quote?: string; point?: string }>(
  rows: T[] | undefined,
  hard: SubstanceNugget[]
): T[] {
  if (!rows?.length) return [];
  if (!hard.length) return [];
  return rows.filter((row) => {
    const q = row.quote || "";
    if (!q) return false;
    return hard.some((h) => h.evidence.includes(q) || q.includes(h.evidence.slice(0, 12)));
  });
}
