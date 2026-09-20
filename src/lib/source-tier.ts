/**
 * Curated source-tier priors (hypothesis) — NOT ML-fitted from scrape/engagement history.
 * Ordinal research weights for confidence blending + caps.
 */

import type { SourceClass } from "./source-class.js";

export type TierMaxConfidence = "low" | "medium" | "high";

export const SOURCE_TIER_IDS = ["A", "B", "C", "D", "U"] as const;
export type SourceTierId = (typeof SOURCE_TIER_IDS)[number];

export type SourceTier = {
  framing: "civilian-curated-source-tier";
  tier: SourceTierId;
  weight_0_to_1: number;
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
    weight_0_to_1: 1.0,
    label_zh: "A·政策工具文件",
    label_en: "A · named policy instrument",
    max_confidence: "high",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "B",
    weight_0_to_1: 0.75,
    label_zh: "B·官方/通稿",
    label_en: "B · official wire / ministry statement",
    max_confidence: "high",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "C",
    weight_0_to_1: 0.45,
    label_zh: "C·评论/智库公开稿",
    label_en: "C · press commentary / public think-tank note",
    max_confidence: "medium",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "D",
    weight_0_to_1: 0.1,
    label_zh: "D·社交转述",
    label_en: "D · social commentary (paste-only)",
    max_confidence: "low",
    tag: "hypothesis",
  },
  {
    framing: "civilian-curated-source-tier",
    tier: "U",
    weight_0_to_1: 0.35,
    label_zh: "U·未分类公开文本",
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
    return pack("D", sourceClass, evidence, "社交转述档；不得单独印证官方主张。");
  }
  if (sourceClass === "policy_instrument") {
    return pack("A", sourceClass, evidence, "具名通知/办法/细则等工具文件档。");
  }
  if (sourceClass === "official_or_wire") {
    return pack("B", sourceClass, evidence, "官方/通稿/部委公开表述档。");
  }
  if (sourceClass === "press_commentary") {
    return pack("C", sourceClass, evidence, "报刊评论档；解读优先，细则仍待核。");
  }

  // unknown_public: optional demote/promote by lexicon
  if (THINK_TANK_RX.test(hay)) {
    const m = hay.match(THINK_TANK_RX);
    evidence.push(`think_tank_cue:${(m?.[0] || "").slice(0, 24)}`);
    return pack(
      "C",
      sourceClass,
      evidence,
      "未分类文本但命中公开智库/研究院表述 → 按 C 档（hypothesis）。"
    );
  }

  return pack("U", sourceClass, evidence, "未分类公开文本；默认中低先验，勿抬至 high。");
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
    weight_0_to_1: row.weight_0_to_1,
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
