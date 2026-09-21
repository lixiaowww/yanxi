import type { BriefingJson } from "./gate.js";
import {
  buildSignalingScorecard,
  confidenceFromBand,
  valvesFromScorecard,
} from "./media-heuristics.js";
import { composeDigestRows, composeWhatEn, extractFacts } from "./facts.js";
import { buildContentAnalysis } from "./analysis.js";
import { assignDeskSection, matchHotThemes } from "./briefing-desk.js";

export type OfflineSource = { label: string; text: string };

/**
 * Rule-based briefing so the default path runs with no API key.
 *
 * Reader-facing sections carry content: extracted facts in `what`, domain
 * impact analysis in `so_what`, and forward scenarios / watchpoints /
 * open questions from `analysis.ts`. Pipeline QA (substance band,
 * corroboration, source tier) stays in its own structured fields.
 */
export function offlineBriefing(
  sourceText: string,
  matchedCards: string[],
  sourceLabel?: string,
  sources?: OfflineSource[]
): BriefingJson {
  const corpus: OfflineSource[] =
    sources && sources.length > 0
      ? sources
      : [{ label: sourceLabel || "paste-1", text: sourceText }];

  // Each digest row states in English what its quote establishes; the quote
  // itself stays a verbatim substring of that source so the gate passes.
  const digest: BriefingJson["source_digest_zh"] = [];
  for (const src of corpus) {
    digest.push(...composeDigestRows(src.text, src.label, corpus.length > 1 ? 2 : 4));
  }

  const context_notes = matchedCards.map((card) => ({
    card,
    note:
      card === "policy-signaling-valves"
        ? "Matched signaling catalog: enumerate all public-media heuristics, then apply weights — not secret rules."
        : `Matched lexicon/card "${card}" from keywords in the paste. Treat as background for vocabulary only — not proof of intent.`,
    tag: "background" as const,
  }));

  if (!context_notes.length) {
    context_notes.push({
      card: "(none)",
      note: "No context-card keywords matched. Briefing stays close to the literal source.",
      tag: "background",
    });
  }

  const joined = corpus.map((s) => s.text).join("\n");
  const facts = extractFacts(joined);
  const what = composeWhatEn(facts, {
    sourceCount: corpus.length,
    sourceLabels: corpus.map((s) => s.label),
  });

  const scorecard = buildSignalingScorecard(joined);
  const valves = valvesFromScorecard(scorecard);

  const desk = assignDeskSection(joined);
  const analysis = buildContentAnalysis(facts, {
    text: joined,
    hotThemes: matchHotThemes(joined).map((h) => h.id),
    deskPrimary: desk.primary,
    cards: matchedCards,
    sourceCount: corpus.length,
  });

  return {
    source_digest_zh: digest,
    context_notes,
    signaling_scorecard: scorecard,
    signaling_valves: valves,
    content_analysis: analysis,
    briefing_en: {
      what,
      context: `${analysis.domain_label_en} — ${analysis.background}`,
      so_what: analysis.so_what,
      confidence: confidenceFromBand(scorecard.band),
      sources_used: corpus.map((s) => s.label),
    },
    policy_outlook: {
      horizon: "near",
      scenarios: analysis.scenarios,
      watchpoints: analysis.watchpoints,
    },
    open_questions: analysis.open_questions,
  };
}
