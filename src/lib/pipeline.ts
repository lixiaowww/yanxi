import { composeBriefingSystemPrompt } from "./skills.js";
import { runClaimGate, gatePassed, type BriefingJson } from "./gate.js";
import { callLlmJson, llmConfigured } from "./llm.js";
import { offlineBriefing } from "./offline.js";
import { buildSignalingScorecard, valvesFromScorecard } from "./media-heuristics.js";
import { buildInfoTriage } from "./info-triage.js";
import { buildCanadaNexus, canadaNexusImportanceBump } from "./canada-nexus.js";
import { buildCanadaPolicyLink } from "./canada-policy-link.js";
import { buildSubstanceCut, type SubstanceNugget } from "./substance.js";
import { assignDeskSection } from "./briefing-desk.js";
import { matchOntologyLite } from "./ontology-lite.js";
import { detectSourceClass, type SourceClass } from "./source-class.js";
import { buildConfidenceFactors, buildCorroboration } from "./confidence.js";
import { evaluateAdoption, filterDigestByHardNuggets } from "./adoption.js";
import { appendGateAudit } from "./audit-log.js";
import { composeDigestRows, composeRejectionWhat, extractFacts, type FactSet } from "./facts.js";
import { buildContentAnalysis } from "./analysis.js";
import { resolveIntake, intakeAllowsBrief, type IntakeDecision } from "./intake.js";
import { buildTemporalCut } from "./temporal.js";
import { findRelatedBriefs, type RelatedBriefHit } from "./related-briefs.js";
import {
  clampLikelihood,
  evaluateBriefQuality,
  outlookLikelihoodCap,
} from "./brief-quality.js";

export type SourceInput = {
  label: string;
  text: string;
};

export type BriefRequest = {
  /** Single-source convenience (still supported). */
  sourceText?: string;
  sourceLabel?: string;
  /** Multi-source merge — preferred when collect combines items. */
  sources?: SourceInput[];
  forceOffline?: boolean;
  /** Optional override — social_commentary hard-caps confidence. */
  sourceClass?: SourceClass;
  /** When the paste/item was collected or received (ISO). */
  collectedAt?: string;
  /** Operator-supplied publication date (YYYY-MM-DD or ISO). */
  sourcePublishedAt?: string;
};

export type BriefResponse = {
  mode: "llm" | "offline";
  /** Why offline, or empty when LLM succeeded. */
  offlineReason?: string;
  llmConfigured: boolean;
  /** Research draft usefulness hint (not event probability). */
  infoValue: {
    level: "low" | "medium" | "high";
    label_zh: string;
    next_zh: string[];
  };
  matchedCards: string[];
  briefing: BriefingJson;
  gate: { passed: boolean; findings: ReturnType<typeof runClaimGate> };
  systemPromptChars: number;
  sourceCount: number;
  /**
   * Soft links to other outbox briefs on overlapping subjects.
   * Discovery only — not corroboration until merged and re-run.
   */
  relatedBriefs?: RelatedBriefHit[];
};

function buildInfoValue(
  briefing: BriefingJson
): BriefResponse["infoValue"] {
  const intakeLabel = briefing.intake?.label;
  if (intakeLabel === "defer") {
    return {
      level: "low",
      label_zh: "Deferred — watch queue (no hard detail yet)",
      next_zh: [
        briefing.intake?.reason_en || "Keep on a watch queue for an implementing notice",
        "Re-run when a public notice, amount, or deadline-tied instrument appears",
      ],
    };
  }
  if (intakeLabel === "social_downweight") {
    return {
      level: "low",
      label_zh: "Social commentary — down-weighted",
      next_zh: ["Paste an official or wire excerpt before treating as a primary source"],
    };
  }
  if (briefing.adoption && briefing.adoption.adopted === false) {
    return {
      level: "low",
      label_zh: "Not adopted — no detail/data",
      next_zh: [
        briefing.adoption.reason_zh ||
          "Paste a public excerpt with numbers, deadlines, or a named notice/measure",
        "Direction/meeting formula alone does not produce a substantive brief",
      ],
    };
  }
  const band = briefing.substance_cut?.band || "thin";
  const corr = briefing.corroboration?.score_0_to_3 ?? 0;
  const missing = briefing.corroboration?.missing || [];
  const qualityMissing = briefing.brief_quality?.missing || [];
  const next: string[] = [];
  if (qualityMissing.includes("second_public_source")) {
    next.push("Add a second public excerpt on the same subject (or Use related as second source)");
  }
  if (qualityMissing.includes("source_as_of")) {
    next.push("Add a dated dateline or set source published date before treating Outlook as current");
  }
  if (band === "thin" || corr < 2) {
    next.push("Add a same-topic public implementing notice and re-run with the meeting text");
  }
  if (corr < 1) {
    next.push("Add a second public source (implementing file or local restatement beyond the wire)");
  }
  if (missing.length) {
    next.push(...missing.slice(0, 2));
  }
  if (!next.length) {
    next.push("Verify numbers / deadlines / responsible bodies against a public page");
  }

  if (band === "dense" && corr >= 2) {
    return {
      level: "high",
      label_zh: "Higher info density (detail + corroboration cues)",
      next_zh: next.slice(0, 3),
    };
  }
  if (band === "thin" && corr <= 1) {
    return {
      level: "low",
      label_zh: "Low info value (formula / single-source) — add detail before reading the brief",
      next_zh: next.slice(0, 4),
    };
  }
  return {
    level: "medium",
    label_zh: "Medium info value (some detail or dual cues)",
    next_zh: next.slice(0, 3),
  };
}

export function normalizeSources(req: BriefRequest): SourceInput[] {
  if (req.sources?.length) {
    return req.sources
      .map((s) => ({ label: (s.label || "source").trim(), text: (s.text || "").trim() }))
      .filter((s) => s.text.length >= 20);
  }
  const text = (req.sourceText || "").trim();
  if (text.length >= 20) {
    return [{ label: req.sourceLabel || "paste-1", text }];
  }
  return [];
}

export async function runBriefingPipeline(req: BriefRequest): Promise<BriefResponse> {
  const sources = normalizeSources(req);
  if (!sources.length) {
    throw new Error("Provide sourceText (≥20 chars) or sources[] with usable excerpts.");
  }

  const joined = sources.map((s) => s.text).join("\n");
  const { prompt, matchedCards } = composeBriefingSystemPrompt(joined);
  const configured = llmConfigured();

  // First cut + optional second cut before spending LLM quota.
  const substanceEarly = buildSubstanceCut(joined);
  const adoptionEarly = evaluateAdoption(substanceEarly);
  const classEarly = detectSourceClass(joined, {
    forced: req.sourceClass,
    labels: sources.map((s) => s.label),
  });
  const intake = await resolveIntake({
    adopted: adoptionEarly.adopted,
    sourceClass: classEarly.class,
    text: joined,
    substance: substanceEarly,
  });
  const allowLlm = !req.forceOffline && configured && intakeAllowsBrief(intake.label);

  let briefing: BriefingJson;
  let mode: "llm" | "offline" = "offline";
  let offlineReason: string | undefined;

  if (req.forceOffline) {
    briefing = offlineBriefing(joined, matchedCards, sources[0].label, sources);
    offlineReason = "force_offline: UI/API requested template engine";
  } else if (!configured) {
    briefing = offlineBriefing(joined, matchedCards, sources[0].label, sources);
    offlineReason =
      "llm_not_configured: set LLM_API_KEY + LLM_BASE_URL + LLM_MODEL (or keep offline)";
  } else if (!intakeAllowsBrief(intake.label)) {
    briefing = offlineBriefing(joined, matchedCards, sources[0].label, sources);
    offlineReason = `intake_${intake.label}: skipped LLM — ${intake.reason_en}`;
  } else if (allowLlm) {
    try {
      briefing = await callLlmJson(prompt, userMessage(sources));
      mode = "llm";
      offlineReason = undefined;
    } catch (e) {
      briefing = offlineBriefing(joined, matchedCards, sources[0].label, sources);
      mode = "offline";
      offlineReason = `llm_error: ${e instanceof Error ? e.message.slice(0, 180) : String(e).slice(0, 180)}`;
    }
  } else {
    briefing = offlineBriefing(joined, matchedCards, sources[0].label, sources);
    offlineReason = "offline_fallback";
  }

  briefing = applyDeterministicLayers(briefing, joined, {
    mode,
    sourceCount: sources.length,
    sourceLabels: sources.map((s) => s.label),
    sources,
    forcedSourceClass: req.sourceClass,
    intake,
    collectedAt: req.collectedAt,
    sourcePublishedAt: req.sourcePublishedAt,
  });
  const finalCards =
    briefing.ontology_lite?.hits
      ?.map((h) => h.id)
      .filter((id): id is string => Boolean(id)) ?? matchedCards;
  if (briefing.briefing_en) {
    briefing.briefing_en.sources_used = sources.map((s) => s.label);
  }

  const findings = runClaimGate(briefing, joined, sources);
  const infoValue = buildInfoValue(briefing);
  let relatedBriefs: RelatedBriefHit[] = [];
  try {
    relatedBriefs = findRelatedBriefs({
      briefing,
      sourceText: joined,
      limit: 6,
    });
  } catch {
    relatedBriefs = [];
  }

  // Multi-source runs already have real corroboration; still hint if single-source.
  if (sources.length < 2 && relatedBriefs.length && infoValue.level !== "high") {
    infoValue.next_zh = [
      `Add a related outbox excerpt as a second source (${relatedBriefs[0].label}) and re-run to test cross-check`,
      ...infoValue.next_zh,
    ].slice(0, 4);
  }

  const result: BriefResponse = {
    mode,
    offlineReason,
    llmConfigured: configured,
    infoValue,
    matchedCards: finalCards,
    briefing,
    gate: { passed: gatePassed(findings), findings },
    systemPromptChars: prompt.length,
    sourceCount: sources.length,
    relatedBriefs,
  };

  try {
    appendGateAudit(result, {
      sourceText: joined,
      sourceLabel: sources.map((s) => s.label).join("+"),
    });
  } catch {
    /* audit must not break briefing */
  }

  return result;
}

function applyDeterministicLayers(
  briefing: BriefingJson,
  sourceText: string,
  ctx: {
    /** Offline digests are already fact-composed; LLM digests still get filtered. */
    mode?: "llm" | "offline";
    sourceCount: number;
    sourceLabels: string[];
    /** Per-source texts — corroboration needs them to observe cross-source overlap. */
    sources?: SourceInput[];
    forcedSourceClass?: SourceClass;
    intake?: IntakeDecision;
    collectedAt?: string;
    sourcePublishedAt?: string;
  }
): BriefingJson {
  const scorecard = buildSignalingScorecard(sourceText);
  const valves = valvesFromScorecard(scorecard);
  const canada_nexus = buildCanadaNexus(sourceText);
  const canada_policy_link = buildCanadaPolicyLink(sourceText);
  const substance_cut = buildSubstanceCut(sourceText);
  const source_class = detectSourceClass(sourceText, {
    forced: ctx.forcedSourceClass,
    labels: ctx.sourceLabels,
  });
  const corroboration = buildCorroboration({
    sourceText,
    sourceCount: ctx.sourceCount,
    substance: substance_cut,
    sources: ctx.sources,
  });
  const confidence_factors = buildConfidenceFactors({
    scorecard,
    substance: substance_cut,
    corroboration,
    sourceClass: source_class.class,
    sourceLabels: ctx.sourceLabels,
    sourceText,
  });
  const info_triage = buildInfoTriage(sourceText, {
    scorecardBand: scorecard.band,
    scorecardTotal: scorecard.weighted_total,
    readerInterestBump: canadaNexusImportanceBump(canada_nexus),
    readerInterestDriver:
      canada_nexus.level === "direct"
        ? "canada_nexus_direct"
        : canada_nexus.level === "possible"
          ? "canada_nexus_possible"
          : undefined,
  });
  const desk_section = assignDeskSection(sourceText, {
    primaryKind: info_triage.primary_kind,
  });
  const ontologyMatch = matchOntologyLite(sourceText, {
    deskPrimary: desk_section.primary,
  });
  const ontology_lite: BriefingJson["ontology_lite"] = {
    framing: ontologyMatch.framing,
    desk_primary: ontologyMatch.desk_primary,
    hits: ontologyMatch.hits,
    calibration: ontologyMatch.calibration,
    tag: ontologyMatch.tag,
  };

  const next: BriefingJson = {
    ...briefing,
    signaling_scorecard: scorecard,
    signaling_valves: valves,
    info_triage,
    canada_nexus,
    canada_policy_link,
    substance_cut,
    desk_section,
    ontology_lite,
    source_class,
    corroboration,
    confidence_factors,
  };

  const adoption = evaluateAdoption(substance_cut);
  next.adoption = adoption;
  next.intake = ctx.intake
    ? {
        framing: ctx.intake.framing,
        label: ctx.intake.label,
        first_cut: ctx.intake.first_cut,
        second_cut: ctx.intake.second_cut,
        second_cut_engine: ctx.intake.second_cut_engine,
        reason_en: ctx.intake.reason_en,
        jev: ctx.intake.jev,
        tag: ctx.intake.tag,
      }
    : undefined;

  const factsEarly = extractFacts(sourceText);
  const temporal = buildTemporalCut({
    text: sourceText,
    collectedAt: ctx.collectedAt,
    sourcePublishedAt: ctx.sourcePublishedAt,
    forwardDeadlinesEn: factsEarly.deadline.map((d) => d.value_en).filter(Boolean),
  });
  next.temporal = temporal;

  next.context_notes = ontologyMatch.hits.length
    ? ontologyMatch.hits.map((h) => ({
        card: h.id,
        note: `Civic ontology-lite [${h.type}] desk=${h.desk.join("|")} · matched=${h.matched_keywords.join(", ")} · sources: ${h.sources}. Tag=${h.tag} only — not proven secret fact.`,
        tag: h.tag,
      }))
    : [
        {
          card: "(none)",
          note: "No ontology-lite cards matched. Stay close to the literal source; do not invent institutional jargon.",
          tag: "background" as const,
        },
      ];

  const facts = factsEarly;
  const analysis =
    next.content_analysis ??
    buildContentAnalysis(facts, {
      text: sourceText,
      hotThemes: (desk_section.hot_themes || []).map((h) => h.id),
      deskPrimary: desk_section.primary,
      primaryKind: info_triage.primary_kind,
      cards: ontologyMatch.names,
      sourceCount: ctx.sourceCount,
    });

  if (!adoption.adopted) {
    const deferred = ctx.intake?.label === "defer";
    // No manufactured analysis or forecasts for a paste with no content facts.
    next.content_analysis = undefined;
    next.source_digest_zh = [];
    next.briefing_en = {
      what: composeRejectionWhat(facts),
      context: deferred
        ? "Deferred to the watch queue: thematic or institutional cues without an actionable instrument yet."
        : "No content analysis produced: the excerpt states no action, instrument, amount, deadline or scope to analyse.",
      so_what: deferred
        ? `Watch for a later public notice, funded line, or deadline-tied instrument. ${ctx.intake?.reason_en || ""} ${missingFactsSentence(facts)}`.trim()
        : `Analysis needs at least one of: the document to be issued and by whom, the amount and funding channel, the deadline, the pilot or geographic scope, or a quantified target. ${missingFactsSentence(facts)}`,
      confidence: "low",
      sources_used: ctx.sourceLabels,
    };
    next.policy_outlook = {
      horizon: "near",
      scenarios: [],
      watchpoints: deferred
        ? [
            "Whether an implementing notice or funded pilot is published on the same subject",
            "Whether a named body takes ownership of the timeline or product list",
          ]
        : [],
    };
    next.open_questions = [];
    next.substance_cut = {
      ...substance_cut,
      nuggets: deferred ? substance_cut.nuggets : [],
      empty_calories: [
        ...(substance_cut.empty_calories || []),
        deferred
          ? "Intake second cut: defer (watch queue) — no full brief"
          : "Adoption rule: no hard detail → whole brief rejected",
      ].slice(0, 5),
      analyst_prompt_zh: deferred ? ctx.intake?.reason_en || adoption.reason_zh : adoption.reason_zh,
    };
  } else {
    // The offline composer already builds fact-stated rows per source; only an
    // LLM-authored digest needs filtering down to hard-detail quotes.
    if (ctx.mode === "llm") {
      next.source_digest_zh = filterDigestByHardNuggets(
        next.source_digest_zh,
        adoption.hard_nuggets
      );
    }
    if (!next.source_digest_zh?.length) {
      next.source_digest_zh = digestFallback(ctx, adoption.hard_nuggets);
    }
    next.substance_cut = {
      ...substance_cut,
      nuggets: adoption.hard_nuggets,
    };
    next.content_analysis = analysis;
  }

  if (next.briefing_en && adoption.adopted) {
    const socialNote =
      source_class.class === "social_commentary"
        ? "This rests on social commentary rather than an official text, so the impact reading below is provisional. "
        : "";
    next.briefing_en = {
      ...next.briefing_en,
      context: next.briefing_en.context || `${analysis.domain_label_en} — ${analysis.background}`,
      confidence: confidence_factors.level,
      so_what: `${socialNote}${next.briefing_en.so_what || analysis.so_what}`.trim(),
    };
    if (!next.policy_outlook?.scenarios?.length) {
      next.policy_outlook = {
        horizon: next.policy_outlook?.horizon || "near",
        scenarios: analysis.scenarios,
        watchpoints: analysis.watchpoints,
      };
    }
    if (!next.open_questions?.length) {
      next.open_questions = analysis.open_questions;
    }
  }

  if (!adoption.adopted && next.confidence_factors) {
    next.confidence_factors = {
      ...next.confidence_factors,
      level: "low",
      caps_applied: [
        ...(next.confidence_factors.caps_applied || []),
        "adoption_reject_no_hard_detail",
      ],
      rationale: `${next.confidence_factors.rationale} Adoption=reject (no hard detail/data).`,
    };
  }

  // Reader-facing watchpoints stay observable events/decisions/data. Method
  // gaps (substance band, corroboration, source tier) live in their own fields
  // and in the collapsed analyst-detail panel, not in the briefing narrative.
  if (adoption.adopted && next.policy_outlook) {
    const freshnessWatch =
      temporal.freshness.band === "unknown"
        ? ["Confirm publication or meeting date — paste has no dated dateline"]
        : temporal.freshness.band === "stale" || temporal.freshness.band === "aging"
          ? [
              `Re-check for a newer public text (source as-of ${temporal.source_as_of || "?"} looks ${temporal.freshness.band})`,
            ]
          : [];
    next.policy_outlook = {
      ...next.policy_outlook,
      watchpoints: [
        ...new Set([
          ...(next.policy_outlook.watchpoints?.length
            ? next.policy_outlook.watchpoints
            : analysis.watchpoints || []),
          ...freshnessWatch,
        ]),
      ].slice(0, 8),
    };
  }

  // DP F11–F12: brief quality gate + freshness likelihood caps.
  const brief_quality = evaluateBriefQuality({
    adopted: adoption.adopted,
    distinctSourceCount: corroboration.distinct_source_count ?? ctx.sourceCount,
    temporal,
    operatorDated: Boolean(ctx.sourcePublishedAt),
  });
  next.brief_quality = brief_quality;

  if (adoption.adopted && next.policy_outlook?.scenarios?.length) {
    const cap = outlookLikelihoodCap(temporal);
    const clampScenarios = <
      T extends { likelihood?: string; alternative?: string; falsifier?: string; trigger?: string },
    >(
      scenarios: T[]
    ): T[] =>
      scenarios.map((s) => {
        const lik = (s.likelihood || "low").toLowerCase();
        const base =
          lik === "high" || lik === "medium" || lik === "low" ? lik : ("low" as const);
        return {
          ...s,
          likelihood: clampLikelihood(base, cap),
          alternative:
            s.alternative ||
            "Competing reading: the excerpt is signalling without near-term delivery (hypothesis).",
          falsifier:
            s.falsifier ||
            (s.trigger
              ? `Public observation opposite to the trigger: ${s.trigger}`
              : "A clear public text on the same subject that contradicts this outcome."),
        };
      });
    next.policy_outlook = {
      ...next.policy_outlook,
      scenarios: clampScenarios(next.policy_outlook.scenarios),
    };
    if (next.content_analysis?.scenarios?.length) {
      next.content_analysis = {
        ...next.content_analysis,
        scenarios: clampScenarios(next.content_analysis.scenarios),
      };
    }
  }

  if (source_class.class === "social_commentary" && adoption.adopted) {
    next.open_questions = [
      "Which official or wire text carries the primary claim behind this account?",
      ...(next.open_questions || []),
    ].slice(0, 6);
  }

  return next;
}

/** Name the content facts a rejected paste would need, in reader terms. */
function missingFactsSentence(facts: FactSet): string {
  const missing: string[] = [];
  if (!facts.instrument.length) missing.push("no document or measure is named");
  if (!facts.money.length) missing.push("no amount or funding channel appears");
  if (!facts.deadline.length) missing.push("no date is given");
  if (!facts.scope.length) missing.push("no pilot or geographic scope is set");
  if (!facts.quantity.length) missing.push("no quantified target is stated");
  return missing.length
    ? `In this excerpt ${missing.slice(0, 4).join(", ")}.`
    : "This excerpt states no actionable commitment.";
}

/**
 * Rebuild digest rows from the paste when the incoming ones are unusable.
 * Prefers fact-composed rows and falls back to hard-nugget quotes, which stay
 * exact substrings so the claim gate keeps passing.
 */
function digestFallback(
  ctx: { sources?: SourceInput[]; sourceLabels: string[] },
  hard: SubstanceNugget[]
): NonNullable<BriefingJson["source_digest_zh"]> {
  const rows: NonNullable<BriefingJson["source_digest_zh"]> = [];
  for (const src of ctx.sources || []) {
    rows.push(...composeDigestRows(src.text, src.label, 3));
  }
  if (rows.length) return rows.slice(0, 6);
  return hard.slice(0, 4).map((n) => ({
    point: `Establishes ${n.label_zh.toLowerCase()}: ${n.value_en}.`,
    quote: n.evidence,
    source_label: ctx.sourceLabels[0],
  }));
}

function userMessage(sources: SourceInput[]): string {
  const blocks = sources.map((s, i) => `### Source ${i + 1}: ${s.label}\n${s.text}`);
  return [
    `Source count: ${sources.length}`,
    "Public Mandarin source text follows. Analyze only these texts + loaded context cards.",
    "Tag each digest quote with source_label matching one of the source labels below.",
    "First enumerate ALL signaling heuristics, then weight them.",
    "Also triage: kinds + P1–P4. Never use secrecy markings.",
    "Strip formulaic party-speak; ADOPT only excerpts with hard detail (numbers, deadlines, named 通知/办法, funding) or responsible-body+named-sector. Otherwise reject.",
    "Factorize confidence; social commentary cannot alone corroborate or reach high confidence.",
    "-----",
    ...blocks,
  ].join("\n\n");
}
