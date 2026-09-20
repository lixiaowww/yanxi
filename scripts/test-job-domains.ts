/**
 * Job-fit domain battery: run briefings across FLIA-relevant public Mandarin domains.
 * Civilian fixtures only — not live classified collection.
 */
import fs from "fs";
import path from "path";
import { listDomainFixtures } from "../src/lib/domains.js";
import { runBriefingPipeline } from "../src/lib/pipeline.js";

const root = process.cwd();
const fixtures = listDomainFixtures(root);
if (fixtures.length < 6) {
  console.error(`Expected ≥6 domain fixtures, got ${fixtures.length}`);
  process.exit(1);
}

type Row = {
  id: string;
  domain: string;
  gatePassed: boolean;
  primaryKind?: string;
  importance?: string;
  band?: string;
  cards: string[];
  softFindings: number;
  hardFindings: number;
  what?: string;
  soWhat?: string;
  outlookBase?: string;
  scenarios: { label: string; likelihood?: string; basis?: string }[];
  watchpoints: string[];
};

const rows: Row[] = [];

for (const f of fixtures) {
  const result = await runBriefingPipeline({
    sourceText: f.sourceText,
    sourceLabel: f.sourceLabel,
    forceOffline: true,
  });
  rows.push({
    id: f.id,
    domain: f.domain,
    gatePassed: result.gate.passed,
    primaryKind: result.briefing.info_triage?.primary_kind,
    importance: result.briefing.info_triage?.importance?.grade,
    band: result.briefing.signaling_scorecard?.band,
    cards: result.matchedCards,
    softFindings: result.gate.findings.filter((x) => x.severity === "soft").length,
    hardFindings: result.gate.findings.filter((x) => x.severity === "hard").length,
    what: result.briefing.briefing_en?.what,
    soWhat: result.briefing.briefing_en?.so_what,
    outlookBase: result.briefing.policy_outlook?.scenarios?.[0]?.label,
    scenarios: (result.briefing.policy_outlook?.scenarios || []).map((s) => ({
      label: s.label || "",
      likelihood: s.likelihood,
      basis: s.basis,
    })),
    watchpoints: result.briefing.policy_outlook?.watchpoints || [],
  });
  if (!result.gate.passed) {
    console.error("HARD FAIL", f.id, result.gate.findings);
    process.exit(1);
  }
}

// Cross-domain merge: macro meeting + instrument (job-fit multi-source)
const macro = fixtures.find((f) => f.id === "macro-cewc");
const instrument = fixtures.find((f) => f.id === "macro-instrument");
if (!macro || !instrument) {
  console.error("Missing macro-cewc / macro-instrument fixtures");
  process.exit(1);
}
const merged = await runBriefingPipeline({
  sources: [
    { label: macro.sourceLabel, text: macro.sourceText },
    { label: instrument.sourceLabel, text: instrument.sourceText },
  ],
  forceOffline: true,
});
if (!merged.gate.passed) {
  console.error("merged hard fail", merged.gate.findings);
  process.exit(1);
}

const domainsHit = new Set(rows.map((r) => r.domain));
const kindsHit = new Set(rows.map((r) => r.primaryKind).filter(Boolean));
const cardsUnion = new Set(rows.flatMap((r) => r.cards));

const reportDir = path.join(root, "outbox", "test-reports");
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const reportPath = path.join(reportDir, `job-domains-${stamp}.md`);

const md = [
  `# Job-fit domain battery — ${stamp}`,
  "",
  "Civilian public Mandarin fixtures aligned to FLIA-relevant topic coverage (not an intelligence product).",
  "",
  "## Per-domain briefings",
  "",
  "| Domain | Gate | Kind | P | Band | Cards | Soft | Outlook |",
  "|--------|------|------|---|------|-------|------|---------|",
  ...rows.map(
    (r) =>
      `| ${r.domain} | ${r.gatePassed ? "PASS" : "FAIL"} | ${r.primaryKind} | ${r.importance} | ${r.band} | ${r.cards.length} | ${r.softFindings} | ${(r.outlookBase || "").slice(0, 40)} |`
  ),
  "",
  "## Per-domain analysis & outlook",
  "",
  ...rows.flatMap((r) => [
    `### ${r.domain} (\`${r.id}\`)`,
    "",
    `- triage: **${r.primaryKind}** / **${r.importance}** · band=${r.band}`,
    `- cards: ${r.cards.join(", ") || "(none)"}`,
    "",
    "**What**",
    r.what || "",
    "",
    "**So what (analysis)**",
    r.soWhat || "",
    "",
    "**Outlook (hypothesis)**",
    ...r.scenarios.map((s) => `- **[${s.likelihood}]** ${s.label} — ${s.basis || ""}`),
    ...(r.watchpoints.length
      ? ["", "**Watchpoints**", ...r.watchpoints.map((w) => `- ${w}`)]
      : []),
    "",
  ]),
  "## Multi-source merge (macro meeting + instrument)",
  "",
  `- gate: **${merged.gate.passed ? "PASS" : "FAIL"}**`,
  `- sourceCount: ${merged.sourceCount}`,
  `- triage: ${merged.briefing.info_triage?.primary_kind} / ${merged.briefing.info_triage?.importance?.grade}`,
  `- band: ${merged.briefing.signaling_scorecard?.band}`,
  `- soft findings: ${merged.gate.findings.filter((f) => f.severity === "soft").length}`,
  "",
  "### What",
  merged.briefing.briefing_en?.what || "",
  "",
  "### So what",
  merged.briefing.briefing_en?.so_what || "",
  "",
  "### Outlook scenarios",
  ...(merged.briefing.policy_outlook?.scenarios || []).map(
    (s) => `- **[${s.likelihood}]** ${s.label} — ${s.basis}`
  ),
  "",
  "## Coverage summary",
  "",
  `- fixtures: ${rows.length}`,
  `- domains: ${[...domainsHit].join(", ")}`,
  `- primary kinds seen: ${[...kindsHit].join(", ")}`,
  `- context cards union: ${cardsUnion.size} (${[...cardsUnion].slice(0, 12).join(", ")}…)`,
  "",
  "> Draft for human review · Public fixtures only",
  "",
];

fs.writeFileSync(reportPath, md.join("\n"), "utf8");
fs.writeFileSync(
  path.join(reportDir, "job-domains-latest.json"),
  JSON.stringify({ rows, merged: { sourceCount: merged.sourceCount, gate: merged.gate, briefing: merged.briefing } }, null, 2),
  "utf8"
);

console.log(md.join("\n"));
console.log(`\n✅ test:domains OK → ${reportPath}`);

if (domainsHit.size < 6) {
  console.error("Expected ≥6 distinct domains");
  process.exit(1);
}
if (cardsUnion.size < 5) {
  console.error("Expected broader card coverage");
  process.exit(1);
}
