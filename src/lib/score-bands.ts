/**
 * Presentation helpers for the rule-based heuristics (substance, corroboration, source tier,
 * signaling). They turn the internal ordering numbers into an ordinal band plus a short
 * English basis clause, so a reader judges the cues instead of trusting a figure.
 *
 * None of the underlying numbers are calibrated: there is no labelled corpus and no held-out
 * evaluation anywhere in this repo. They order and flag; they do not measure.
 * See `docs/RELIABILITY.md` and `docs/SUBSTANCE.md`. Never render a raw score to a human.
 */

export type CorroborationBand = "minimal" | "weak" | "moderate" | "strong";

export const HEURISTIC_BASIS_NOTE =
  "Bands come from hand-set rule cues, not a calibrated model — they order and flag, they do not measure.";

/**
 * Words of Estimative Probability — ICD 203 (Analytic Standards), rule
 * e(2)(a): "an analytic product must use one of the following sets of
 * terms" (two rows given; do not mix rows in one product). This project's
 * likelihood field only has three bands (high/medium/low), so each maps to
 * one term from ICD 203's "probable" row rather than an invented word.
 * ICD 203 rule e(2)(b) also requires never combining a likelihood word and
 * a confidence-level word in the same sentence — callers must keep this
 * word and any confidence badge visually/grammatically separate.
 */
export function likelihoodWord(l?: string): string {
  return l === "high" ? "likely" : l === "medium" ? "roughly even odds" : "unlikely";
}

const CORROBORATION_DRIVER_EN: Record<string, string> = {
  multi_source_merge: "two or more public sources",
  cross_source_subject_match: "two sources naming the same subject",
  cross_source_detail_match: "the same numbers or dates in more than one source",
  independent_issuer_agreement: "agreement between independent issuers",
  three_plus_sources_same_subject: "three or more sources on one subject",
  cross_source_topic_overlap_only: "general topic overlap only",
  single_source_names_traceable_record: "one source naming a public record a reviewer can pull",
  named_or_cue_instrument: "a named notice or measure in the text",
  meeting_plus_instrument_sequence: "meeting language paired with an instrument",
  numeric_or_dense_substance: "numbers or deadlines",
};

const SUBSTANCE_KIND_EN: Record<string, string> = {
  numeric_target: "numbers",
  timeline: "deadlines",
  named_instrument: "named instruments",
  responsible_body: "responsible bodies",
  pilot_or_scope: "pilot scope",
  constraint_or_ban: "bans or red lines",
  resource_or_funding: "funding lines",
  named_sector_or_place: "named sectors",
  delta_or_priority_shift: "priority shifts",
};

const SIGNALING_CATEGORY_EN: Record<string, string> = {
  sequence: "party/state sequence",
  implementing_detail: "implementing detail",
  press_placement: "press placement",
  speech_verbs: "speech verbs",
  attribution: "attribution",
  concreteness: "concreteness",
  rollout_scope: "rollout scope",
  tone_framing: "tone framing",
};

const TIER_PRIOR_EN: Record<string, string> = {
  A: "named policy instrument",
  B: "official wire or ministry statement",
  C: "press commentary or public think-tank note",
  D: "social commentary (paste-only)",
  U: "unknown public text",
};

function humanize(key: string): string {
  return key.replace(/_/g, " ");
}

function joinClauses(items: string[], max = 3): string {
  const rows = [...new Set(items)].slice(0, max);
  if (rows.length <= 1) return rows[0] || "";
  return `${rows.slice(0, -1).join(", ")} and ${rows[rows.length - 1]}`;
}

/** Ordinal band for the internal 0–3 corroboration counter. Ordering only. */
export function corroborationBand(score?: number | null): CorroborationBand {
  const s = typeof score === "number" && Number.isFinite(score) ? score : 0;
  if (s >= 3) return "strong";
  if (s >= 2) return "moderate";
  if (s >= 1) return "weak";
  return "minimal";
}

export function corroborationBandLabel(band: CorroborationBand): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

/** One clause naming the cues that produced the corroboration band. */
export function corroborationBasisEn(opts: {
  drivers?: string[];
  sourceCount?: number;
  missing?: string[];
}): string {
  const phrases = (opts.drivers || []).map((d) => CORROBORATION_DRIVER_EN[d] || humanize(d));
  const sourceNote =
    typeof opts.sourceCount === "number" && opts.sourceCount > 0
      ? opts.sourceCount === 1
        ? "single public source"
        : `${opts.sourceCount} public sources`
      : "";

  if (!phrases.length) {
    const gap = (opts.missing || [])[0];
    const base = "no instrument, numeric or second-source cues detected";
    return gap ? `${base}; still needed: ${gap}` : base;
  }
  const from = `from ${joinClauses(phrases)}`;
  return sourceNote ? `${from} (${sourceNote})` : from;
}

/**
 * Full human-facing corroboration line: band + what produced it, never the score.
 * `labelEn` (from `corroboration.label_en`) already states the cross-check status,
 * so it is preferred over the raw driver list when available.
 */
export function corroborationLineEn(opts: {
  score?: number | null;
  labelEn?: string;
  drivers?: string[];
  sourceCount?: number;
  missing?: string[];
}): string {
  const band = corroborationBand(opts.score);
  const status = (opts.labelEn || "").trim();
  const basis = corroborationBasisEn(opts);
  const tail = status ? (opts.drivers?.length ? `${status}; ${basis}` : status) : basis;
  return `Corroboration ${band} — ${tail}`;
}

/** Within-passage cue clause. Reading signal only — not independent verification. */
export function singleSourceCueBasisEn(cues?: { drivers?: string[] }): string {
  const phrases = (cues?.drivers || []).map((d) => CORROBORATION_DRIVER_EN[d] || humanize(d));
  if (!phrases.length) return "no within-passage detail cues";
  return `within-passage cues: ${joinClauses(phrases, 3)}`;
}

/**
 * One clause naming the verifiable cue types detected in the paste.
 *
 * Pass `band` too: a rejected brief keeps the band it scored but has its nuggets stripped by the
 * adoption gate, and claiming "nothing detected" there would be wrong.
 */
export function substanceBasisEn(nuggets?: { kind?: string }[], band?: string): string {
  const kinds = [...new Set((nuggets || []).map((n) => n.kind).filter(Boolean) as string[])];
  if (kinds.length) {
    const named = kinds.map((k) => SUBSTANCE_KIND_EN[k] || humanize(k));
    return `${joinClauses(named, 4)} detected`;
  }
  if (band && band !== "thin") {
    return "cue words matched, but no hard detail survived the adoption filter";
  }
  return "no numbers, deadlines, named notices or responsible bodies detected";
}

/** One clause naming which heuristic categories fired in the signaling scorecard. */
export function signalingBasisEn(rules?: { category?: string; status?: string }[]): string {
  const observed = [...new Set(
    (rules || []).filter((r) => r.status === "hit").map((r) => r.category || "")
  )].filter(Boolean);
  if (!observed.length) return "no signaling cue category clearly observed";
  return `cues observed in ${joinClauses(observed.map((c) => SIGNALING_CATEGORY_EN[c] || humanize(c)), 3)}`;
}

const CAP_EN: Record<string, string> = {
  substance_thin_cap_medium: "thin verifiable detail holds it at medium",
  single_source_not_cross_checked_cap_low: "a single un-cross-checked source holds it at low",
  corroboration_lt2_cap_medium: "no subject cross-check holds it at medium",
  corroboration_no_shared_subject_cap_low: "no shared subject holds it at low",
  corroboration_0_cap_low: "no corroboration cue holds it at low",
  social_commentary_hard_cap_low: "social commentary is hard-capped at low",
  weak_provenance_cap_medium: "weak provenance holds it at medium",
};

function capBasisEn(caps?: string[]): string {
  const phrases = (caps || []).map((c) => {
    if (CAP_EN[c]) return CAP_EN[c];
    const tierCap = c.match(/^source_tier_([A-U])_max_(low|medium|high)$/);
    if (tierCap) return `source tier ${tierCap[1]} caps it at ${tierCap[2]}`;
    return humanize(c);
  });
  return joinClauses(phrases, 2);
}

/**
 * Human-facing confidence lines — split per docs/DP-V3.md §5: how well the
 * excerpt supports its own conclusions vs. how credible the source/outlet
 * is are different questions, so they get separate lines. Deliberately
 * carry no score — `score_0_to_1` is an internal blend only.
 */
export function analysisConfidenceLineEn(cf?: {
  level?: string;
  caps_applied?: string[];
  factors?: {
    signaling_band?: string;
    substance_band?: string;
    corroboration_0_to_3?: number;
  };
}): string {
  if (!cf?.level) return "";
  const f = cf.factors || {};
  const parts = [
    f.substance_band ? `verifiable detail ${f.substance_band}` : "",
    `corroboration ${corroborationBand(f.corroboration_0_to_3)}`,
    f.signaling_band ? `signaling cues ${f.signaling_band}` : "",
  ].filter(Boolean);
  const caps = capBasisEn(cf.caps_applied);
  const head = `Analysis confidence ${cf.level} — from ${parts.join(", ")}`;
  return caps ? `${head}; ${caps}.` : `${head}.`;
}

export function sourceCredibilityLineEn(cf?: {
  level?: string;
  caps_applied?: string[];
  factors?: {
    provenance?: string;
    source_tier?: string;
    channel_tier?: string;
  };
}): string {
  if (!cf?.level) return "";
  const f = cf.factors || {};
  const parts = [
    f.source_tier ? `source tier ${f.source_tier} (stated editorial prior)` : "",
    f.channel_tier ? `channel tier ${f.channel_tier}` : "",
    f.provenance ? `provenance ${f.provenance}` : "",
  ].filter(Boolean);
  const caps = capBasisEn(cf.caps_applied);
  const head = `Source credibility ${cf.level} — from ${parts.join(", ")}`;
  return caps ? `${head}; ${caps}.` : `${head}.`;
}

/**
 * Source tier line. The tier letter and the confidence cap are stated editorial priors;
 * the internal ordering weight is deliberately not shown.
 */
export function sourceTierLineEn(tier?: {
  tier?: string;
  max_confidence?: string;
  source_class?: string;
}): string {
  const id = tier?.tier || "U";
  const what = TIER_PRIOR_EN[id] || "public text";
  const cap = tier?.max_confidence ? `, caps confidence at ${tier.max_confidence}` : "";
  return `Source tier ${id} · ${what} — stated editorial prior${cap}`;
}

/**
 * The one line a reader actually needs first — verdict, brief quality,
 * freshness, both confidence scores, in one sentence. Single source of
 * truth for the UI's BLUF line (BriefingNote.tsx) AND the markdown export
 * (brief-markdown.ts): they drifted once already (the markdown header grew
 * into a 12-line metadata dump while the UI got a proper reader/audit
 * split) because the same text lived in two places. Fix that class of bug
 * by construction, not just this once.
 */
export function buildVerdictLine(b?: {
  adoption?: { adopted?: boolean };
  intake?: { label?: string };
  brief_quality?: { label_en?: string };
  temporal?: { freshness?: { label_en?: string } };
  analysis_confidence?: { level?: string };
  source_credibility?: { level?: string };
}): { tone: "ok" | "warn"; text: string } {
  const deferred = b?.intake?.label === "defer";
  const adopted = b?.adoption?.adopted !== false;
  if (deferred) {
    return { tone: "warn", text: "Deferred — watch queue (no actionable hard detail yet)." };
  }
  if (!adopted) {
    return { tone: "warn", text: "Not adopted — no verifiable detail in this excerpt." };
  }
  const parts = [
    "Adopted",
    b?.brief_quality?.label_en,
    b?.temporal?.freshness?.label_en,
    b?.analysis_confidence?.level ? `analysis confidence ${b.analysis_confidence.level}` : undefined,
    b?.source_credibility?.level ? `source credibility ${b.source_credibility.level}` : undefined,
  ].filter(Boolean);
  return { tone: "ok", text: `${parts.join(" · ")}.` };
}
