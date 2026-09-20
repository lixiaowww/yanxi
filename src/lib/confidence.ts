/**
 * Factorized research confidence + corroboration strength.
 * Confidence = "how well evidenced is this draft?", NOT "will event X happen?".
 */

import type { SignalingScorecard } from "./media-heuristics.js";
import type { SubstanceCut } from "./substance.js";
import type { SourceClass } from "./source-class.js";
import { resolveSourceTier, type SourceTier } from "./source-tier.js";

export type ConfidenceLevel = "low" | "medium" | "high";

export type Corroboration = {
  framing: "civilian-multi-source-corroboration";
  score_0_to_3: 0 | 1 | 2 | 3;
  label_zh: string;
  label_en: string;
  drivers: string[];
  missing: string[];
  tag: "hypothesis";
};

export type ConfidenceFactors = {
  framing: "civilian-factorized-confidence";
  level: ConfidenceLevel;
  /** 0–1 internal blend for debugging; UI uses level. */
  score_0_to_1: number;
  factors: {
    signaling_band: ConfidenceLevel;
    substance_band: string;
    corroboration_0_to_3: number;
    provenance: "weak" | "adequate";
    source_class: SourceClass;
    source_tier: SourceTier["tier"];
    source_tier_weight_0_to_1: number;
  };
  source_tier: SourceTier;
  caps_applied: string[];
  rationale: string;
  tag: "hypothesis";
};

function hasMeeting(text: string): boolean {
  return /中央经济工作会议|中央政治局|中央全会|两会|会议强调|会议指出/.test(text);
}

function hasInstrument(text: string): boolean {
  return /实施细则|实施方案|管理办法|配套办法|通知|意见|条例|印发/.test(text);
}

function hasNumericOrTimeline(text: string): boolean {
  return /\d+(\.\d+)?\s*(%|％|亿|万|亿元)|20\d{2}\s*年|年内|年底前/.test(text);
}

export function buildCorroboration(opts: {
  sourceText: string;
  sourceCount: number;
  substance: SubstanceCut;
}): Corroboration {
  const { sourceText, sourceCount, substance } = opts;
  const drivers: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (sourceCount >= 2) {
    score += 1;
    drivers.push("multi_source_merge");
  } else {
    missing.push("第二公开源（会议/通稿之外的细则或地方复述）");
  }

  if (hasInstrument(sourceText)) {
    score += 1;
    drivers.push("named_or_cue_instrument");
  } else {
    missing.push("具名通知/办法/细则");
  }

  if (hasMeeting(sourceText) && hasInstrument(sourceText)) {
    score += 1;
    drivers.push("meeting_plus_instrument_sequence");
  } else if (hasMeeting(sourceText) && !hasInstrument(sourceText)) {
    missing.push("与会议语对应的落实文件");
  }

  if (hasNumericOrTimeline(sourceText) || substance.band === "dense") {
    if (score < 3) {
      score += 1;
      drivers.push("numeric_or_dense_substance");
    }
  } else if (substance.band === "thin") {
    missing.push("可核验数字/时限/责任主体");
  }

  const score_0_to_3 = Math.min(3, score) as 0 | 1 | 2 | 3;

  const label_zh =
    score_0_to_3 >= 3
      ? "印证强（多线索可交叉）"
      : score_0_to_3 === 2
        ? "印证中等（方向+工具或双源）"
        : score_0_to_3 === 1
          ? "印证弱（单源或单一线索）"
          : "几乎无印证（单源且无线索）";

  const label_en =
    score_0_to_3 >= 3
      ? "Strong corroboration"
      : score_0_to_3 === 2
        ? "Moderate corroboration"
        : score_0_to_3 === 1
          ? "Weak corroboration"
          : "Minimal corroboration";

  return {
    framing: "civilian-multi-source-corroboration",
    score_0_to_3,
    label_zh,
    label_en,
    drivers,
    missing: missing.slice(0, 5),
    tag: "hypothesis",
  };
}

function rank(level: ConfidenceLevel): number {
  return level === "high" ? 2 : level === "medium" ? 1 : 0;
}

function fromRank(n: number): ConfidenceLevel {
  if (n >= 2) return "high";
  if (n >= 1) return "medium";
  return "low";
}

function minLevel(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
  return fromRank(Math.min(rank(a), rank(b)));
}

export function buildConfidenceFactors(opts: {
  scorecard: SignalingScorecard;
  substance: SubstanceCut;
  corroboration: Corroboration;
  sourceClass: SourceClass;
  sourceLabels: string[];
  sourceText?: string;
}): ConfidenceFactors {
  const caps: string[] = [];
  let level: ConfidenceLevel = opts.scorecard.band;
  const provenance: "weak" | "adequate" = opts.sourceLabels.some(
    (l) => /^https?:\/\//i.test(l) || /新华社|人民日报|gov\.cn|部|国务院/.test(l)
  )
    ? "adequate"
    : "weak";

  const source_tier = resolveSourceTier(
    opts.sourceClass,
    opts.sourceText || "",
    opts.sourceLabels
  );

  if (opts.substance.band === "thin") {
    level = minLevel(level, "medium");
    caps.push("substance_thin_cap_medium");
  }
  if (opts.corroboration.score_0_to_3 < 2) {
    level = minLevel(level, "medium");
    caps.push("corroboration_lt2_cap_medium");
  }
  if (opts.corroboration.score_0_to_3 === 0) {
    level = minLevel(level, "low");
    caps.push("corroboration_0_cap_low");
  }
  if (opts.sourceClass === "social_commentary") {
    level = "low";
    caps.push("social_commentary_hard_cap_low");
  }
  if (provenance === "weak" && level === "high") {
    level = "medium";
    caps.push("weak_provenance_cap_medium");
  }

  // Curated tier max (A/B may reach high; C/U ≤ medium; D ≤ low)
  if (rank(level) > rank(source_tier.max_confidence)) {
    level = source_tier.max_confidence;
    caps.push(`source_tier_${source_tier.tier}_max_${source_tier.max_confidence}`);
  }

  const score_0_to_1 = Number(
    (
      (opts.scorecard.band === "high" ? 0.7 : opts.scorecard.band === "medium" ? 0.45 : 0.2) *
        0.3 +
      (opts.substance.substance_score_0_to_1 || 0) * 0.22 +
      (opts.corroboration.score_0_to_3 / 3) * 0.28 +
      (provenance === "adequate" ? 0.08 : 0.02) +
      source_tier.weight_0_to_1 * 0.12
    ).toFixed(3)
  );

  return {
    framing: "civilian-factorized-confidence",
    level,
    score_0_to_1: Math.min(1, score_0_to_1),
    factors: {
      signaling_band: opts.scorecard.band,
      substance_band: opts.substance.band,
      corroboration_0_to_3: opts.corroboration.score_0_to_3,
      provenance,
      source_class: opts.sourceClass,
      source_tier: source_tier.tier,
      source_tier_weight_0_to_1: source_tier.weight_0_to_1,
    },
    source_tier,
    caps_applied: caps,
    rationale: `Research confidence=${level} from signaling=${opts.scorecard.band}, substance=${opts.substance.band}, corroboration=${opts.corroboration.score_0_to_3}/3, provenance=${provenance}, source_class=${opts.sourceClass}, source_tier=${source_tier.tier}(w=${source_tier.weight_0_to_1}). Caps: ${caps.join(", ") || "none"}. Tier priors are curated hypothesis — not ML-fitted. Not an event-probability forecast.`,
    tag: "hypothesis",
  };
}
