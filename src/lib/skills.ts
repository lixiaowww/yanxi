// GrantWright-style skill loader: markdown instruction units composed at runtime.
import fs from "fs";
import path from "path";
import { matchOntologyLite, type OntologyLiteResult } from "./ontology-lite.js";

const SKILLS_DIR = path.join(process.cwd(), "skills");

function readBody(file: string): string {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const fm = raw.match(/^---\n[\s\S]*?\n---\n?/);
    return (fm ? raw.slice(fm[0].length) : raw).trim();
  } catch {
    return "";
  }
}

/** @deprecated prefer matchOntologyLite — kept for simple name/body lists */
export function detectContextCards(sourceText: string): {
  names: string[];
  bodies: string[];
  ontology?: OntologyLiteResult;
} {
  const ontology = matchOntologyLite(sourceText);
  return { names: ontology.names, bodies: ontology.bodies, ontology };
}

export function composeBriefingSystemPrompt(sourceText: string): {
  prompt: string;
  matchedCards: string[];
  ontology: OntologyLiteResult;
} {
  const writer = readBody(path.join(SKILLS_DIR, "briefing-writer", "SKILL.md"));
  const ethics = readBody(path.join(SKILLS_DIR, "ethics-sandbox", "SKILL.md"));
  const ontology = matchOntologyLite(sourceText);
  const { names, bodies } = ontology;

  const catalogHint =
    ontology.hits.length > 0
      ? ontology.hits
          .map(
            (h) =>
              `- ${h.id} [${h.type}/${h.tag}] desk=${h.desk.join("|")} keys=${h.matched_keywords.join(",")}`
          )
          .join("\n")
      : "(none)";

  const outputSpec = `# Output task
Return ONLY valid JSON with this shape:
{
  "source_digest_zh": [{"point": "...", "quote": "...", "source_label": "paste-1"}],
  "context_notes": [{"card": "...", "note": "...", "tag": "background|hypothesis"}],
  "info_triage": {
    "framing": "civilian-public-source-triage",
    "kinds": [{"kind": "macro_policy|implementing_instrument|industrial_tech_policy|foreign_affairs|defense_public|social_governance|economic_data|press_commentary|leadership_meeting|local_policy|other_public_text", "label_zh": "...", "score": 0.0, "evidence": "short quote or cue"}],
    "primary_kind": "leadership_meeting",
    "importance": {
      "grade": "P1|P2|P3|P4",
      "label_zh": "...",
      "score_0_to_1": 0.0,
      "rationale": "...",
      "drivers": ["..."],
      "tag": "hypothesis"
    },
    "tag": "hypothesis"
  },
  "signaling_scorecard": {
    "method": "enumerate-then-weight",
    "framing": "civilian-public-media-heuristics",
    "rules": [
      {"id": "...", "category": "...", "label_zh": "...", "label_en": "...", "weight": 0.0, "status": "hit|miss|unclear", "raw_score": 0, "weighted_score": 0, "tag": "hypothesis"}
    ],
    "weighted_total": 0.0,
    "weight_sum": 1.0,
    "band": "low|medium|high",
    "calibration": "...",
    "tag": "hypothesis"
  },
  "signaling_valves": {
    "sequence": {"status": "observed|unclear|absent", "observation": "...", "reading": "...", "tag": "hypothesis"},
    "implementing_detail": {"status": "present|absent|unclear", "observation": "...", "reading": "...", "tag": "hypothesis"},
    "press_placement": {"status": "observed|unclear|absent", "observation": "...", "reading": "...", "tag": "hypothesis"},
    "calibration": "roll-up of scorecard"
  },
  "briefing_en": {
    "headline": "one short declarative sentence stating the specific claim (who did what) — not a description of the document type or a generic 'X issued a notice'",
    "what": "...",
    "context": "...",
    "so_what": "...",
    "confidence": "low|medium|high",
    "sources_used": ["paste-1", "..."]
  },
  "policy_outlook": {
    "horizon": "near|medium",
    "scenarios": [
      {
        "label": "...",
        "likelihood": "low|medium|high",
        "basis": "...",
        "trigger": "observable confirmation...",
        "alternative": "competing reading...",
        "falsifier": "public observation that kills this path — if it needs a fact this excerpt/outbox doesn't have (a historical baseline, a prior edition, an official figure), say what to search for, not just 'unclear'...",
        "tag": "hypothesis"
      }
    ],
    "watchpoints": ["observable public signal..."]
  },
  "open_questions": ["a background-knowledge gap the excerpt can't resolve, phrased as an actionable search step: what to search for or what document type to find — not just 'this needs verification'"]
}

Rules:
- Quotes in source_digest_zh must be short substrings of the matching source_label text (or any source if unlabeled).
- When multiple sources are provided, set source_label on every digest row.
- Context cards are Civic Ontology Lite (background/hypothesis). Do not treat them as proven secret facts.
- Prefer cards aligned to the desk section; do not dump unrelated world-models into the briefing.
- info_triage: assign 信息种类 (kinds, multi-label OK) + 重要性分级 P1–P4. This is research priority triage — NEVER secrecy markings (TOP SECRET/SECRET/密级).
- ALWAYS enumerate the full heuristic catalog from policy-signaling-valves BEFORE weighting; do not skip rows.
- status: hit|miss|unclear; raw_score hit=1 unclear=0.4 miss=0; weighted_score=weight*raw_score.
- signaling_valves are category roll-ups of sequence / implementing_detail / press_placement.
- The runtime may replace signaling_scorecard, info_triage, and ontology_lite with deterministic scorers — still fill them honestly.
- policy_outlook preferred for policy sources; every scenario tag MUST be "hypothesis".
- Scale the NUMBER of scenarios to how much hard detail the excerpt actually carries — do not pad to a fixed count. A routine "meeting language → follow-on notice, no numbers/deadline/scope yet" excerpt earns exactly ONE scenario ("continuity, wait for implementing detail"), not three near-duplicate ones. Only produce 2-3 scenarios when there are 2-3 genuinely distinct hard signals (named instrument, funding, deadline, quantified target, pilot scope) to branch on.
- Each scenario should include alternative + falsifier (competing reading + public kill-condition).
- Use may/could/if-then — never will-definitely / guaranteed / secretly-plans.
- If unsure, lower confidence and add open_questions.`;

  const prompt = [
    writer,
    ethics,
    `# Civic Ontology Lite (matched)\n\nDesk primary: ${ontology.desk_primary || "n/a"}\n${catalogHint}\n\n${
      bodies.length
        ? bodies.join("\n\n---\n\n")
        : "(none matched — do not invent institutional jargon)"
    }`,
    outputSpec,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return { prompt, matchedCards: names, ontology };
}
