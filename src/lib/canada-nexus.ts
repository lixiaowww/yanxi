/**
 * Civilian reader-interest flag for Canada nexus in public Mandarin sources.
 * NOT personal targeting, NOT surveillance of Canadians — a portfolio/research
 * highlight for analysts who care about Canada-relevant public China discourse.
 */

export const CANADA_NEXUS_LEVELS = ["none", "possible", "direct"] as const;
export type CanadaNexusLevel = (typeof CANADA_NEXUS_LEVELS)[number];

export type CanadaNexusHit = {
  level: "direct" | "possible";
  evidence: string;
  cue: string;
};

export type CanadaNexus = {
  framing: "civilian-reader-interest-flag";
  level: CanadaNexusLevel;
  label_zh: string;
  label_en: string;
  hits: CanadaNexusHit[];
  rationale: string;
  tag: "hypothesis";
};

/** Explicit Canada / Canada–China naming in the paste. */
const DIRECT: { cue: string; rx: RegExp }[] = [
  { cue: "加拿大", rx: /加拿大/ },
  { cue: "加方", rx: /加方/ },
  { cue: "加中|中加", rx: /加中|中加/ },
  { cue: "渥太华", rx: /渥太华/ },
  { cue: "多伦多", rx: /多伦多/ },
  { cue: "温哥华", rx: /温哥华/ },
  { cue: "Canada", rx: /\bCanada\b/i },
  { cue: "Canadian", rx: /\bCanadian\b/i },
  { cue: "Ottawa", rx: /\bOttawa\b/i },
  { cue: "CUSMA|USMCA", rx: /\bCUSMA\b|\bUSMCA\b|美墨加协定|美加墨/ },
];

/**
 * Topic cues that often intersect Canadian public interest but do not name Canada.
 * Marked "possible" only — never claim a Canada link without a direct hit.
 */
const POSSIBLE: { cue: string; rx: RegExp }[] = [
  { cue: "北极/Arctic", rx: /北极|Arctic/i },
  { cue: "关键矿产", rx: /关键矿产|稀土|锂矿|镍矿|critical\s+minerals/i },
  { cue: "菜籽/canola", rx: /菜籽|油菜籽|canola/i },
  { cue: "软木/softwood", rx: /软木|木材出口|softwood/i },
  { cue: "CPTPP", rx: /CPTPP|全面与进步跨太平洋|跨太平洋伙伴/ },
  { cue: "G7", rx: /\bG7\b|七国集团/ },
  { cue: "北美", rx: /北美(?!洲板块)/ },
];

function evidenceAround(text: string, rx: RegExp): string {
  const m = text.match(rx);
  if (!m || m.index == null) return m?.[0] || "";
  const start = Math.max(0, m.index - 12);
  const end = Math.min(text.length, m.index + m[0].length + 12);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function buildCanadaNexus(sourceText: string): CanadaNexus {
  const text = sourceText || "";
  const hits: CanadaNexusHit[] = [];

  for (const row of DIRECT) {
    if (row.rx.test(text)) {
      hits.push({ level: "direct", cue: row.cue, evidence: evidenceAround(text, row.rx) });
    }
  }
  for (const row of POSSIBLE) {
    if (row.rx.test(text)) {
      hits.push({ level: "possible", cue: row.cue, evidence: evidenceAround(text, row.rx) });
    }
  }

  const hasDirect = hits.some((h) => h.level === "direct");
  const hasPossible = hits.some((h) => h.level === "possible");
  const level: CanadaNexusLevel = hasDirect ? "direct" : hasPossible ? "possible" : "none";

  const label_zh =
    level === "direct"
      ? "Canada nexus — named in source"
      : level === "possible"
        ? "Canada nexus — possible topic adjacency"
        : "No Canada nexus cue";

  const label_en =
    level === "direct"
      ? "Canada nexus — named in source"
      : level === "possible"
        ? "Canada nexus — possible topic adjacency"
        : "No Canada nexus cue";

  const rationale =
    level === "none"
      ? "No Canada-name or adjacency cue in the paste. Reader-interest flag only — not personal targeting."
      : hasDirect
        ? `Direct Canada naming in public text (${hits.filter((h) => h.level === "direct").map((h) => h.cue).join(", ")}). Highlight for human review; not a targeting flag.`
        : `Topic adjacency only (${hits.map((h) => h.cue).join(", ")}); Canada not named. Treat as hypothesis until a direct public source appears.`;

  return {
    framing: "civilian-reader-interest-flag",
    level,
    label_zh,
    label_en,
    hits: hits.slice(0, 8),
    rationale,
    tag: "hypothesis",
  };
}

/** Small research-priority bump when Canada is explicitly named (civilian reader interest). */
export function canadaNexusImportanceBump(nexus: CanadaNexus): number {
  if (nexus.level === "direct") return 0.1;
  if (nexus.level === "possible") return 0.03;
  return 0;
}
