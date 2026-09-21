import { composeBriefingSystemPrompt } from "./skills.js";
import { runClaimGate, gatePassed, type BriefingJson } from "./gate.js";
import { callLlmJson, llmConfigured } from "./llm.js";
import { offlineBriefing } from "./offline.js";
import { buildSignalingScorecard, valvesFromScorecard } from "./media-heuristics.js";
import { buildInfoTriage } from "./info-triage.js";
import { buildCanadaNexus, canadaNexusImportanceBump } from "./canada-nexus.js";
import { buildCanadaPolicyLink } from "./canada-policy-link.js";
import { buildSubstanceCut } from "./substance.js";
import { assignDeskSection } from "./briefing-desk.js";
import { matchOntologyLite } from "./ontology-lite.js";
import { detectSourceClass, type SourceClass } from "./source-class.js";
import { buildConfidenceFactors, buildCorroboration } from "./confidence.js";
import { evaluateAdoption, filterDigestByHardNuggets } from "./adoption.js";
import { appendGateAudit } from "./audit-log.js";

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
};

function buildInfoValue(
  briefing: BriefingJson
): BriefResponse["infoValue"] {
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
  const next: string[] = [];
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
  const useLlm = !req.forceOffline && configured;

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
  } else if (useLlm) {
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
    sourceCount: sources.length,
    sourceLabels: sources.map((s) => s.label),
    forcedSourceClass: req.sourceClass,
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
  ctx: { sourceCount: number; sourceLabels: string[]; forcedSourceClass?: SourceClass }
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

  if (!adoption.adopted) {
    next.source_digest_zh = [];
    next.briefing_en = {
      what: "Not adopted: paste lacks verifiable detail (numbers, deadlines, named instruments, or funding lines).",
      context: adoption.reason_zh,
      so_what:
        "Direction-only / formula language is filtered out. Paste an implementing notice or an excerpt with concrete data, then re-run.",
      confidence: "low",
      sources_used: ctx.sourceLabels,
    };
    next.policy_outlook = {
      horizon: "near",
      scenarios: [],
      watchpoints: [
        "Add: public excerpt with numbers / deadlines",
        "Add: named notice / measure / implementation plan",
        "Add: funding line or responsible body + instrument in the same paste",
      ],
    };
    next.open_questions = [
      "Is this meeting direction only, with no implementing instrument?",
      "Can you find a same-topic public implementing text and paste both?",
    ];
    next.substance_cut = {
      ...substance_cut,
      nuggets: [],
      empty_calories: [
        ...(substance_cut.empty_calories || []),
        "Adoption rule: no hard detail → whole brief rejected",
      ].slice(0, 5),
      analyst_prompt_zh: adoption.reason_zh,
    };
  } else {
    next.source_digest_zh = filterDigestByHardNuggets(
      next.source_digest_zh,
      adoption.hard_nuggets
    );
    if (!next.source_digest_zh.length && adoption.hard_nuggets.length) {
      next.source_digest_zh = adoption.hard_nuggets.slice(0, 4).map((n) => ({
        point: n.label_zh,
        quote: n.evidence.slice(0, 40),
        source_label: ctx.sourceLabels[0],
      }));
    }
    next.substance_cut = {
      ...substance_cut,
      nuggets: adoption.hard_nuggets,
    };
  }

  if (next.briefing_en && adoption.adopted) {
    const socialNote =
      source_class.class === "social_commentary"
        ? "Treat as atmosphere/rumor memo only; do not raise confidence from this source alone. "
        : "";
    next.briefing_en = {
      ...next.briefing_en,
      confidence: confidence_factors.level,
      so_what: `${socialNote}${next.briefing_en.so_what || ""}`.trim(),
    };
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

  const wpExtra: string[] = [];
  if (adoption.adopted) {
    if (substance_cut.empty_calories.length) wpExtra.push(...substance_cut.empty_calories.slice(0, 2));
    if (corroboration.missing.length) {
      wpExtra.push(`Missing corroboration: ${corroboration.missing[0]}`);
    }
    if (canada_policy_link.level !== "none" && canada_policy_link.hits[0]) {
      wpExtra.push(
        `Canada public-policy overlay: ${canada_policy_link.hits[0].theme_en || canada_policy_link.hits[0].theme_zh} (verify current public text)`
      );
    }
    if (next.policy_outlook) {
      const wp = next.policy_outlook.watchpoints || [];
      next.policy_outlook = {
        ...next.policy_outlook,
        watchpoints: [...wpExtra, ...wp].slice(0, 7),
      };
    }
  }

  if (source_class.class === "social_commentary" && adoption.adopted) {
    next.open_questions = [
      "What is the official/wire URL for the primary claim behind this social commentary?",
      ...(next.open_questions || []),
    ].slice(0, 6);
  }

  return next;
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
