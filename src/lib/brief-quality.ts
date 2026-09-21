/**
 * Brief quality gate (DP-brief-quality F11–F12).
 * complete = adopted + ≥2 distinct sources + dated (or operator-provided date).
 * partial = adopted but missing second source and/or as-of.
 * rejected = not adopted.
 */
import type { TemporalCut } from "./temporal.js";

export type BriefQualityLevel = "complete" | "partial" | "rejected";

export type BriefQuality = {
  framing: "civilian-brief-quality";
  level: BriefQualityLevel;
  label_en: string;
  missing: string[];
  tag: "hypothesis";
};

export function evaluateBriefQuality(input: {
  adopted: boolean;
  distinctSourceCount: number;
  temporal: TemporalCut;
  /** Operator typed a publication date in the UI/API. */
  operatorDated?: boolean;
}): BriefQuality {
  if (!input.adopted) {
    return {
      framing: "civilian-brief-quality",
      level: "rejected",
      label_en: "Rejected / not a full brief",
      missing: ["actionable_hard_detail"],
      tag: "hypothesis",
    };
  }

  const missing: string[] = [];
  if (input.distinctSourceCount < 2) missing.push("second_public_source");
  const dated =
    input.operatorDated ||
    (input.temporal.source_as_of_precision !== "none" &&
      input.temporal.source_as_of_precision !== "relative" &&
      Boolean(input.temporal.source_as_of)) ||
    input.temporal.source_as_of_method === "provided";
  if (!dated) missing.push("source_as_of");

  if (missing.length) {
    return {
      framing: "civilian-brief-quality",
      level: "partial",
      label_en: "Partial brief — add a second public source and/or a dated dateline",
      missing,
      tag: "hypothesis",
    };
  }

  return {
    framing: "civilian-brief-quality",
    level: "complete",
    label_en: "Complete brief (multi-source + dated)",
    missing: [],
    tag: "hypothesis",
  };
}

/** Cap outlook likelihoods from freshness (F12). */
export function outlookLikelihoodCap(
  temporal: TemporalCut
): "low" | "medium" | "high" {
  const band = temporal.freshness.band;
  if (band === "unknown") return "low";
  if (band === "aging" || band === "stale") return "medium";
  return "high";
}

const RANK = { low: 0, medium: 1, high: 2 } as const;

export function clampLikelihood(
  likelihood: "low" | "medium" | "high",
  cap: "low" | "medium" | "high"
): "low" | "medium" | "high" {
  return RANK[likelihood] <= RANK[cap] ? likelihood : cap;
}
