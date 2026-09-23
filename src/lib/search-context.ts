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
 * Wire-service boilerplate that carries zero search value (dateline +
 * reporter byline) — stripped before building a query so it doesn't
 * crowd out the actual named entities in a short query string.
 */
const DATELINE_RX = /(中新社|中新网)[^\d(（]{0,10}\d{1,2}月\d{1,2}日电\s*/g;
const BYLINE_RX = /[(（]\s*记者[^)）]*[)）]/g;

/** True for named institutions broad enough that alone they're a useless query (matches any story mentioning that body, not this one). */
const GENERIC_BODY_RX = /^(国务院|中共中央|全国人大|全国政协|外交部|国防部)$/;

/**
 * Derive a search query from the excerpt. Tavily (and search engines
 * generally) handle natural-language queries well, so prefer a cleaned
 * slice of the excerpt's own text — which keeps person names, foreign
 * counterparts, event/program names, place names, all the things that
 * actually distinguish this excerpt from any other — over the narrow
 * FactSet extraction (actor/subject/instrument), which was built for
 * policy-instrument text and often only catches a bare, overly generic
 * institution name (e.g. "国务院") for personnel/diplomatic/launch
 * content, producing a query that returns nothing useful. Verified
 * empirically 2026-09-23: "国务院" alone returned a Wikipedia definition
 * of what the State Council is; the excerpt's own text returned five
 * directly relevant hits including the event's own official site.
 */
export function buildSearchQuery(sourceText: string, facts: FactSet): string {
  const cleaned = (sourceText || "")
    .replace(DATELINE_RX, " ")
    .replace(BYLINE_RX, " ")
    .replace(/\s+/g, " ")
    .trim();
  const slice = cleaned.slice(0, 80);

  // A specific (non-generic) instrument name adds real signal the text
  // slice might not lead with — append it when present and not already
  // captured in the slice.
  const instrument = facts.instrument[0]?.value_zh;
  if (instrument && !slice.includes(instrument)) return `${slice} ${instrument}`.trim();

  if (slice) return slice;

  // Last resort: only the narrow FactSet extraction found anything, and
  // the raw text was somehow empty — better than an empty query, but
  // skip bare generic bodies that would return nothing useful on their own.
  const parts = [facts.actor[0]?.value_zh, facts.subject[0]?.value_zh, facts.instrument[0]?.value_zh]
    .filter((v): v is string => Boolean(v) && !GENERIC_BODY_RX.test(v!))
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return parts.join(" ");
}

/**
 * Category-specific third angle, derived from the already-computed
 * substance nuggets (src/lib/substance.ts) — cheap, no extra extraction
 * needed, these are computed before the LLM call anyway for the intake
 * gate. Returns null when nothing category-specific applies, in which
 * case callers just run the two fixed angles (background + critical).
 */
function categoryQuerySuffix(nuggets: { kind: string; evidence: string }[]): string | null {
  const evidenceMatches = (rx: RegExp) => nuggets.some((n) => rx.test(n.evidence));
  const hasKind = (k: string) => nuggets.some((n) => n.kind === k);
  if (evidenceMatches(/发射|竣工|投产|下水|首飞|启用/)) return "历次 频率 发射间隔";
  if (evidenceMatches(/会见|会晤|正式访问/)) return "历年 同类 回应 对比";
  if (hasKind("named_instrument")) return "配套办法 实施细则 后续进展";
  if (hasKind("numeric_target") || evidenceMatches(/收入|GDP|增长|同比|人均/)) return "CPI 通胀 居民消费价格指数";
  return null;
}

/**
 * Three fixed angles (2026-09-23, user-agreed compromise: fixed queries
 * over a fully adaptive multi-round search loop — cost-predictable, no
 * reliance on the model deciding what to search next):
 *  1. background — the excerpt's own text, what this belongs to/precedent
 *  2. critical    — user: "刨去宣传夸大的内容" (strip the hype), what
 *     problems/limitations/comparisons does this face
 *  3. category    — a kind-specific follow-up angle when one applies
 * Deduplicated; at most 3 queries.
 */
export function buildSearchQueries(
  sourceText: string,
  facts: FactSet,
  nuggets: { kind: string; evidence: string }[] = []
): string[] {
  const background = buildSearchQuery(sourceText, facts);
  if (!background) return [];
  const queries = [background, `${background} 问题 局限性 批评 对比`];
  const category = categoryQuerySuffix(nuggets);
  if (category) queries.push(`${background} ${category}`);
  return [...new Set(queries)];
}

/**
 * Runs buildSearchQueries()'s angles in parallel and combines the hits
 * into one prompt block, deduplicated by URL (the same page often turns
 * up for more than one angle). Fails open per-angle: one angle failing
 * doesn't drop the others.
 */
export async function fetchMultiAngleSearchContext(
  sourceText: string,
  facts: FactSet,
  nuggets: { kind: string; evidence: string }[] = []
): Promise<string | undefined> {
  const queries = buildSearchQueries(sourceText, facts, nuggets);
  if (!queries.length) return undefined;
  const results = await Promise.all(queries.map((q) => fetchSearchContext(q)));
  const seen = new Set<string>();
  const blocks: string[] = [];
  results.forEach((hits, i) => {
    if (!hits) return;
    const fresh = hits.filter((h) => !seen.has(h.url));
    fresh.forEach((h) => seen.add(h.url));
    if (fresh.length) blocks.push(formatSearchContextBlock(queries[i], fresh));
  });
  return blocks.length ? blocks.join("\n\n") : undefined;
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
