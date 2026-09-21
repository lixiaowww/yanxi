/**
 * Civic Ontology Lite — curated Markdown context cards as background frames.
 * NOT a formal OWL/knowledge-graph; NOT secret knowledge; NOT an intelligence ontology.
 */

import fs from "fs";
import path from "path";
import type { DeskSectionId } from "./briefing-desk.js";
import { assignDeskSection } from "./briefing-desk.js";

export const ONTOLOGY_TYPES = [
  "institution",
  "lexicon",
  "history_frame",
  "intl_compare",
  "method",
] as const;

export type OntologyType = (typeof ONTOLOGY_TYPES)[number];

export type OntologyCard = {
  id: string;
  name: string;
  type: OntologyType;
  desk: Array<DeskSectionId | "all">;
  match: string[];
  description: string;
  tag: "background" | "hypothesis";
  updated: string;
  sources: string;
  body: string;
  file: string;
};

export type OntologyHit = {
  id: string;
  type: OntologyType;
  desk: Array<DeskSectionId | "all">;
  tag: "background" | "hypothesis";
  score: number;
  matched_keywords: string[];
  updated: string;
  sources: string;
};

export type OntologyLiteResult = {
  framing: "civilian-ontology-lite";
  desk_primary?: DeskSectionId;
  hits: OntologyHit[];
  /** Card bodies for LLM/offline composition (ordered). */
  bodies: string[];
  names: string[];
  calibration: string;
  tag: "hypothesis";
};

const SKILLS_DIR = path.join(process.cwd(), "skills", "context-cards");
const MAX_CARDS = 8;

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: raw.trim() };
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: raw.slice(m[0].length).trim() };
}

function parseMatch(s: string): string[] {
  return (String(s || "").match(/"([^"]+)"/g) || []).map((x) => x.replace(/"/g, ""));
}

function parseDesk(s: string): Array<DeskSectionId | "all"> {
  const raw = (s || "all").trim();
  if (!raw || raw === "all") return ["all"];
  const allowed = new Set<string>([
    "all",
    "hot_topics",
    "economy_investment",
    "foreign_affairs",
    "defense_public",
    "social_governance",
  ]);
  return raw
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .map((x) => (x === "overall_goals" ? "economy_investment" : x))
    .filter((x): x is DeskSectionId | "all" => allowed.has(x));
}

function parseType(s: string): OntologyType {
  const t = (s || "lexicon").trim();
  return (ONTOLOGY_TYPES as readonly string[]).includes(t) ? (t as OntologyType) : "lexicon";
}

export function loadOntologyCards(root = process.cwd()): OntologyCard[] {
  const dir = path.join(root, "skills", "context-cards");
  if (!fs.existsSync(dir)) return [];
  const out: OntologyCard[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(dir, f);
    const raw = fs.readFileSync(full, "utf8");
    const { fm, body } = parseFrontmatter(raw);
    const id = fm.name || f.replace(/\.md$/, "");
    out.push({
      id,
      name: id,
      type: parseType(fm.type),
      desk: parseDesk(fm.desk),
      match: parseMatch(fm.match),
      description: fm.description || "",
      tag: fm.tag === "hypothesis" ? "hypothesis" : "background",
      updated: fm.updated || "unknown",
      sources: fm.sources || "Public open-source conventions (unspecified)",
      body,
      file: `skills/context-cards/${f}`,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function deskAffinity(card: OntologyCard, desk?: DeskSectionId): number {
  if (!desk) return 0;
  if (card.desk.includes("all")) return 0.35;
  if (card.desk.includes(desk)) return 1;
  return 0;
}

/**
 * Match paste → ontology cards, prefer desk-aligned, cap at MAX_CARDS.
 * Method cards that match stay near the top when relevant.
 */
export function matchOntologyLite(
  sourceText: string,
  opts?: { deskPrimary?: DeskSectionId; maxCards?: number; root?: string }
): OntologyLiteResult {
  const text = sourceText || "";
  const desk =
    opts?.deskPrimary ||
    (text.length >= 20 ? assignDeskSection(text).primary : undefined);
  const max = opts?.maxCards ?? MAX_CARDS;
  const cards = loadOntologyCards(opts?.root);

  type Scored = { card: OntologyCard; score: number; matched: string[] };
  const scored: Scored[] = [];

  for (const card of cards) {
    const matched = card.match.filter((k) => k && text.includes(k));
    if (!matched.length) continue;
    let score = matched.length * 0.4 + deskAffinity(card, desk);
    if (card.type === "method") score += 0.5;
    if (card.type === "institution") score += 0.15;
    if (card.type === "history_frame") score += 0.1;
    if (card.type === "intl_compare") score += 0.1;
    scored.push({ card, score, matched });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, max);

  const hits: OntologyHit[] = top.map((s) => ({
    id: s.card.id,
    type: s.card.type,
    desk: s.card.desk,
    tag: s.card.tag,
    score: Number(s.score.toFixed(3)),
    matched_keywords: s.matched.slice(0, 6),
    updated: s.card.updated,
    sources: s.card.sources,
  }));

  return {
    framing: "civilian-ontology-lite",
    desk_primary: desk,
    hits,
    bodies: top.map((s) => {
      const meta = `[ontology-lite type=${s.card.type} desk=${s.card.desk.join("|")} tag=${s.card.tag} updated=${s.card.updated}]`;
      return `${meta}\n${s.card.body}`;
    }),
    names: top.map((s) => s.card.id),
    calibration: `Matched ${scored.length} cards, kept ${top.length} (desk=${desk || "n/a"}). Background/hypothesis only — not a formal ontology or secret knowledge.`,
    tag: "hypothesis",
  };
}

/** Catalog for portfolio / docs. */
export function listOntologyCatalog(root = process.cwd()): Omit<OntologyCard, "body">[] {
  return loadOntologyCards(root).map(({ body: _b, ...rest }) => rest);
}
