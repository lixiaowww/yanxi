/**
 * Adoption gate: only keep briefs that contain hard verifiable detail
 * (numbers / timelines / named instruments / funding). Direction-only prose is rejected.
 */

import type { SubstanceCut, SubstanceKind, SubstanceNugget } from "./substance.js";

/** Core hard detail: numbers / timelines / named instruments / funding. */
export const HARD_SUBSTANCE_KINDS: SubstanceKind[] = [
  "numeric_target",
  "timeline",
  "named_instrument",
  "resource_or_funding",
];

/** Supporting concrete cues (need pairing). */
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
};

export function evaluateAdoption(substance: SubstanceCut): AdoptionDecision {
  const nuggets = substance.nuggets || [];
  const core = nuggets.filter((n) => HARD_SUBSTANCE_KINDS.includes(n.kind));
  const bodies = nuggets.filter((n) => n.kind === SUPPORT_BODY);
  const sectors = nuggets.filter((n) => n.kind === SUPPORT_SECTOR);
  const paired = bodies.length > 0 && sectors.length > 0;

  const hard = paired ? [...core, ...bodies.slice(0, 2), ...sectors.slice(0, 2)] : core;

  if (hard.length > 0) {
    return {
      framing: "civilian-detail-adoption",
      adopted: true,
      label_zh: "Adopted (verifiable detail/data)",
      reason_zh:
        paired && !core.length
          ? `Found responsible body + named sector/product (${hard.length} cue(s)).`
          : `Found ${hard.length} hard cue(s) (numbers / deadlines / instruments / funding).`,
      hard_nuggets: hard.slice(0, 10),
      rejected_as: null,
      tag: "hypothesis",
    };
  }
  return {
    framing: "civilian-detail-adoption",
    adopted: false,
    label_zh: "Not adopted (no detail/data)",
    reason_zh:
      "Direction/formula language only — missing verifiable numbers, deadlines, named notices/measures, funding lines, or a responsible-body + named-sector pair. No substantive brief generated.",
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
