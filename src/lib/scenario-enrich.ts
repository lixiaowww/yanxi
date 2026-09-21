/**
 * Optional LLM enrichment for the F13 four-piece forecast (alternative /
 * falsifier). The offline rule engine in `analysis.ts` fills these two
 * fields from a small set of hand-written fallback sentences shared across
 * scenarios and domains — readable once, repetitive on a second brief.
 *
 * This module makes a single, narrowly-scoped LLM call that sees every
 * scenario for the brief at once (the ACH — Analysis of Competing
 * Hypotheses — pattern: score/compare candidates together so the model is
 * forced to discriminate between them, rather than writing each in
 * isolation). It never touches label / basis / trigger / likelihood, and it
 * never runs offline — `npm test` stays fully deterministic because no
 * LLM_API_KEY is set in that environment.
 *
 * Soft-fails to null on any error, timeout, malformed JSON, missing field,
 * or duplicate alternative text — callers keep the rule-based fields.
 *
 * Rate-limit cooldown: this is a *second* call on top of the main briefing
 * call, on the same provider/account. If that provider just returned 429
 * (seen in practice on Groq's free/on-demand tier — see docs/DP-brief-quality
 * §4.3a), immediately trying again here only adds latency and digs the
 * per-minute token budget deeper. After a 429, skip attempts for a short
 * cooldown window instead of calling out and waiting on a doomed request.
 */
import { callLlmJson, llmConfigured } from "./llm.js";
import type { PolicyScenario } from "./gate.js";

const ENRICH_TIMEOUT_MS = 12_000;
const MAX_FIELD_CHARS = 400;
const MAX_EXCERPT_CHARS = 4000;
const RATE_LIMIT_COOLDOWN_MS = 60_000;

let cooldownUntil = 0;

export function scenarioEnrichEnabled(): boolean {
  return llmConfigured() && process.env.YANXI_SCENARIO_ENRICH !== "0";
}

/** Test-only: clear the rate-limit cooldown between unrelated test cases. */
export function resetScenarioEnrichCooldown(): void {
  cooldownUntil = 0;
}

type EnrichRow = { index?: number; alternative?: string; falsifier?: string };
type EnrichResponse = { scenarios?: EnrichRow[] };

const SYSTEM_PROMPT = `You support a civilian, open-source Mandarin-to-English research briefing tool. You are given a public excerpt and a list of forecast scenarios already drafted for it (label, basis, trigger, likelihood). Your only job: for EACH scenario, write "alternative" and "falsifier".

- alternative: a competing reading of the SAME excerpt that argues against that specific scenario. Every scenario's alternative must be substantively different from every other scenario's alternative in this batch — never reuse a sentence across scenarios.
- falsifier: one concrete, independently observable public condition that would show this scenario did not happen. It must add information beyond the trigger — do not just restate or negate the trigger.

Stay civilian and hedged (hypothesis, not fact; no "will definitely"). Keep each field to one or two sentences. Return ONLY JSON: {"scenarios":[{"index":0,"alternative":"...","falsifier":"..."}, ...]} — one row per input scenario, in the same order, matching count exactly.`;

export async function enrichScenarioAlternatives(
  sourceText: string,
  scenarios: PolicyScenario[]
): Promise<PolicyScenario[] | null> {
  if (!scenarioEnrichEnabled() || !scenarios.length) return null;
  if (Date.now() < cooldownUntil) return null;

  const user = JSON.stringify({
    excerpt: sourceText.slice(0, MAX_EXCERPT_CHARS),
    scenarios: scenarios.map((s, index) => ({
      index,
      label: s.label,
      basis: s.basis,
      trigger: s.trigger,
      likelihood: s.likelihood,
    })),
  });

  let parsed: EnrichResponse;
  try {
    parsed = await callLlmJson<EnrichResponse>(SYSTEM_PROMPT, user, {
      timeoutMs: ENRICH_TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof Error && /HTTP 429/.test(e.message)) {
      cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    }
    return null;
  }

  const rows = parsed?.scenarios;
  if (!Array.isArray(rows) || rows.length !== scenarios.length) return null;

  const seenAlternatives = new Set<string>();
  const out: PolicyScenario[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const row = rows.find((r) => r?.index === i) ?? rows[i];
    const alternative = typeof row?.alternative === "string" ? row.alternative.trim() : "";
    const falsifier = typeof row?.falsifier === "string" ? row.falsifier.trim() : "";
    if (!alternative || !falsifier) return null;
    const key = alternative.toLowerCase();
    if (seenAlternatives.has(key)) return null; // failed to discriminate — keep rule-based fields
    seenAlternatives.add(key);
    out.push({
      ...scenarios[i],
      alternative: alternative.slice(0, MAX_FIELD_CHARS),
      falsifier: falsifier.slice(0, MAX_FIELD_CHARS),
    });
  }
  return out;
}
