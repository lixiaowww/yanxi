// Deterministic claim gate — Veragent/GrantWright-inspired L1 checks.
export type GateFinding = {
  id: string;
  severity: "hard" | "soft";
  message: string;
  evidence: string;
};

export type PolicyScenario = {
  label?: string;
  likelihood?: string;
  basis?: string;
  /** Time horizon where inferable from the paste. */
  horizon?: string;
  /** Observable condition that would confirm this path. */
  trigger?: string;
  tag?: string;
};

export type ValveReading = {
  status?: string;
  observation?: string;
  reading?: string;
  tag?: string;
};

export type ScorecardRule = {
  id?: string;
  category?: string;
  label_zh?: string;
  label_en?: string;
  weight?: number;
  status?: string;
  raw_score?: number;
  weighted_score?: number;
  tag?: string;
};

export type InfoTriageJson = {
  framing?: string;
  kinds?: { kind?: string; label_zh?: string; score?: number; evidence?: string }[];
  primary_kind?: string;
  importance?: {
    grade?: string;
    label_zh?: string;
    score_0_to_1?: number;
    rationale?: string;
    drivers?: string[];
    tag?: string;
  };
  tag?: string;
};

export type BriefingJson = {
  source_digest_zh?: { point?: string; quote?: string; source_label?: string }[];
  context_notes?: { card?: string; note?: string; tag?: string }[];
  /**
   * 信息种类 + 重要性分级（民用公开源分诊）。
   * NOT security classification (SECRET/TS/…).
   */
  info_triage?: InfoTriageJson;
  /**
   * Civilian reader-interest flag for Canada-relevant public text.
   * NOT personal targeting of Canadians.
   */
  canada_nexus?: {
    framing?: string;
    level?: string;
    label_zh?: string;
    label_en?: string;
    hits?: { level?: string; evidence?: string; cue?: string }[];
    rationale?: string;
    tag?: string;
  };
  /**
   * Boilerplate vs verifiable substance cut (党八股剥离).
   * Civilian reading aid — not a claim about intent or "brainwashing".
   */
  substance_cut?: {
    framing?: string;
    method?: string;
    boilerplate_ratio_0_to_1?: number;
    substance_score_0_to_1?: number;
    band?: string;
    label_zh?: string;
    nuggets?: {
      kind?: string;
      label_zh?: string;
      value_zh?: string;
      value_en?: string;
      evidence?: string;
      tag?: string;
    }[];
    boilerplate_hits?: { cue?: string; evidence?: string }[];
    empty_calories?: string[];
    analyst_prompt_zh?: string;
    calibration?: string;
    tag?: string;
  };
  /**
   * Portfolio desk section (经济投资/外交/国防公开表述/社会治理).
   * 「总体目标」已移除。Civilian topic bucket — not an ops-floor imitation.
   */
  desk_section?: {
    framing?: string;
    primary?: string;
    label_zh?: string;
    label_en?: string;
    secondary?: string[];
    evidence?: string[];
    hot_themes?: { id?: string; label_en?: string; evidence?: string }[];
    rationale?: string;
    tag?: string;
  };
  /**
   * Reader-facing domain content analysis: impact, trade-offs, forecasts.
   * Background/hypothesis layer — not a proven claim about intent.
   */
  content_analysis?: {
    framing?: string;
    domain?: string;
    domain_label_en?: string;
    background?: string;
    so_what?: string;
    scenarios?: PolicyScenario[];
    watchpoints?: string[];
    open_questions?: string[];
    tag?: string;
  };
  /** Reject direction-only pastes lacking hard data/instruments. */
  adoption?: {
    framing?: string;
    adopted?: boolean;
    label_zh?: string;
    reason_zh?: string;
    hard_nuggets?: { kind?: string; label_zh?: string; evidence?: string }[];
    rejected_as?: string | null;
    tag?: string;
  };
  /** Two-cut intake: first=hard nuggets; second=gray defer (local or Jev). */
  intake?: {
    framing?: string;
    label?: string;
    first_cut?: string;
    second_cut?: string | null;
    second_cut_engine?: string;
    reason_en?: string;
    jev?: {
      model?: string;
      choice?: string;
      confidence?: number;
      probabilities?: Record<string, number>;
    };
    tag?: string;
  };
  source_class?: {
    framing?: string;
    class?: string;
    label_zh?: string;
    evidence?: string[];
    rules?: string[];
    tag?: string;
  };
  corroboration?: {
    framing?: string;
    method?: string;
    score_0_to_3?: number;
    source_count?: number;
    distinct_source_count?: number;
    cross_checked?: boolean;
    shared_subjects?: string[];
    independent_issuers?: string[];
    label_zh?: string;
    label_en?: string;
    drivers?: string[];
    single_source_cues?: {
      framing?: string;
      count_0_to_3?: number;
      drivers?: string[];
      label_en?: string;
      note?: string;
      tag?: string;
    };
    missing?: string[];
    tag?: string;
  };
  confidence_factors?: {
    framing?: string;
    level?: string;
    score_0_to_1?: number;
    factors?: Record<string, unknown>;
    source_tier?: {
      framing?: string;
      tier?: string;
      weight_0_to_1?: number;
      label_zh?: string;
      max_confidence?: string;
      tag?: string;
    };
    caps_applied?: string[];
    rationale?: string;
    tag?: string;
  };
  canada_policy_link?: {
    framing?: string;
    level?: string;
    label_zh?: string;
    hits?: {
      theme_id?: string;
      theme_zh?: string;
      theme_en?: string;
      public_refs?: { title?: string; url?: string; publisher?: string }[];
      evidence?: string;
      level?: string;
    }[];
    disclaimer_zh?: string;
    rationale?: string;
    tag?: string;
  };
  /**
   * Civic Ontology Lite — curated background/hypothesis cards (not OWL/KG).
   */
  ontology_lite?: {
    framing?: string;
    desk_primary?: string;
    hits?: {
      id?: string;
      type?: string;
      desk?: string[];
      tag?: string;
      score?: number;
      matched_keywords?: string[];
      updated?: string;
      sources?: string;
    }[];
    calibration?: string;
    tag?: string;
  };
  /** Full enumerate-then-weight public media heuristics. */
  signaling_scorecard?: {
    method?: string;
    framing?: string;
    rules?: ScorecardRule[];
    weighted_total?: number;
    weight_sum?: number;
    band?: string;
    calibration?: string;
    tag?: string;
  };
  /** Category roll-up of the three primary valves. */
  signaling_valves?: {
    sequence?: ValveReading;
    implementing_detail?: ValveReading;
    press_placement?: ValveReading;
    calibration?: string;
  };
  briefing_en?: {
    what?: string;
    context?: string;
    so_what?: string;
    confidence?: string;
    sources_used?: string[];
  };
  /** Cautious open-source research scenarios — always hypothesis-tagged. */
  policy_outlook?: {
    horizon?: string;
    scenarios?: PolicyScenario[];
    watchpoints?: string[];
  };
  open_questions?: string[];
};

const FORBIDDEN = [
  /\bSIGINT\b/i,
  /\bCSE\b/,
  /\bCSIS\b/,
  /espionage/i,
  /spy\s*tool/i,
  /classified\s+access/i,
  /wiretap/i,
];

/** Secrecy markings must never appear as triage "classification". */
const FORBIDDEN_SECRECY = [
  /\bTOP\s*SECRET\b/i,
  /\bTS\/SCI\b/i,
  /\bCODAR\b/i,
  /密级\s*[:：]?\s*(绝密|机密|秘密)/,
  /\b(classification|clearance)\s*[:=]\s*(top\s*secret|secret|confidential)\b/i,
];

const OVERCLAIM = /\b(will definitely|guaranteed to|secretly plans|must happen|inevitable that)\b/i;

const ALLOWED_KINDS = new Set([
  "macro_policy",
  "implementing_instrument",
  "industrial_tech_policy",
  "foreign_affairs",
  "defense_public",
  "finance_risk",
  "rural_revitalization",
  "ideology_party",
  "dual_circulation",
  "five_year_plan",
  "social_governance",
  "economic_data",
  "press_commentary",
  "leadership_meeting",
  "local_policy",
  "other_public_text",
]);

const ALLOWED_GRADES = new Set(["P1", "P2", "P3", "P4"]);

export function runClaimGate(
  briefing: BriefingJson,
  sourceText: string,
  sources?: { label: string; text: string }[]
): GateFinding[] {
  const findings: GateFinding[] = [];
  const blob = JSON.stringify(briefing);
  const corpus =
    sources && sources.length > 0
      ? sources
      : [{ label: "paste-1", text: sourceText }];

  for (const rx of FORBIDDEN) {
    const m = blob.match(rx);
    if (m) {
      findings.push({
        id: "ethics-forbidden-framing",
        severity: "hard",
        message: "Output uses forbidden intelligence/surveillance framing.",
        evidence: m[0],
      });
    }
  }

  for (const rx of FORBIDDEN_SECRECY) {
    const m = blob.match(rx);
    if (m) {
      findings.push({
        id: "ethics-secrecy-marking",
        severity: "hard",
        message: "Output uses secrecy/classification markings — Yanxi only does civilian triage (kinds + P1–P4).",
        evidence: m[0],
      });
    }
  }

  for (const row of briefing.source_digest_zh || []) {
    const q = (row.quote || "").trim();
    if (!q) continue;
    const labeled = (row.source_label || "").trim();
    const pool = labeled
      ? corpus.filter((s) => s.label === labeled)
      : corpus;
    const hit = pool.some((s) => s.text.includes(q));
    if (!hit) {
      findings.push({
        id: "quote-not-in-source",
        severity: "hard",
        message: labeled
          ? `Chinese quote is not a substring of source_label=${labeled}.`
          : "Chinese quote is not a substring of any provided source text.",
        evidence: q.slice(0, 80),
      });
    }
  }

  // Soft: multi-source lexical overlap for shared policy terms (civilian consistency cue).
  if (corpus.length >= 2) {
    const terms = [
      "高质量发展",
      "新质生产力",
      "稳增长",
      "一带一路",
      "粮食安全",
      "金融风险",
      "双循环",
      "乡村振兴",
    ];
    const present = terms.filter((t) => corpus.filter((s) => s.text.includes(t)).length >= 2);
    if (present.length === 0) {
      const anyShared = terms.some((t) => corpus.some((s) => s.text.includes(t)));
      if (anyShared) {
        findings.push({
          id: "cross-source-limited-overlap",
          severity: "soft",
          message:
            "Multi-source pack shares little overlapping priority vocabulary — verify they belong in one briefing.",
          evidence: corpus.map((s) => s.label).join(" + "),
        });
      }
    }
  }

  for (const note of briefing.context_notes || []) {
    const tag = (note.tag || "").toLowerCase();
    if (tag && tag !== "background" && tag !== "hypothesis") {
      findings.push({
        id: "context-tag-invalid",
        severity: "soft",
        message: "Context note tag should be background or hypothesis.",
        evidence: tag,
      });
    }
  }

  const conf = (briefing.briefing_en?.confidence || "").toLowerCase();
  if (conf && !["low", "medium", "high"].includes(conf)) {
    findings.push({
      id: "confidence-invalid",
      severity: "soft",
      message: "confidence must be low|medium|high.",
      evidence: conf,
    });
  }

  const soWhat = briefing.briefing_en?.so_what || "";
  if (OVERCLAIM.test(soWhat)) {
    findings.push({
      id: "overclaim-forecast",
      severity: "soft",
      message: "so_what uses overconfident forecast language.",
      evidence: soWhat.slice(0, 120),
    });
  }

  const valves = briefing.signaling_valves;
  if (valves) {
    const parts: [string, ValveReading | undefined][] = [
      ["sequence", valves.sequence],
      ["implementing_detail", valves.implementing_detail],
      ["press_placement", valves.press_placement],
    ];
    for (const [name, v] of parts) {
      if (!v) continue;
      const tag = (v.tag || "").toLowerCase();
      if (tag && tag !== "hypothesis" && tag !== "background") {
        findings.push({
          id: "valve-tag-invalid",
          severity: "soft",
          message: `signaling_valves.${name} tag should be hypothesis or background.`,
          evidence: tag,
        });
      }
      if (OVERCLAIM.test(v.reading || "") || OVERCLAIM.test(v.observation || "")) {
        findings.push({
          id: "valve-overclaim",
          severity: "soft",
          message: `signaling_valves.${name} uses overconfident language.`,
          evidence: (v.reading || v.observation || "").slice(0, 120),
        });
      }
    }
    if (OVERCLAIM.test(valves.calibration || "")) {
      findings.push({
        id: "valve-calibration-overclaim",
        severity: "soft",
        message: "signaling_valves.calibration uses overconfident language.",
        evidence: (valves.calibration || "").slice(0, 120),
      });
    }
  }

  const nexus = briefing.canada_nexus;
  if (nexus) {
    if (nexus.tag && nexus.tag.toLowerCase() !== "hypothesis") {
      findings.push({
        id: "canada-nexus-tag-invalid",
        severity: "soft",
        message: "canada_nexus.tag must be hypothesis.",
        evidence: String(nexus.tag),
      });
    }
    if (nexus.framing && nexus.framing !== "civilian-reader-interest-flag") {
      findings.push({
        id: "canada-nexus-framing-invalid",
        severity: "soft",
        message: "canada_nexus must use civilian-reader-interest-flag framing (not targeting).",
        evidence: String(nexus.framing),
      });
    }
    if (nexus.level && !["none", "possible", "direct"].includes(nexus.level)) {
      findings.push({
        id: "canada-nexus-level-invalid",
        severity: "soft",
        message: "canada_nexus.level must be none|possible|direct.",
        evidence: String(nexus.level),
      });
    }
  }

  const cut = briefing.substance_cut;
  if (cut) {
    if (cut.tag && cut.tag.toLowerCase() !== "hypothesis") {
      findings.push({
        id: "substance-tag-invalid",
        severity: "soft",
        message: "substance_cut.tag must be hypothesis.",
        evidence: String(cut.tag),
      });
    }
    if (cut.framing && cut.framing !== "civilian-boilerplate-vs-substance") {
      findings.push({
        id: "substance-framing-invalid",
        severity: "soft",
        message: "substance_cut must use civilian-boilerplate-vs-substance framing.",
        evidence: String(cut.framing),
      });
    }
    if (cut.band && !["thin", "mixed", "dense"].includes(cut.band)) {
      findings.push({
        id: "substance-band-invalid",
        severity: "soft",
        message: "substance_cut.band must be thin|mixed|dense.",
        evidence: String(cut.band),
      });
    }
  }

  const desk = briefing.desk_section;
  if (desk) {
    const allowed = new Set([
      "hot_topics",
      "economy_investment",
      "foreign_affairs",
      "defense_public",
      "social_governance",
    ]);
    if (desk.tag && desk.tag.toLowerCase() !== "hypothesis") {
      findings.push({
        id: "desk-tag-invalid",
        severity: "soft",
        message: "desk_section.tag must be hypothesis.",
        evidence: String(desk.tag),
      });
    }
    if (desk.framing && desk.framing !== "civilian-briefing-desk-section") {
      findings.push({
        id: "desk-framing-invalid",
        severity: "soft",
        message: "desk_section must use civilian-briefing-desk-section framing.",
        evidence: String(desk.framing),
      });
    }
    if (desk.primary && !allowed.has(desk.primary)) {
      findings.push({
        id: "desk-primary-invalid",
        severity: "soft",
        message: "desk_section.primary not in civilian desk taxonomy.",
        evidence: String(desk.primary),
      });
    }
  }

  const analysis = briefing.content_analysis;
  if (analysis) {
    if (analysis.framing && analysis.framing !== "civilian-content-analysis") {
      findings.push({
        id: "content-analysis-framing-invalid",
        severity: "soft",
        message: "content_analysis must use civilian-content-analysis framing.",
        evidence: String(analysis.framing),
      });
    }
    if (analysis.tag && analysis.tag.toLowerCase() !== "hypothesis") {
      findings.push({
        id: "content-analysis-tag-invalid",
        severity: "soft",
        message: "content_analysis.tag must be hypothesis (draft analysis, not proven fact).",
        evidence: String(analysis.tag),
      });
    }
    if (OVERCLAIM.test(analysis.so_what || "")) {
      findings.push({
        id: "content-analysis-overclaim",
        severity: "soft",
        message: "content_analysis.so_what uses overconfident language.",
        evidence: (analysis.so_what || "").slice(0, 120),
      });
    }
  }

  const adoption = briefing.adoption;
  if (adoption) {
    if (adoption.framing && adoption.framing !== "civilian-detail-adoption") {
      findings.push({
        id: "adoption-framing-invalid",
        severity: "soft",
        message: "adoption must use civilian-detail-adoption framing.",
        evidence: String(adoption.framing),
      });
    }
    if (adoption.adopted === false && (briefing.briefing_en?.confidence || "").toLowerCase() === "high") {
      findings.push({
        id: "adoption-reject-confidence",
        severity: "soft",
        message: "Rejected (no hard detail) briefs cannot carry high confidence.",
        evidence: "confidence=high",
      });
    }
  }

  const onto = briefing.ontology_lite;
  if (onto) {
    const allowedTypes = new Set([
      "institution",
      "lexicon",
      "history_frame",
      "intl_compare",
      "method",
    ]);
    if (onto.framing && onto.framing !== "civilian-ontology-lite") {
      findings.push({
        id: "ontology-framing-invalid",
        severity: "soft",
        message: "ontology_lite must use civilian-ontology-lite framing.",
        evidence: String(onto.framing),
      });
    }
    if (onto.tag && onto.tag.toLowerCase() !== "hypothesis") {
      findings.push({
        id: "ontology-tag-invalid",
        severity: "soft",
        message: "ontology_lite.tag must be hypothesis (background layer, not proven fact).",
        evidence: String(onto.tag),
      });
    }
    for (const hit of onto.hits || []) {
      if (hit.tag && !["background", "hypothesis"].includes(hit.tag.toLowerCase())) {
        findings.push({
          id: "ontology-hit-tag-invalid",
          severity: "soft",
          message: "ontology_lite hit tag must be background|hypothesis.",
          evidence: `${hit.id || "?"}:${hit.tag}`,
        });
      }
      if (hit.type && !allowedTypes.has(hit.type)) {
        findings.push({
          id: "ontology-hit-type-invalid",
          severity: "soft",
          message: "ontology_lite hit type not in civilian ontology-lite taxonomy.",
          evidence: `${hit.id || "?"}:${hit.type}`,
        });
      }
    }
  }

  const sc = briefing.source_class;
  if (sc?.class === "social_commentary") {
    if ((briefing.briefing_en?.confidence || "").toLowerCase() === "high") {
      findings.push({
        id: "social-confidence-hard-cap",
        severity: "soft",
        message: "social_commentary sources cannot carry high confidence.",
        evidence: "confidence=high",
      });
    }
    if ((briefing.confidence_factors?.level || "").toLowerCase() === "high") {
      findings.push({
        id: "social-confidence-factors-cap",
        severity: "soft",
        message: "confidence_factors.level must stay ≤ medium for social_commentary (prefer low).",
        evidence: String(briefing.confidence_factors?.level),
      });
    }
  }
  if (sc?.framing && sc.framing !== "civilian-source-class") {
    findings.push({
      id: "source-class-framing-invalid",
      severity: "soft",
      message: "source_class must use civilian-source-class framing.",
      evidence: String(sc.framing),
    });
  }

  const confFactors = briefing.confidence_factors;
  if (confFactors) {
    if (confFactors.tag && confFactors.tag.toLowerCase() !== "hypothesis") {
      findings.push({
        id: "confidence-tag-invalid",
        severity: "soft",
        message: "confidence_factors.tag must be hypothesis.",
        evidence: String(confFactors.tag),
      });
    }
    if (confFactors.level && !["low", "medium", "high"].includes(confFactors.level)) {
      findings.push({
        id: "confidence-level-invalid",
        severity: "soft",
        message: "confidence_factors.level must be low|medium|high.",
        evidence: String(confFactors.level),
      });
    }
    const tier = confFactors.source_tier;
    if (tier?.framing && tier.framing !== "civilian-curated-source-tier") {
      findings.push({
        id: "source-tier-framing-invalid",
        severity: "soft",
        message: "source_tier must use civilian-curated-source-tier framing.",
        evidence: String(tier.framing),
      });
    }
    if (tier?.tag && tier.tag.toLowerCase() !== "hypothesis") {
      findings.push({
        id: "source-tier-tag-invalid",
        severity: "soft",
        message: "source_tier.tag must be hypothesis (curated prior, not ML truth).",
        evidence: String(tier.tag),
      });
    }
    if (
      tier?.tier === "D" &&
      (confFactors.level || "").toLowerCase() === "high"
    ) {
      findings.push({
        id: "source-tier-d-cap",
        severity: "soft",
        message: "source_tier D (social) cannot carry high confidence.",
        evidence: String(confFactors.level),
      });
    }
    if (
      (tier?.tier === "C" || tier?.tier === "U") &&
      (confFactors.level || "").toLowerCase() === "high"
    ) {
      findings.push({
        id: "source-tier-cu-cap",
        severity: "soft",
        message: "source_tier C/U curated max is medium.",
        evidence: `${tier?.tier}:${confFactors.level}`,
      });
    }
  }

  const corr = briefing.corroboration;
  if (corr && corr.score_0_to_3 != null && (corr.score_0_to_3 < 0 || corr.score_0_to_3 > 3)) {
    findings.push({
      id: "corroboration-range-invalid",
      severity: "soft",
      message: "corroboration.score_0_to_3 must be 0–3.",
      evidence: String(corr.score_0_to_3),
    });
  }
  if (corr && (corr.score_0_to_3 ?? 0) >= 2 && (corr.distinct_source_count ?? 0) < 2) {
    findings.push({
      id: "corroboration-single-source-inflated",
      severity: "soft",
      message: "corroboration ≥2 claims a cross-check, but fewer than 2 distinct sources were supplied.",
      evidence: `score=${corr.score_0_to_3} distinct_sources=${corr.distinct_source_count ?? 0}`,
    });
  }

  const cpl = briefing.canada_policy_link;
  if (cpl) {
    if (cpl.framing && cpl.framing !== "civilian-canada-public-policy-overlay") {
      findings.push({
        id: "canada-policy-framing-invalid",
        severity: "soft",
        message: "canada_policy_link must use civilian-canada-public-policy-overlay framing.",
        evidence: String(cpl.framing),
      });
    }
    if (cpl.level && !["none", "topical", "named_instrument"].includes(cpl.level)) {
      findings.push({
        id: "canada-policy-level-invalid",
        severity: "soft",
        message: "canada_policy_link.level must be none|topical|named_instrument.",
        evidence: String(cpl.level),
      });
    }
  }

  const triage = briefing.info_triage;
  if (triage) {
    if ((triage.tag || "").toLowerCase() && (triage.tag || "").toLowerCase() !== "hypothesis") {
      findings.push({
        id: "triage-tag-invalid",
        severity: "soft",
        message: "info_triage.tag must be hypothesis.",
        evidence: String(triage.tag),
      });
    }
    for (const k of triage.kinds || []) {
      if (k.kind && !ALLOWED_KINDS.has(k.kind)) {
        findings.push({
          id: "triage-kind-invalid",
          severity: "soft",
          message: "info_triage kind not in civilian taxonomy.",
          evidence: String(k.kind),
        });
      }
    }
    if (triage.primary_kind && !ALLOWED_KINDS.has(triage.primary_kind)) {
      findings.push({
        id: "triage-primary-invalid",
        severity: "soft",
        message: "info_triage.primary_kind not in civilian taxonomy.",
        evidence: String(triage.primary_kind),
      });
    }
    const grade = triage.importance?.grade;
    if (grade && !ALLOWED_GRADES.has(grade)) {
      findings.push({
        id: "triage-grade-invalid",
        severity: "soft",
        message: "importance grade must be P1|P2|P3|P4 (research priority, not secrecy).",
        evidence: String(grade),
      });
    }
    if ((triage.importance?.tag || "").toLowerCase() && (triage.importance?.tag || "").toLowerCase() !== "hypothesis") {
      findings.push({
        id: "triage-importance-tag-invalid",
        severity: "soft",
        message: "info_triage.importance.tag must be hypothesis.",
        evidence: String(triage.importance?.tag),
      });
    }
  } else {
    findings.push({
      id: "triage-missing",
      severity: "soft",
      message: "info_triage (kinds + importance grade) missing.",
      evidence: "info_triage",
    });
  }

  const scorecard = briefing.signaling_scorecard;
  if (scorecard) {
    if ((scorecard.tag || "").toLowerCase() && (scorecard.tag || "").toLowerCase() !== "hypothesis") {
      findings.push({
        id: "scorecard-tag-invalid",
        severity: "soft",
        message: "signaling_scorecard.tag must be hypothesis.",
        evidence: String(scorecard.tag),
      });
    }
    if (!scorecard.rules?.length) {
      findings.push({
        id: "scorecard-empty",
        severity: "soft",
        message: "signaling_scorecard should enumerate heuristic rules before weighting.",
        evidence: "rules=[]",
      });
    }
    for (const r of scorecard.rules || []) {
      if (r.weight != null && (r.weight < 0 || r.weight > 1)) {
        findings.push({
          id: "scorecard-weight-range",
          severity: "soft",
          message: "heuristic weight should be in [0,1].",
          evidence: `${r.id}:${r.weight}`,
        });
      }
      const st = (r.status || "").toLowerCase();
      if (st && !["hit", "miss", "unclear"].includes(st)) {
        findings.push({
          id: "scorecard-status-invalid",
          severity: "soft",
          message: "heuristic status must be hit|miss|unclear.",
          evidence: `${r.id}:${st}`,
        });
      }
    }
    if (OVERCLAIM.test(scorecard.calibration || "")) {
      findings.push({
        id: "scorecard-overclaim",
        severity: "soft",
        message: "signaling_scorecard.calibration uses overconfident language.",
        evidence: (scorecard.calibration || "").slice(0, 120),
      });
    }
  }

  for (const sc of briefing.policy_outlook?.scenarios || []) {
    const tag = (sc.tag || "").toLowerCase();
    if (tag && tag !== "hypothesis") {
      findings.push({
        id: "outlook-tag-invalid",
        severity: "soft",
        message: "policy_outlook scenarios must use tag hypothesis.",
        evidence: tag,
      });
    }
    const lik = (sc.likelihood || "").toLowerCase();
    if (lik && !["low", "medium", "high"].includes(lik)) {
      findings.push({
        id: "outlook-likelihood-invalid",
        severity: "soft",
        message: "scenario likelihood must be low|medium|high.",
        evidence: lik,
      });
    }
    const basis = sc.basis || "";
    if (OVERCLAIM.test(basis) || OVERCLAIM.test(sc.label || "")) {
      findings.push({
        id: "outlook-overclaim",
        severity: "soft",
        message: "policy_outlook uses overconfident language.",
        evidence: (sc.label || basis).slice(0, 120),
      });
    }
  }

  return findings;
}

export function gatePassed(findings: GateFinding[]): boolean {
  return !findings.some((f) => f.severity === "hard");
}
