// GrantWright-style skill loader: markdown instruction units composed at runtime.
import fs from "fs";
import path from "path";

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

function readFrontmatter(file: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return {};
    const out: Record<string, string> = {};
    for (const line of m[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function detectContextCards(sourceText: string): { names: string[]; bodies: string[] } {
  const dir = path.join(SKILLS_DIR, "context-cards");
  const hay = sourceText || "";
  const names: string[] = [];
  const bodies: string[] = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const full = path.join(dir, f);
      const fm = readFrontmatter(full);
      const keywords = (String(fm.match || "").match(/"([^"]+)"/g) || []).map((s) =>
        s.replace(/"/g, "")
      );
      if (keywords.some((k) => hay.includes(k))) {
        names.push(fm.name || f.replace(/\.md$/, ""));
        bodies.push(readBody(full));
      }
    }
  } catch {
    /* missing dir */
  }
  return { names, bodies };
}

export function composeBriefingSystemPrompt(sourceText: string): {
  prompt: string;
  matchedCards: string[];
} {
  const writer = readBody(path.join(SKILLS_DIR, "briefing-writer", "SKILL.md"));
  const ethics = readBody(path.join(SKILLS_DIR, "ethics-sandbox", "SKILL.md"));
  const { names, bodies } = detectContextCards(sourceText);

  const outputSpec = `# Output task
Return ONLY valid JSON with this shape:
{
  "source_digest_zh": [{"point": "...", "quote": "..."}],
  "context_notes": [{"card": "...", "note": "...", "tag": "background|hypothesis"}],
  "briefing_en": {
    "what": "...",
    "context": "...",
    "so_what": "...",
    "confidence": "low|medium|high",
    "sources_used": ["paste-1", "..."]
  },
  "policy_outlook": {
    "horizon": "near|medium",
    "scenarios": [
      {"label": "...", "likelihood": "low|medium|high", "basis": "...", "tag": "hypothesis"}
    ],
    "watchpoints": ["observable public signal..."]
  },
  "open_questions": ["..."]
}

Rules:
- Quotes in source_digest_zh must be short substrings of the user Mandarin text.
- context_notes must cite which loaded context card they use; tag honestly.
- policy_outlook is optional but preferred for policy-related sources; every scenario tag MUST be "hypothesis".
- Use may/could/if-then — never will-definitely / guaranteed / secretly-plans.
- briefing_en.so_what must not invent forecasts beyond the sources + tagged hypotheses.
- If unsure, lower confidence and add open_questions.`;

  const prompt = [
    writer,
    ethics,
    bodies.length
      ? `# Matched context cards\n\n${bodies.join("\n\n---\n\n")}`
      : "# Matched context cards\n\n(none matched — do not invent institutional jargon)",
    outputSpec,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return { prompt, matchedCards: names };
}
