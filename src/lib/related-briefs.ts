/**
 * Soft links between outbox briefs that share named subjects / desk / hot themes.
 * This is discovery for a human merge-rerun — it does NOT raise corroboration
 * scores. Only a fresh pipeline run with sources[] can claim cross-check.
 */
import type { BriefingJson } from "./gate.js";
import { listOutboxBriefs, type OutboxRecord } from "./outbox.js";
import { subjectHitsInText } from "./confidence.js";
import { corroborationBand } from "./score-bands.js";

export type RelatedBriefHit = {
  framing: "civilian-related-brief-discovery";
  id: string;
  label: string;
  createdAt: string;
  jsonFile: string;
  shared_keys: string[];
  desk?: string;
  what_preview?: string;
  corroboration_band?: string;
  canada_nexus?: string;
  note_en: string;
  tag: "hypothesis";
};

/** Topic keys used only for soft matching — not proof of agreement. */
export function topicKeysFromBriefing(b: BriefingJson, sourceText?: string): string[] {
  const keys = new Set<string>();
  if (b.desk_section?.primary) keys.add(`desk:${b.desk_section.primary}`);
  for (const h of b.desk_section?.hot_themes || []) {
    if (h.id) keys.add(`hot:${h.id}`);
  }
  if (b.info_triage?.primary_kind) keys.add(`kind:${b.info_triage.primary_kind}`);
  for (const s of b.corroboration?.shared_subjects || []) keys.add(`subj:${s}`);
  for (const n of b.substance_cut?.nuggets || []) {
    if (
      (n.kind === "named_sector_or_place" || n.kind === "named_instrument") &&
      (n.value_en || n.label_zh)
    ) {
      keys.add(`nugget:${(n.value_en || n.label_zh || "").toLowerCase()}`);
    }
  }
  if (sourceText) {
    for (const s of subjectHitsInText(sourceText)) keys.add(`subj:${s}`);
  }
  return [...keys];
}

export function topicKeysFromRecord(rec: OutboxRecord): string[] {
  const text = rec.source?.sourceText || "";
  return topicKeysFromBriefing(rec.result?.briefing || {}, text);
}

function overlap(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((k) => setB.has(k) && !k.startsWith("desk:")); // desk alone is too weak
}

export function findRelatedBriefs(opts: {
  briefing: BriefingJson;
  sourceText: string;
  excludeId?: string;
  root?: string;
  limit?: number;
}): RelatedBriefHit[] {
  const mine = topicKeysFromBriefing(opts.briefing, opts.sourceText);
  if (!mine.length) return [];

  const rows = listOutboxBriefs(undefined, opts.root);
  const scored: { hit: RelatedBriefHit; score: number }[] = [];

  for (const rec of rows) {
    if (opts.excludeId && rec.id === opts.excludeId) continue;
    const theirs = topicKeysFromRecord(rec);
    const shared = overlap(mine, theirs);
    // Require at least one concrete subject/hot/nugget key, or desk+kind together.
    const concrete = shared.filter(
      (k) => k.startsWith("subj:") || k.startsWith("hot:") || k.startsWith("nugget:")
    );
    const deskMine = mine.find((k) => k.startsWith("desk:"));
    const kindMine = mine.find((k) => k.startsWith("kind:"));
    const soft = Boolean(
      deskMine && kindMine && theirs.includes(deskMine) && theirs.includes(kindMine)
    );
    if (!concrete.length && !soft) continue;

    const keys = (concrete.length ? concrete : [deskMine!, kindMine!]).filter(Boolean).slice(0, 6);
    // Canada relevance is a core ranking parameter here, not a tie-breaker:
    // a same-topic candidate that also names/plausibly implicates Canada is
    // worth surfacing over an equally-matched one that doesn't, since it's
    // the more likely "load as second source" pick for a Canada-focused
    // reader. Sized to actually move the ranking (concrete match = 2).
    const nexusLevel = rec.result?.briefing?.canada_nexus?.level;
    const nexusBonus = nexusLevel === "direct" ? 3 : nexusLevel === "possible" ? 1 : 0;
    const score = concrete.length * 2 + (soft ? 1 : 0) + nexusBonus;
    scored.push({
      score,
      hit: {
        framing: "civilian-related-brief-discovery",
        id: rec.id,
        label: rec.source?.label || rec.subscriptionTitle,
        createdAt: rec.createdAt,
        jsonFile: rec.jsonPath ? rec.jsonPath.split(/[/\\]/).pop() || `${rec.id}.json` : `${rec.id}.json`,
        shared_keys: keys.slice(0, 6),
        desk: rec.result?.briefing?.desk_section?.label_en || rec.result?.briefing?.desk_section?.label_zh,
        what_preview: (rec.result?.briefing?.briefing_en?.what || "").slice(0, 160),
        corroboration_band: corroborationBand(rec.result?.briefing?.corroboration?.score_0_to_3 ?? 0),
        canada_nexus: nexusLevel,
        note_en:
          "Same-topic candidate in the outbox — not independent corroboration until you merge the excerpts and re-run.",
        tag: "hypothesis",
      },
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || b.hit.createdAt.localeCompare(a.hit.createdAt))
    .slice(0, opts.limit ?? 6)
    .map((s) => s.hit);
}
