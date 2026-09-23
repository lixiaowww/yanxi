/**
 * Jev (TypeSafe System One) fast-triage gate — docs/DP-V3.md §7 task #5,
 * revised 2026-09-22 to also screen out party-boilerplate-without-detail
 * (see docs/DP-V3.md §7 open question #1, revision note).
 *
 * Purpose: a cheap, fast (70-500ms), schema-constrained first-pass filter
 * for a scheduled-collection volume that's too large to run the full
 * analysis pipeline (offline heuristics + optional LLM call) on every
 * fetched document. This gate answers "is this worth the expensive path at
 * all, how urgently, and does it actually say anything" — nothing else.
 *
 * Deliberately narrow scope (docs/DP-V3.md §7 open question #1):
 * - Does NOT do desk classification — assignDeskSection (src/lib/briefing-desk.ts)
 *   already does that deterministically; duplicating it in Jev risks the two
 *   disagreeing with no clear authority.
 * - Does NOT redo extractFacts' (src/lib/facts.ts) structured nugget
 *   extraction — that stays a free regex job downstream in the full
 *   pipeline. `has_concrete_detail` here is a coarser, cheaper yes/no
 *   screen (党八股/boilerplate vs. has-any-checkable-detail) meant to run
 *   at aggregate-many-sources volume, before extractFacts ever sees the
 *   text — revised in from the original narrowing once real multi-source
 *   collection made "drop the boilerplate before it clutters the feed"
 *   the actual bottleneck, not "duplicate a free regex".
 * - Not wired into the main pipeline yet (that's task #6, the collect→Jev→
 *   pipeline glue). This module is a standalone, independently testable
 *   function.
 *
 * Same soft-fail contract as src/lib/jev.ts: returns null on any failure or
 * when unconfigured — caller falls back to admitting everything to the full
 * pipeline (i.e. today's behavior), never silently drops a document because
 * a paid classifier hiccuped.
 */
import { jevBaseUrl, jevConfigured, jevModel, type JevChoiceAnswer, type JevResponse } from "./jev.js";

export type JevGateResult = {
  in_scope: boolean;
  language_quality: "clean" | "garbled" | "non_chinese";
  priority_hint: "P1" | "P2" | "P3" | "P4";
  /** false = pure party-boilerplate/formulaic restatement with no checkable detail. */
  has_concrete_detail: boolean;
  model: string;
  /** Per-question Jev confidence (0-1), when returned. */
  confidence?: {
    in_scope?: number;
    language_quality?: number;
    priority_hint?: number;
    has_concrete_detail?: number;
  };
};

const IN_SCOPE_CRITERIA = {
  yes: "The text discusses PRC government policy, party/state governance, the economy, foreign affairs, defense (public discourse), or social governance.",
  no: "The text is unrelated noise — sports scores, entertainment, product ads, scraping artifacts, or any topic outside PRC policy/governance/economy/foreign-affairs/defense/social-governance.",
};

const LANGUAGE_QUALITY_CRITERIA = {
  clean: "Readable, well-formed Mandarin prose.",
  garbled: "Mostly Mandarin but corrupted by scraping — broken encoding, stripped punctuation, HTML/JS fragments mixed in, or heavily truncated mid-sentence.",
  non_chinese: "Not meaningfully in Mandarin — wrong language, or almost entirely non-text content.",
};

const PRIORITY_CRITERIA = {
  P1: "Names a specific instrument, funding amount, deadline, or quantified target — immediately actionable for a full brief.",
  P2: "Names a responsible body and a concrete-sounding measure, but missing one of instrument/funding/deadline.",
  P3: "Direction/meeting language on an in-scope subject with no named instrument yet — background/watch-queue value only.",
  P4: "In-scope but thin even for watch-queue purposes — boilerplate restatement with nothing new.",
};

const CONCRETE_DETAIL_CRITERIA = {
  yes: "Contains at least one checkable detail: a named policy instrument, a number/amount/date/deadline, a named responsible body taking a specific action, or a specific event with a concrete who/what/when. One such detail is enough.",
  no: "Pure formulaic political language (党八股) with no new checkable detail — slogans, restated general principles, ceremonial language, or a meeting notice that only says a meeting happened without naming any instrument, figure, amount, or date.",
};

/**
 * Ask Jev to gate one fetched document before it enters the full pipeline.
 * Returns null on any failure or when Jev isn't configured — caller must
 * treat that as "admit to full pipeline", the same fail-open behavior as
 * jevIntakeChoice.
 */
export async function jevGateCheck(input: {
  text: string;
  label?: string;
  sourceUrl?: string;
}): Promise<JevGateResult | null> {
  if (!jevConfigured()) return null;

  const key = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY || "";
  const body = {
    model: jevModel(),
    state: {
      task: "civilian_collect_fast_triage",
      note: "Fast pre-filter before the full civilian research pipeline runs. Only gates whether/how urgently to analyze — never writes briefing prose, never makes the admit/defer/reject call itself (that's a separate, deterministic step). Not an intelligence product.",
      label: input.label || "",
      source_url: input.sourceUrl || "",
      excerpt: input.text.slice(0, 4000),
    },
    questions: {
      in_scope: {
        type: "choice",
        instructions: "Is this text in-scope for a civilian PRC-policy research desk at all?",
        criteria: IN_SCOPE_CRITERIA,
      },
      language_quality: {
        type: "choice",
        instructions: "Rate the text's language quality for downstream Mandarin analysis.",
        criteria: LANGUAGE_QUALITY_CRITERIA,
      },
      priority_hint: {
        type: "choice",
        instructions: "Rough research-priority triage — a fast guess, not the final call (the full pipeline's deterministic intake logic decides that).",
        criteria: PRIORITY_CRITERIA,
      },
      has_concrete_detail: {
        type: "choice",
        instructions: "Does this text contain any concrete, checkable detail, or is it pure formulaic political boilerplate (党八股) restating general principles with nothing new?",
        criteria: CONCRETE_DETAIL_CRITERIA,
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
    if (!res.ok) return null;
    const json = (await res.json()) as JevResponse;

    const inScopeAns = json.answers?.in_scope as JevChoiceAnswer | undefined;
    const langAns = json.answers?.language_quality as JevChoiceAnswer | undefined;
    const prioAns = json.answers?.priority_hint as JevChoiceAnswer | undefined;
    const detailAns = json.answers?.has_concrete_detail as JevChoiceAnswer | undefined;

    const in_scope = inScopeAns?.choice === "yes";
    const language_quality = langAns?.choice;
    const priority_hint = prioAns?.choice;
    const has_concrete_detail = detailAns?.choice === "yes";

    if (
      inScopeAns?.choice !== "yes" && inScopeAns?.choice !== "no"
    ) return null;
    if (language_quality !== "clean" && language_quality !== "garbled" && language_quality !== "non_chinese") {
      return null;
    }
    if (!["P1", "P2", "P3", "P4"].includes(priority_hint || "")) return null;
    if (detailAns?.choice !== "yes" && detailAns?.choice !== "no") return null;

    return {
      in_scope,
      language_quality,
      priority_hint: priority_hint as JevGateResult["priority_hint"],
      has_concrete_detail,
      model: json.model || jevModel(),
      confidence: {
        in_scope: inScopeAns?.confidence,
        language_quality: langAns?.confidence,
        priority_hint: prioAns?.confidence,
        has_concrete_detail: detailAns?.confidence,
      },
    };
  } catch {
    return null;
  }
}
