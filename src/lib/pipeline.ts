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
import { detectSourceClass, SOURCE_CLASSES, type SourceClass } from "./source-class.js";
import { buildConfidenceFactors, buildCorroboration } from "./confidence.js";
import { evaluateAdoption, filterDigestByHardNuggets } from "./adoption.js";
import { appendGateAudit } from "./audit-log.js";
import { composeDigestRows, composeRejectionWhat, extractFacts, type FactSet } from "./facts.js";
import { buildContentAnalysis, listProfileOptions, pickProfile } from "./analysis.js";
import { resolveIntake, intakeAllowsBrief, type IntakeDecision, type IntakeLabel } from "./intake.js";
import { buildTemporalCut } from "./temporal.js";
import { findRelatedBriefs, type RelatedBriefHit } from "./related-briefs.js";
import { enrichScenarioAlternatives } from "./scenario-enrich.js";
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
  /**
   * Human-in-the-loop overrides (non-blocking): re-send the same source(s)
   * with one of these set to resolve the matching `briefing.human_review`
   * point. Only takes effect when the system was actually in that gray
   * zone — see `docs/DP-brief-quality.md` §4.4 for detection rules.
   */
  forcedIntakeLabel?: IntakeLabel;
  forcedDomainProfile?: string;
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
  // Unforced read — used only to detect whether source class was ambiguous
  // (no lexicon hit) before any human/UI override is applied below.
  const autoClass = detectSourceClass(joined, { labels: sources.map((s) => s.label) });
  const sourceClassAmbiguous = autoClass.class === "unknown_public" && autoClass.evidence.length === 0;
  const classEarly = detectSourceClass(joined, {
    forced: req.sourceClass,
    labels: sources.map((s) => s.label),
  });
  let intake = await resolveIntake({
    adopted: adoptionEarly.adopted,
    sourceClass: classEarly.class,
    text: joined,
    substance: substanceEarly,
  });
  // Gray zone: first cut found no hard detail (not admit, not social). A
  // human may know better than the local_gray heuristic / Jev here — see
  // docs/DP-brief-quality.md §4.4. Never overrides admit/social_downweight.
  const intakeGrayOpen = intake.first_cut === "reject_thin";
  const intakeAutoLabel = intake.label;
  if (req.forcedIntakeLabel && intakeGrayOpen && req.forcedIntakeLabel !== intake.label) {
    intake = {
      ...intake,
      label: req.forcedIntakeLabel,
      second_cut: req.forcedIntakeLabel,
      second_cut_engine: "human_override",
      reason_en: `Human review override: forced ${req.forcedIntakeLabel} (system suggested ${intake.second_cut ?? intake.first_cut}).`,
    };
  }
  const forcedAdopt = intakeGrayOpen && req.forcedIntakeLabel === "admit";
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
    sourceClassAmbiguous,
    intake,
    intakeGrayOpen,
    intakeAutoLabel,
    forcedAdopt,
    forcedDomainProfile: req.forcedDomainProfile,
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

  // Optional — F13 alternative/falsifier enrichment (ACH-style: every
  // scenario reviewed together in one call so they read as distinct rather
  // than the rule engine's shared fallback sentence). Never runs offline;
  // any failure keeps the rule-based fields untouched. Gated on mode==="llm"
  // (not just allowLlm) so a request whose main call already failed/rate-
  // limited doesn't immediately fire a second doomed call at the same
  // provider — see scenario-enrich.ts for the short cooldown after a 429.
  if (mode === "llm" && briefing.adoption?.adopted !== false && briefing.policy_outlook?.scenarios?.length) {
    try {
      const enriched = await enrichScenarioAlternatives(joined, briefing.policy_outlook.scenarios);
      if (enriched) {
        briefing.policy_outlook = { ...briefing.policy_outlook, scenarios: enriched };
        if (briefing.content_analysis?.scenarios?.length === enriched.length) {
          briefing.content_analysis = { ...briefing.content_analysis, scenarios: enriched };
        }
      }
    } catch {
      /* enrichment is optional; keep rule-based alternative/falsifier */
    }
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
    /** True when the unforced source-class read found no lexicon cue at all. */
    sourceClassAmbiguous?: boolean;
    intake?: IntakeDecision;
    /** True when intake's first cut was reject_thin (the actual gray zone). */
    intakeGrayOpen?: boolean;
    /** intake.label before any human_override was applied — for system_pick display. */
    intakeAutoLabel?: IntakeLabel;
    /** Human review forced intake to "admit" despite no hard nuggets. */
    forcedAdopt?: boolean;
    forcedDomainProfile?: string;
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

  let adoption = evaluateAdoption(substance_cut);
  if (ctx.forcedAdopt && !adoption.adopted) {
    adoption = {
      ...adoption,
      adopted: true,
      human_override: true,
      label_zh: "Human review override: admit (no hard nuggets found automatically).",
      reason_zh: `Human review override forced admit. Automatic read: ${adoption.reason_zh}`,
      rejected_as: null,
    };
  }
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
  const analysisMatchCtx = {
    text: sourceText,
    hotThemes: (desk_section.hot_themes || []).map((h) => h.id),
    deskPrimary: desk_section.primary,
    primaryKind: info_triage.primary_kind,
    cards: ontologyMatch.names,
  };
  // What the rule engine would pick on its own — kept for the human_review
  // system_pick display even when forcedDomainProfile below overrides it.
  const autoProfileId = pickProfile(analysisMatchCtx).id;
  // A forced domain profile must win even if an upstream pass (offline
  // template or LLM) already set content_analysis — that's the whole point
  // of the override, so don't let the `??` below skip it.
  const analysis = ctx.forcedDomainProfile
    ? buildContentAnalysis(facts, {
        ...analysisMatchCtx,
        sourceCount: ctx.sourceCount,
        forcedProfileId: ctx.forcedDomainProfile,
      })
    : (next.content_analysis ??
      buildContentAnalysis(facts, { ...analysisMatchCtx, sourceCount: ctx.sourceCount }));

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
    const domainForced = Boolean(ctx.forcedDomainProfile);
    next.briefing_en = {
      ...next.briefing_en,
      context:
        !domainForced && next.briefing_en.context
          ? next.briefing_en.context
          : `${analysis.domain_label_en} — ${analysis.background}`,
      confidence: confidence_factors.level,
      so_what: `${socialNote}${domainForced ? analysis.so_what : next.briefing_en.so_what || analysis.so_what}`.trim(),
    };
    // Same reasoning as content_analysis above: a forced domain must
    // replace whatever scenarios an earlier pass already set.
    if (ctx.forcedDomainProfile || !next.policy_outlook?.scenarios?.length) {
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

  next.human_review = buildHumanReviewPoints({
    sourceClassAmbiguous: ctx.sourceClassAmbiguous,
    forcedSourceClass: ctx.forcedSourceClass,
    intakeGrayOpen: ctx.intakeGrayOpen,
    intakeAutoLabel: ctx.intakeAutoLabel,
    resolvedIntakeLabel: next.intake?.label,
    intakeResolvedByOverride: next.intake?.second_cut_engine === "human_override",
    adopted: adoption.adopted,
    domain: autoProfileId,
    // macro_finance/canada_trade/defense_public/social_governance all match
    // on deskPrimary alone, so pickProfile's general_policy fallback is
    // effectively unreachable once assignDeskSection has already defaulted
    // (see docs/DP-brief-quality.md §4.4) — a defaulted desk is the signal
    // that actually fires: whichever profile matched was picked off a desk
    // guess, not a real keyword hit.
    domainGuessed: Boolean(desk_section.rationale?.startsWith("No strong desk cue")),
    forcedDomainProfile: ctx.forcedDomainProfile,
  });

  return next;
}

/**
 * The three points where a deterministic layer had to guess rather than
 * detect with confidence (docs/DP-brief-quality.md §4.4). Non-blocking:
 * the brief above already stands; this just names what to double-check and
 * how (re-send the same source(s) with the matching BriefRequest override).
 */
function buildHumanReviewPoints(ctx: {
  sourceClassAmbiguous?: boolean;
  forcedSourceClass?: SourceClass;
  intakeGrayOpen?: boolean;
  intakeAutoLabel?: IntakeLabel;
  resolvedIntakeLabel?: string;
  intakeResolvedByOverride?: boolean;
  adopted: boolean;
  domain?: string;
  domainGuessed?: boolean;
  forcedDomainProfile?: string;
}): BriefingJson["human_review"] {
  const points: NonNullable<BriefingJson["human_review"]> = [];

  if (ctx.sourceClassAmbiguous) {
    points.push({
      id: "source_class",
      question_en:
        "No lexicon cue matched this excerpt's source class. Which is it?",
      options: SOURCE_CLASSES.map((c) => ({ value: c, label_en: sourceClassLabelEn(c) })),
      system_pick: "unknown_public",
      system_pick_label_en: sourceClassLabelEn("unknown_public"),
      status: ctx.forcedSourceClass ? "resolved" : "open",
      resolved_value: ctx.forcedSourceClass,
    });
  }

  if (ctx.intakeGrayOpen) {
    points.push({
      id: "intake_gray",
      question_en:
        "No hard detail was found automatically, so this fell to the intake gray-zone heuristic. Confirm or override:",
      options: [
        { value: "admit", label_en: "Admit — treat as a full brief (I see real detail here)" },
        { value: "defer", label_en: "Defer — watch queue, worth a re-check later" },
        { value: "reject_thin", label_en: "Reject — no usable detail" },
      ],
      system_pick: ctx.intakeAutoLabel || "reject_thin",
      system_pick_label_en: intakeLabelEn(ctx.intakeAutoLabel || "reject_thin"),
      status: ctx.intakeResolvedByOverride ? "resolved" : "open",
      resolved_value: ctx.intakeResolvedByOverride ? ctx.resolvedIntakeLabel : undefined,
    });
  }

  if (ctx.adopted && (ctx.domain === "general_policy" || ctx.domainGuessed)) {
    const resolved = Boolean(ctx.forcedDomainProfile);
    points.push({
      id: "domain_profile",
      question_en: ctx.domainGuessed
        ? "No desk/topic keyword matched this excerpt strongly, so the domain below was picked by default rather than a real hit. Confirm or pick a closer domain for sharper so-what/scenarios:"
        : "No domain profile matched this excerpt, so analysis fell back to the generic public-policy template. Pick the closest domain for sharper so-what/scenarios:",
      options: listProfileOptions(),
      system_pick: ctx.domain || "general_policy",
      system_pick_label_en:
        listProfileOptions().find((p) => p.value === ctx.domain)?.label_en || "Public policy (generic)",
      status: resolved ? "resolved" : "open",
      resolved_value: resolved ? ctx.forcedDomainProfile : undefined,
    });
  }

  return points;
}

function sourceClassLabelEn(c: string): string {
  switch (c) {
    case "official_or_wire":
      return "Official / wire";
    case "policy_instrument":
      return "Policy instrument file";
    case "press_commentary":
      return "Press commentary";
    case "social_commentary":
      return "Social commentary / self-media";
    default:
      return "Unclassified public text";
  }
}

function intakeLabelEn(l: IntakeLabel): string {
  switch (l) {
    case "admit":
      return "Admit";
    case "defer":
      return "Defer — watch queue";
    case "reject_thin":
      return "Reject — no usable detail";
    default:
      return l;
  }
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
