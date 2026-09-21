/**
 * Curated source-tier priors (hypothesis).
 *
 * The tier order (A > B > C > U > D) and the per-tier confidence cap are **stated editorial
 * priors**: one analyst's ranking of how citable a kind of public source is. They were
 * hand-set, never fitted to labelled data and never validated against a held-out set.
 * `weight_0_to_1` exists only so confidence blending has something to order on — it is an
 * internal ordering number, not a measured reliability, and must not be shown to a reader.
 * Show the tier letter, the cap, and `prior_basis_en` instead. See `docs/RELIABILITY.md`.
 */

import type { SourceClass } from "./source-class.js";

export type TierMaxConfidence = "low" | "medium" | "high";

export const SOURCE_TIER_PRIOR_NOTE =
  "Tier order and the confidence cap are stated editorial priors — hand-set, not fitted to labelled data.";

export const SOURCE_TIER_IDS = ["A", "B", "C", "D", "U"] as const;
export type SourceTierId = (typeof SOURCE_TIER_IDS)[number];

export type SourceTier = {
  framing: "civilian-curated-source-tier";
  tier: SourceTierId;
  /** How the prior was set — never a fitted or measured value. */
  prior_kind: "stated-editorial-prior";
  /**
   * Internal ordering number for confidence blending only. Hand-set; no calibration.
   * Never render this to a human — present the tier letter plus `prior_basis_en`.
   */
  weight_0_to_1: number;
  /** One English clause stating why this tier sits where it does. Shown instead of the weight. */
  prior_basis_en: string;
  label_zh: string;
  label_en: string;
  max_confidence: TierMaxConfidence;
  source_class: SourceClass;
  rationale_zh: string;
  /** Optional cues that nudged tier (e.g. think-tank lexicon). */
  evidence: string[];
  tag: "hypothesis";
};

/** Catalog for docs / portfolio — curated priors only. */
export const SOURCE_TIER_CATALOG: Omit<
  SourceTier,
  "source_class" | "evidence" | "rationale_zh"
>[] = [
  {
    framing: "civilian-curated-source-tier",
    tier: "A",
    prior_kind: "stated-editorial-prior",
    weight_0_to_1: 1.0,
    prior_basis_en:
      "Ranked first by editorial judgement: a named instrument is the most citable public record.",
    label_zh: "A · named policy instrument",
    label_en: "A · named policy instrument",
    max_confidence: "high",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "B",
    prior_kind: "stated-editorial-prior",
    weight_0_to_1: 0.75,
    prior_basis_en:
      "Ranked second: an official wire or ministry statement is attributable but is not the instrument itself.",
    label_zh: "B · official wire / ministry statement",
    label_en: "B · official wire / ministry statement",
    max_confidence: "high",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "C",
    prior_kind: "stated-editorial-prior",
    weight_0_to_1: 0.45,
    prior_basis_en:
      "Ranked mid: commentary interprets a decision rather than recording it — detail still to verify.",
    label_zh: "C · press commentary / public think-tank note",
    label_en: "C · press commentary / public think-tank note",
    max_confidence: "medium",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "D",
    prior_kind: "stated-editorial-prior",
    weight_0_to_1: 0.1,
    prior_basis_en:
      "Ranked last: social retelling cannot on its own corroborate an official claim.",
    label_zh: "D · social commentary (paste-only)",
    label_en: "D · social commentary (paste-only)",
    max_confidence: "low",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "U",
    prior_kind: "stated-editorial-prior",
    weight_0_to_1: 0.35,
    prior_basis_en:
      "Ranked low-mid: unattributed public text — readable, but not enough on its own to reach high.",
    label_zh: "U · unknown public text",
    label_en: "U · unknown public text",
    max_confidence: "medium",
    tag: "hypothesis",
  },
];

const THINK_TANK_RX =
  /发展研究中心|国务院发展研究中心|中国社科院|社会科学院|商务部研究院|国际贸易经济合作研究院|智库|研究中心发布/;

/**
 * Map source_class (+ light text cues) → curated tier prior.
 */
export function resolveSourceTier(
  sourceClass: SourceClass,
  sourceText = "",
  sourceLabels: string[] = []
): SourceTier {
  const hay = `${sourceText}\n${sourceLabels.join(" ")}`;
  const evidence: string[] = [];

  if (sourceClass === "social_commentary") {
    return pack("D", sourceClass, evidence, "Social-commentary tier; must not alone corroborate official claims.");
  }
  if (sourceClass === "policy_instrument") {
    return pack("A", sourceClass, evidence, "Named notice/measure/implementing-instrument tier.");
  }
  if (sourceClass === "official_or_wire") {
    return pack("B", sourceClass, evidence, "Official / wire / ministry public-statement tier.");
  }
  if (sourceClass === "press_commentary") {
    return pack("C", sourceClass, evidence, "Press-commentary tier; interpretation first — detail still to verify.");
  }

  // unknown_public: optional demote/promote by lexicon
  if (THINK_TANK_RX.test(hay)) {
    const m = hay.match(THINK_TANK_RX);
    evidence.push(`think_tank_cue:${(m?.[0] || "").slice(0, 24)}`);
    return pack(
      "C",
      sourceClass,
      evidence,
      "Unclassified text matched public think-tank lexicon → tier C (hypothesis)."
    );
  }

  return pack("U", sourceClass, evidence, "Unclassified public text; mid-low prior — do not raise to high alone.");
}

function pack(
  tier: SourceTierId,
  sourceClass: SourceClass,
  evidence: string[],
  rationale_zh: string
): SourceTier {
  const row = SOURCE_TIER_CATALOG.find((c) => c.tier === tier)!;
  return {
    framing: "civilian-curated-source-tier",
    tier: row.tier,
    prior_kind: "stated-editorial-prior",
    weight_0_to_1: row.weight_0_to_1,
    prior_basis_en: row.prior_basis_en,
    label_zh: row.label_zh,
    label_en: row.label_en,
    max_confidence: row.max_confidence,
    source_class: sourceClass,
    rationale_zh,
    evidence: evidence.slice(0, 4),
    tag: "hypothesis",
  };
}

export function listSourceTierCatalog(): typeof SOURCE_TIER_CATALOG {
  return SOURCE_TIER_CATALOG;
}
