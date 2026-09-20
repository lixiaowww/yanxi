import type { BriefingJson } from "./gate.js";

/** Rule-based fallback so the demo runs without API keys. */
export function offlineBriefing(
  sourceText: string,
  matchedCards: string[],
  sourceLabel?: string
): BriefingJson {
  const sentences = sourceText
    .split(/[。！？；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);

  const digest = sentences.slice(0, 4).map((s) => {
    const quote = s.length > 36 ? s.slice(0, 36) : s;
    return {
      point: `Source states: ${quote}${s.length > 36 ? "…" : ""}`,
      quote,
    };
  });

  const context_notes = matchedCards.map((card) => ({
    card,
    note: `Matched lexicon/card "${card}" from keywords in the paste. Treat as background for vocabulary only — not proof of intent.`,
    tag: "background" as const,
  }));

  if (!context_notes.length) {
    context_notes.push({
      card: "(none)",
      note: "No context-card keywords matched. Briefing stays close to the literal source.",
      tag: "background",
    });
  }

  const head = sentences[0] || sourceText.slice(0, 80);
  const what = `The Mandarin source discusses: ${head.slice(0, 120)}${head.length > 120 ? "…" : ""}`;
  const policyRelated = matchedCards.some((c) =>
    /macro-policy|industrial-tech|foreign-policy|party-state|social-governance/.test(c)
  );

  return {
    source_digest_zh: digest,
    context_notes,
    briefing_en: {
      what,
      context:
        matchedCards.length > 0
          ? `Background vocabulary cards matched: ${matchedCards.join(", ")}. These gloss political/cultural terms for an English reader; they do not add unsourced facts.`
          : "No specialized lexicon cards matched; context is limited to the pasted text.",
      so_what:
        "For a research workflow, the next step is human review: verify quotes against the full public article, confirm dates/figures, and decide whether additional open sources are needed. This offline engine does not invent conclusions.",
      confidence: matchedCards.length ? "medium" : "low",
      sources_used: [sourceLabel || "paste-1"],
    },
    policy_outlook: policyRelated
      ? {
          horizon: "near",
          scenarios: [
            {
              label: "Base — stated priorities continue in public messaging",
              likelihood: "medium",
              basis: "Offline heuristic: matched policy-related cards + language already present in the paste. Continuity of published priority vocabulary is a common open-source reading, not a forecast of outcomes.",
              tag: "hypothesis",
            },
            {
              label: "Downside — implementation lag or competing priorities appear in later public docs",
              likelihood: "medium",
              basis: "Meeting/report language often outruns delivery; subsequent public work reports or ministry notices may show sequencing stress. Treat as a watch hypothesis only.",
              tag: "hypothesis",
            },
            {
              label: "Upside — follow-on public measures reinforce the same vocabulary",
              likelihood: "low",
              basis: "Only if later open sources show concrete instruments aligned with the paste. Offline mode cannot verify this.",
              tag: "hypothesis",
            },
          ],
          watchpoints: [
            "Next public work report or ministry notice using the same priority terms",
            "Independent open reporting on concrete budgets, pilots, or timelines",
            "Whether figures/names truncated in the paste are completed in the full article",
          ],
        }
      : {
          horizon: "near",
          scenarios: [
            {
              label: "Insufficient policy signal for structured outlook",
              likelihood: "low",
              basis: "No policy-related context cards matched; outlook withheld beyond literal reading.",
              tag: "hypothesis",
            },
          ],
          watchpoints: ["Re-run after pasting a fuller public policy excerpt"],
        },
    open_questions: [
      "What is the full original URL/title of this public source?",
      "Are figures or proper names complete, or truncated in the paste?",
      "Which claims require a second independent public source?",
    ],
  };
}
