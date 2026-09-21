/**
 * Optional TypeSafe Jev (System One) client for gray-zone intake Choice.
 * Civilian decision aid only — never writes briefing prose, never covers ethics/gate.
 */
export type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export type JevResponse = {
  model: string;
  answers: Record<string, JevChoiceAnswer | { type: string; [k: string]: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export function jevConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY);
}

export function jevModel(): string {
  return process.env.JEV_MODEL || "jev-1.13.0";
}

export function jevBaseUrl(): string {
  return (process.env.JEV_BASE_URL || "https://api.typesafe.ai/v1").replace(/\/$/, "");
}

/**
 * Ask Jev to choose defer vs reject_thin for a first-cut reject.
 * Returns null on any failure — caller keeps the local second cut.
 */
export async function jevIntakeChoice(state: {
  excerpt: string;
  first_cut: string;
  substance_band: string;
  nugget_kinds: string[];
  source_class: string;
}): Promise<{ choice: "defer" | "reject_thin"; confidence: number; model: string; probabilities?: Record<string, number> } | null> {
  if (!jevConfigured()) return null;

  const key = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY || "";
  const body = {
    model: jevModel(),
    state: {
      task: "civilian_public_source_intake",
      note: "Decide whether this Mandarin public excerpt belongs on a watch queue (defer) or should be dropped as thin formula (reject_thin). Do not admit. Not an intelligence product.",
      first_cut: state.first_cut,
      substance_band: state.substance_band,
      nugget_kinds: state.nugget_kinds,
      source_class: state.source_class,
      excerpt: state.excerpt.slice(0, 6000),
    },
    questions: {
      intake: {
        type: "choice",
        instructions:
          "After a hard-detail first cut rejected this paste, should a civilian research desk keep it on a watch queue or discard it as empty formula?",
        criteria: {
          defer:
            "Worth watching: named body and sector/product, risk lexicon with a sector, bilateral/theme hooks without an instrument yet, or a deadline without a funded action — queue for a later implementing file.",
          reject_thin:
            "Empty direction/formula or bare vocabulary with no watch value — discard for briefing intake.",
        },
      },
    },
  };

  try {
    const res = await fetch(`${jevBaseUrl()}/systemone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as JevResponse;
    const ans = json.answers?.intake as JevChoiceAnswer | undefined;
    const choice = ans?.choice;
    if (choice !== "defer" && choice !== "reject_thin") return null;
    return {
      choice,
      confidence: typeof ans?.confidence === "number" ? ans.confidence : 0,
      model: json.model || jevModel(),
      probabilities: ans?.probabilities,
    };
  } catch {
    return null;
  }
}
