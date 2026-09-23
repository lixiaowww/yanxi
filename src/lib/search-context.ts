/**
 * Optional live web search, injected as tagged background context before
 * the LLM call — not a tool the model calls itself. Deliberately a fixed,
 * code-driven step (derive a query from the excerpt's own extracted
 * facts, fetch once, hand the results to the model as clearly-external
 * material) rather than agentic tool-use: this project runs on small,
 * cheap open-weight models (docs/DP.md §7) whose tool-call compliance is
 * already documented as inconsistent (F19/F28 commit history) — a fixed
 * pre-fetch step works regardless of whether the model would have called
 * a search tool correctly.
 *
 * User (2026-09-23): "所有分析都是建立在丰富的上下文基础上的" (all real
 * analysis rests on rich context) — a single decontextualized excerpt
 * can't be meaningfully analyzed without knowing the program/series it
 * belongs to, recent related events, or background facts a general reader
 * would already have. See docs/DP-V2.md for the fuller rationale.
 *
 * Optional dependency, same contract as LLM_API_KEY/CURSOR_API_KEY:
 * unconfigured or a failed call never blocks brief generation, it just
 * means no search context this round (fail-open, like Jev/LLM fallback).
 */
import type { FactSet } from "./facts.js";

export type SearchHit = { title: string; url: string; snippet: string };

function searchApiKey(): string | undefined {
  return process.env.TAVILY_API_KEY || process.env.SEARCH_API_KEY;
}

export function searchConfigured(): boolean {
  return Boolean(searchApiKey());
}

/**
 * Derive a short query from the excerpt's own extracted facts (named actor
 * + subject + instrument, whichever are present) — cheap, regex-based, no
 * LLM call. Falls back to the excerpt's first ~40 characters if nothing
 * was extracted, so a query is always produced for any adopted excerpt.
 */
export function buildSearchQuery(sourceText: string, facts: FactSet): string {
  const parts = [facts.actor[0]?.value_zh, facts.subject[0]?.value_zh, facts.instrument[0]?.value_zh]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  if (parts.length) return parts.join(" ");
  return (sourceText || "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/**
 * One Tavily search call. Returns null on any failure or when
 * unconfigured — callers must treat this as "no context available", never
 * as an error worth surfacing to the reader.
 */
export async function fetchSearchContext(query: string, maxResults = 5): Promise<SearchHit[] | null> {
  const key = searchApiKey();
  if (!key || !query.trim()) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    const hits = (data.results || [])
      .filter((r) => r.title && r.url)
      .map((r) => ({ title: r.title!, url: r.url!, snippet: (r.content || "").slice(0, 400) }));
    return hits.length ? hits : null;
  } catch {
    return null;
  }
}

/**
 * Renders search hits as a prompt block the model can quote from as
 * `background` context — explicitly marked as external/unverified-by-us,
 * mirroring how the rest of this project's honesty rules already require
 * (docs/ETHICS.md item 7: context is background/hypothesis, never
 * presented as an already-confirmed fact).
 */
export function formatSearchContextBlock(query: string, hits: SearchHit[]): string {
  const rows = hits
    .map((h, i) => `${i + 1}. ${h.title} — ${h.snippet} (${h.url})`)
    .join("\n");
  return [
    `### External search context (query: "${query}")`,
    "These are live web search results, not part of the pasted source and not verified by this pipeline.",
    "Use them only for background_notes with tag \"background\", each citing its URL. Never treat an unsourced",
    "number or claim from these snippets as adopted fact, and never let them override or contradict the pasted",
    "source text — they supplement context, they do not replace grounding in the paste.",
    rows,
  ].join("\n");
}
