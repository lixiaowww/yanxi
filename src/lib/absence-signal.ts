/**
 * "Absence as signal" (docs/DP-V3.md §4, task #7) — a subject that had real
 * prior public coverage, then went quiet, then resurfaces as one terse
 * item, is a documented PRC media-control pattern: coverage is throttled
 * by omission and delay more often than by outright deletion, and a long
 * silence followed by a single unified notice usually means the story was
 * deliberately kept from developing further.
 *
 * Sources: China Media Project, "Eight Long Hours of Silence" (2023-04-21);
 * "Censorship by Omission: How China Edits Reality Before It's Written"
 * (Sunday Guardian Live); the user-supplied research doc synthesizing this
 * literature (see docs/DP-V3.md §4, "缺席即信号").
 *
 * Like every other heuristic in this codebase (media-heuristics.ts's 23
 * rules, source-tier.ts's A/B/C/D/U priors), GAP_DAYS_THRESHOLD is a
 * hand-set editorial prior, not fitted to labelled data — the PRINCIPLE is
 * externally documented, the exact cutoff is not, and is disclosed as such.
 * This does not require a large historical corpus to build: it needs the
 * collection system running going forward so gaps become observable over
 * real time, the same way every other rule here runs on whatever text it's
 * given rather than waiting for a training set.
 */
import { listOutboxBriefs, type OutboxRecord } from "./outbox.js";
import { topicKeysFromBriefing, topicKeysFromRecord } from "./related-briefs.js";
import type { BriefingJson } from "./gate.js";

/** Hand-set editorial prior — not fitted to labelled data. See module doc. */
export const GAP_DAYS_THRESHOLD = 14;

export type AbsenceSignalHit = {
  subject_label: string;
  prior_coverage_count: number;
  last_prior_at: string;
  gap_days: number;
  /** True when prior coverage existed, the gap exceeds the threshold, and this item reads thin. */
  pattern_match: boolean;
};

export type AbsenceSignal = {
  framing: "civilian-absence-as-signal";
  hits: AbsenceSignalHit[];
  note_en: string;
  tag: "hypothesis";
};

/**
 * Best-effort, never throws — same discipline as findRelatedBriefs. Returns
 * undefined when there are no recognizable subjects or no prior coverage to
 * compare against (a genuinely new subject isn't "absence", it's just new).
 */
export function detectAbsenceSignal(opts: {
  briefing: BriefingJson;
  sourceText: string;
  substanceBand?: string;
  now?: Date;
  excludeId?: string;
  root?: string;
}): AbsenceSignal | undefined {
  try {
    const mySubjects = topicKeysFromBriefing(opts.briefing, opts.sourceText).filter((k) =>
      k.startsWith("subj:")
    );
    if (!mySubjects.length) return undefined;

    const rows: OutboxRecord[] = listOutboxBriefs(undefined, opts.root);
    if (!rows.length) return undefined;
    const now = opts.now || new Date();
    const hits: AbsenceSignalHit[] = [];

    for (const key of mySubjects) {
      const label = key.slice("subj:".length);
      const priors = rows.filter((r) => {
        if (opts.excludeId && r.id === opts.excludeId) return false;
        return topicKeysFromRecord(r).includes(key);
      });
      if (!priors.length) continue; // no prior coverage — this is new, not absent.

      const lastPriorMs = Math.max(...priors.map((r) => new Date(r.createdAt).getTime()));
      const gap_days = Math.max(0, Math.floor((now.getTime() - lastPriorMs) / 86_400_000));
      const pattern_match = gap_days > GAP_DAYS_THRESHOLD && opts.substanceBand === "thin";

      hits.push({
        subject_label: label,
        prior_coverage_count: priors.length,
        last_prior_at: new Date(lastPriorMs).toISOString(),
        gap_days,
        pattern_match,
      });
    }

    if (!hits.length) return undefined;

    const flagged = hits.filter((h) => h.pattern_match);
    return {
      framing: "civilian-absence-as-signal",
      hits: hits.slice(0, 5),
      note_en: flagged.length
        ? `${flagged.map((h) => h.subject_label).join(", ")} had prior public coverage (${flagged
            .map((h) => h.prior_coverage_count)
            .join("/")} prior item(s)), then a ${flagged
            .map((h) => h.gap_days)
            .join("/")}-day gap, and this item reads thin — matches the documented "coverage → silence → terse notice" pattern. Gap threshold (${GAP_DAYS_THRESHOLD}d) is a hand-set prior, not calibrated; treat the match as a prompt to look for what was omitted, not as proof anything was suppressed.`
        : `Prior coverage found for ${hits.length} subject(s) in this excerpt, but no gap exceeds the ${GAP_DAYS_THRESHOLD}-day threshold or this item is not thin — no absence pattern flagged.`,
      tag: "hypothesis",
    };
  } catch {
    return undefined;
  }
}
