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
  matchedCards: string[];
  briefing: BriefingJson;
  gate: { passed: boolean; findings: ReturnType<typeof runClaimGate> };
  systemPromptChars: number;
  sourceCount: number;
};

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
  const useLlm = !req.forceOffline && llmConfigured();

  let briefing: BriefingJson;
  let mode: "llm" | "offline" = "offline";

  if (useLlm) {
    try {
      briefing = await callLlmJson(prompt, userMessage(sources));
      mode = "llm";
    } catch {
      briefing = offlineBriefing(joined, matchedCards, sources[0].label, sources);
      mode = "offline";
    }
  } else {
    briefing = offlineBriefing(joined, matchedCards, sources[0].label, sources);
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
  const result: BriefResponse = {
    mode,
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

  if (next.briefing_en) {
    const topNuggets = substance_cut.nuggets
      .slice(0, 3)
      .map((n) => n.evidence)
      .join(" · ");
    const substanceLead =
      substance_cut.band === "thin"
        ? `Substance cut=${substance_cut.band} (${substance_cut.label_zh}). `
        : topNuggets
          ? `Substance nuggets: ${topNuggets}. `
          : "";
    const socialNote =
      source_class.class === "social_commentary"
        ? "Source class=social_commentary — treat as rumor/atmosphere memo only; do not raise confidence. "
        : "";
    next.briefing_en = {
      ...next.briefing_en,
      confidence: confidence_factors.level,
      so_what: `${socialNote}${substanceLead}${next.briefing_en.so_what || ""}`.trim(),
    };
  }

  const wpExtra: string[] = [];
  if (substance_cut.empty_calories.length) wpExtra.push(...substance_cut.empty_calories.slice(0, 2));
  if (corroboration.missing.length) {
    wpExtra.push(`缺印证: ${corroboration.missing[0]}`);
  }
  if (canada_policy_link.level !== "none" && canada_policy_link.hits[0]) {
    wpExtra.push(
      `加国公开政策对照: ${canada_policy_link.hits[0].theme_zh}（须核验现行公开文本）`
    );
  }
  if (next.policy_outlook) {
    const wp = next.policy_outlook.watchpoints || [];
    next.policy_outlook = {
      ...next.policy_outlook,
      watchpoints: [...wpExtra, ...wp].slice(0, 7),
    };
  }

  if (source_class.class === "social_commentary") {
    next.open_questions = [
      "社交转述的主源官方/通稿链接是什么？",
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
    "Strip formulaic party-speak; lead analysis with verifiable substance nuggets only.",
    "Factorize confidence; social commentary cannot alone corroborate or reach high confidence.",
    "-----",
    ...blocks,
  ].join("\n\n");
}
