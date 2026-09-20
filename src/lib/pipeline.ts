import { composeBriefingSystemPrompt } from "./skills.js";
import { runClaimGate, gatePassed, type BriefingJson } from "./gate.js";
import { callLlmJson, llmConfigured } from "./llm.js";
import { offlineBriefing } from "./offline.js";

export type BriefRequest = {
  sourceText: string;
  sourceLabel?: string;
  forceOffline?: boolean;
};

export type BriefResponse = {
  mode: "llm" | "offline";
  matchedCards: string[];
  briefing: BriefingJson;
  gate: { passed: boolean; findings: ReturnType<typeof runClaimGate> };
  systemPromptChars: number;
};

export async function runBriefingPipeline(req: BriefRequest): Promise<BriefResponse> {
  const sourceText = (req.sourceText || "").trim();
  if (sourceText.length < 20) {
    throw new Error("sourceText too short — paste a public Mandarin excerpt (≥20 chars).");
  }

  const { prompt, matchedCards } = composeBriefingSystemPrompt(sourceText);
  const useLlm = !req.forceOffline && llmConfigured();

  let briefing: BriefingJson;
  let mode: "llm" | "offline" = "offline";

  if (useLlm) {
    try {
      briefing = await callLlmJson(prompt, userMessage(sourceText, req.sourceLabel));
      mode = "llm";
    } catch {
      briefing = offlineBriefing(sourceText, matchedCards, req.sourceLabel);
      mode = "offline";
    }
  } else {
    briefing = offlineBriefing(sourceText, matchedCards, req.sourceLabel);
  }

  const findings = runClaimGate(briefing, sourceText);
  return {
    mode,
    matchedCards,
    briefing,
    gate: { passed: gatePassed(findings), findings },
    systemPromptChars: prompt.length,
  };
}

function userMessage(sourceText: string, label?: string): string {
  return [
    `Source label: ${label || "paste-1"}`,
    "Public Mandarin source text follows. Analyze only this text + loaded context cards.",
    "-----",
    sourceText,
  ].join("\n");
}
