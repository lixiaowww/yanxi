/**
 * Temporal / freshness layer for civilian briefs.
 *
 * Separates three clocks the reader needs:
 * - source_as_of: when the *excerpt* claims the event/statement happened (if any)
 * - collected_at: when Yanxi fetched/received it (collect path)
 * - briefed_at: when this briefing run ran
 *
 * Freshness is a reading aid against briefed_at, not a claim that the
 * underlying policy is live. Relative cues (近日) stay weak / unknown-leaning.
 */

export type TemporalPrecision = "day" | "month" | "year" | "relative" | "none";

export type FreshnessBand = "fresh" | "recent" | "aging" | "stale" | "weak" | "unknown";

export type TemporalCut = {
  framing: "civilian-temporal-freshness";
  briefed_at: string;
  collected_at?: string;
  source_as_of?: string;
  source_as_of_precision: TemporalPrecision;
  source_as_of_evidence?: string;
  /** How source_as_of was obtained. */
  source_as_of_method: "absolute_date" | "wire_dateline" | "relative_cue" | "provided" | "none";
  freshness: {
    band: FreshnessBand;
    label_en: string;
    age_days?: number;
    basis_en: string;
  };
  /** Forward policy deadlines already extracted elsewhere — echoed for the reader. */
  forward_deadlines_en: string[];
  tag: "hypothesis";
};

const RELATIVE_CUES: { zh: string; en: string; assumeDays: number | null }[] = [
  { zh: "今日", en: "today", assumeDays: 0 },
  { zh: "昨天", en: "yesterday", assumeDays: 1 },
  { zh: "昨日", en: "yesterday", assumeDays: 1 },
  { zh: "日前", en: "a few days ago", assumeDays: 3 },
  { zh: "近日", en: "recently (days)", assumeDays: 5 },
  { zh: "近期", en: "recently (weeks)", assumeDays: 14 },
  { zh: "最近", en: "recently", assumeDays: 10 },
  { zh: "本周", en: "this week", assumeDays: 3 },
  { zh: "本月", en: "this month", assumeDays: 15 },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIsoDate(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseAbsoluteDates(text: string): { iso: string; precision: TemporalPrecision; evidence: string }[] {
  const out: { iso: string; precision: TemporalPrecision; evidence: string }[] = [];
  const seen = new Set<string>();

  const ymd = /((?:19|20)\d{2})\s*年\s*(1[0-2]|0?[1-9])\s*月\s*(3[01]|[12]?\d)\s*日/g;
  let m: RegExpExecArray | null;
  while ((m = ymd.exec(text))) {
    const iso = toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (!iso || seen.has(iso)) continue;
    seen.add(iso);
    out.push({ iso, precision: "day", evidence: m[0] });
  }

  const ym = /((?:19|20)\d{2})\s*年\s*(1[0-2]|0?[1-9])\s*月(?!\s*(?:3[01]|[12]?\d)\s*日)/g;
  while ((m = ym.exec(text))) {
    const iso = toIsoDate(Number(m[1]), Number(m[2]), 1);
    if (!iso || seen.has(iso.slice(0, 7))) continue;
    seen.add(iso.slice(0, 7));
    out.push({ iso, precision: "month", evidence: m[0] });
  }

  // ISO / slash forms occasionally pasted with Mandarin.
  const isoRx = /\b((?:19|20)\d{2})-([01]?\d)-([0-3]?\d)\b/g;
  while ((m = isoRx.exec(text))) {
    const iso = toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (!iso || seen.has(iso)) continue;
    seen.add(iso);
    out.push({ iso, precision: "day", evidence: m[0] });
  }

  return out;
}

/** Prefer dateline-like hits near the start of the paste. */
function pickSourceAsOf(
  text: string,
  provided?: string
): {
  iso?: string;
  precision: TemporalPrecision;
  evidence?: string;
  method: TemporalCut["source_as_of_method"];
  assumeDays?: number;
} {
  if (provided) {
    const d = provided.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { iso: d, precision: "day", evidence: provided, method: "provided" };
    }
  }

  const abs = parseAbsoluteDates(text);
  if (abs.length) {
    // Earliest absolute date in the first 120 chars wins as dateline; else first hit.
    const head = text.slice(0, 120);
    const inHead = abs.find((a) => head.includes(a.evidence));
    const pick = inHead || abs[0];
    return {
      iso: pick.iso,
      precision: pick.precision,
      evidence: pick.evidence,
      method: /电|讯|报道|记者/.test(text.slice(Math.max(0, text.indexOf(pick.evidence) - 12), text.indexOf(pick.evidence) + pick.evidence.length + 8))
        ? "wire_dateline"
        : "absolute_date",
    };
  }

  for (const cue of RELATIVE_CUES) {
    const i = text.indexOf(cue.zh);
    if (i >= 0 && i < 160) {
      return {
        precision: "relative",
        evidence: cue.zh,
        method: "relative_cue",
        assumeDays: cue.assumeDays ?? undefined,
      };
    }
  }

  return { precision: "none", method: "none" };
}

function ageDays(asOfIso: string, briefedAt: Date): number | undefined {
  const parts = asOfIso.split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const asOf = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const brief = Date.UTC(briefedAt.getUTCFullYear(), briefedAt.getUTCMonth(), briefedAt.getUTCDate());
  return Math.floor((brief - asOf) / 86_400_000);
}

function bandFromAge(days: number | undefined, precision: TemporalPrecision): {
  band: FreshnessBand;
  label_en: string;
  basis_en: string;
  age_days?: number;
} {
  if (precision === "none" || days === undefined) {
    return {
      band: "unknown",
      label_en: "Freshness unknown",
      basis_en:
        "No dated dateline in the paste (and no collected/source date provided) — do not infer how current the excerpt is.",
    };
  }
  if (precision === "relative") {
    return {
      band: "weak",
      label_en: "Freshness weak (relative cue only)",
      basis_en: `Only a relative time cue was found; treated as weak, not fully unknown — it still rules out "no idea when this is from". Assumed offset ≈${days} day(s) for ordering only — not a verified publication date.`,
      age_days: days,
    };
  }
  if (days < 0) {
    return {
      band: "fresh",
      label_en: "Source date after brief time",
      basis_en: "The source date is after this briefing's draft time (clock skew or future-dated text) — verify the dateline.",
      age_days: days,
    };
  }
  if (days <= 7) {
    return {
      band: "fresh",
      label_en: "Fresh (≤7 days)",
      basis_en: `The source date is ${days} day(s) before this briefing was drafted.`,
      age_days: days,
    };
  }
  if (days <= 30) {
    return {
      band: "recent",
      label_en: "Recent (≤30 days)",
      basis_en: `The source date is ${days} day(s) before this briefing was drafted.`,
      age_days: days,
    };
  }
  if (days <= 90) {
    return {
      band: "aging",
      label_en: "Aging (≤90 days)",
      basis_en: `The source date is ${days} day(s) before this briefing was drafted — re-check whether a newer public text supersedes this excerpt.`,
      age_days: days,
    };
  }
  return {
    band: "stale",
    label_en: "Stale (>90 days)",
    basis_en: `The source date is ${days} day(s) before this briefing was drafted — treat as historical context unless a newer source is pasted.`,
    age_days: days,
  };
}

export type TemporalInput = {
  text: string;
  /** ISO timestamp when the briefing runs (defaults to now). */
  briefedAt?: string | Date;
  /** Collect / paste receive time if known. */
  collectedAt?: string;
  /** Operator-provided publication date (YYYY-MM-DD or ISO). */
  sourcePublishedAt?: string;
  /** Forward deadlines already extracted (English), for the reader strip. */
  forwardDeadlinesEn?: string[];
};

export function buildTemporalCut(input: TemporalInput): TemporalCut {
  const briefed =
    input.briefedAt instanceof Date
      ? input.briefedAt
      : input.briefedAt
        ? new Date(input.briefedAt)
        : new Date();
  const briefed_at = briefed.toISOString();

  const picked = pickSourceAsOf(input.text, input.sourcePublishedAt);
  let source_as_of = picked.iso;
  let age: number | undefined;

  if (picked.method === "relative_cue" && picked.assumeDays !== undefined) {
    const d = new Date(briefed);
    d.setUTCDate(d.getUTCDate() - picked.assumeDays);
    source_as_of = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    age = picked.assumeDays;
  } else if (source_as_of) {
    age = ageDays(source_as_of, briefed);
  }

  // Month precision: age from first of month is coarse — still useful.
  const freshness = bandFromAge(age, picked.precision);

  return {
    framing: "civilian-temporal-freshness",
    briefed_at,
    collected_at: input.collectedAt,
    source_as_of,
    source_as_of_precision: picked.precision,
    source_as_of_evidence: picked.evidence,
    source_as_of_method: picked.method,
    freshness,
    forward_deadlines_en: (input.forwardDeadlinesEn || []).slice(0, 4),
    tag: "hypothesis",
  };
}

export function temporalLineEn(t: TemporalCut): string {
  const bits = [
    `briefed ${t.briefed_at.slice(0, 19)}Z`,
    t.source_as_of
      ? `source as-of ${t.source_as_of} (${t.source_as_of_precision})`
      : "source as-of unknown",
    t.freshness.label_en,
  ];
  if (t.collected_at) bits.push(`collected ${t.collected_at.slice(0, 19)}`);
  return bits.join(" · ");
}
