/**
 * Regenerate the human-review sample pack from current offline pipeline output.
 * Content analysis only in the reader sections — no methodology filler.
 */
import fs from "fs";
import path from "path";
import { listDomainFixtures } from "../src/lib/domains.js";
import { runBriefingPipeline } from "../src/lib/pipeline.js";

const root = process.cwd();
const fixtures = listDomainFixtures(root);

/** Stable curated set for human review (include rejects + hot topics + cores). */
const REVIEW_IDS = [
  "boilerplate-heavy",
  "canada-nexus",
  "macro-cewc",
  "macro-instrument",
  "hot-taiwan-strait",
  "hot-electric-vehicles",
  "hot-china-ai",
  "finance-risk",
  "defense-public",
  "social-commentary-paste",
  "industrial-tech",
  "foreign-affairs",
];

const selected = REVIEW_IDS.map((id) => fixtures.find((f) => f.id === id)).filter(
  (f): f is NonNullable<typeof f> => Boolean(f)
);

if (selected.length < 8) {
  console.error(`Expected ≥8 review fixtures, got ${selected.length}`);
  process.exit(1);
}

const FORBIDDEN = [
  /raise confidence/i,
  /direction verb/i,
  /use info_triage/i,
  /scorecard/i,
  /implementation-track confidence/i,
  /offline mode does not invent/i,
];

type Block = string[];
const blocks: Block[] = [];
let forbidHits = 0;

for (const f of selected) {
  const result = await runBriefingPipeline({
    sourceText: f.sourceText,
    sourceLabel: f.sourceLabel,
    forceOffline: true,
    sourceClass: f.id.includes("social-commentary") ? "social_commentary" : undefined,
  });
  const b = result.briefing;
  const adopted = b.adoption?.adopted !== false;
  const ca = b.content_analysis;
  const facts = (b.substance_cut?.nuggets || []).slice(0, 8);
  const scenarios = b.policy_outlook?.scenarios || [];
  const watch = b.policy_outlook?.watchpoints || [];
  const openQ = b.open_questions || [];

  const body: Block = [
    `# ${f.domain} (\`${f.id}\`)`,
    "",
    `> gate=${result.gate.passed ? "PASS" : "FAIL"} · adopted=${adopted ? "yes" : "no"} · triage=${b.info_triage?.primary_kind || "?"}/${b.info_triage?.importance?.grade || "?"} · substance=${b.substance_cut?.band || "?"} · domain=${ca?.domain_label_en || ca?.domain || "—"}`,
    "",
    "## Source excerpt",
    f.sourceText.slice(0, 280) + (f.sourceText.length > 280 ? "…" : ""),
    "",
  ];

  if (!adopted) {
    body.push(
      "## Not adopted",
      b.briefing_en?.what || b.adoption?.label_zh || "",
      "",
      b.briefing_en?.so_what || b.adoption?.reason_zh || "",
      ""
    );
  } else {
    body.push("## What", b.briefing_en?.what || "—", "");
    body.push("## So what", b.briefing_en?.so_what || ca?.so_what || "—", "");
    if (facts.length) {
      body.push("## Extracted facts");
      for (const n of facts) {
        const label = n.value_en || n.label_zh || n.kind || "fact";
        body.push(`- **${label}:** ${n.evidence || ""}`);
      }
      body.push("");
    }
    if (scenarios.length) {
      body.push("## Scenarios (hypothesis)");
      for (const s of scenarios) {
        body.push(`- **[${s.likelihood || "?"}]** ${s.label}`);
        if (s.horizon) body.push(`  - Horizon: ${s.horizon}`);
        if (s.basis) body.push(`  - Basis: ${s.basis}`);
        if (s.trigger) body.push(`  - Trigger: ${s.trigger}`);
      }
      body.push("");
    }
    if (watch.length) {
      body.push("## Watchpoints");
      for (const w of watch) body.push(`- ${w}`);
      body.push("");
    }
    if (openQ.length) {
      body.push("## Open questions");
      for (const q of openQ.slice(0, 5)) body.push(`- ${q}`);
      body.push("");
    }
  }

  const text = body.join("\n");
  for (const rx of FORBIDDEN) {
    if (rx.test(text)) {
      forbidHits += 1;
      console.error(`FORBIDDEN phrase in ${f.id}: ${rx}`);
    }
  }
  // Evidence must not start mid common phrase fragments from hard shrink.
  for (const n of facts) {
    const ev = n.evidence || "";
    if (/^底前/.test(ev) || /^少[于於]/.test(ev)) {
      forbidHits += 1;
      console.error(`Bad evidence start in ${f.id}: ${ev.slice(0, 40)}`);
    }
  }

  blocks.push(body);
  blocks.push(["---", ""]);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const reportDir = path.join(root, "outbox", "test-reports");
fs.mkdirSync(reportDir, { recursive: true });

const md = [
  `# Yanxi sample briefs (analysis + forecast) — human review`,
  "",
  `Generated ${stamp} · offline pipeline · civilian public fixtures · forecasts are hypothesis`,
  "",
  "Reader sections: What → So what → Extracted facts → Scenarios (basis/trigger) → Watchpoints.",
  "First cut remains whitelist + hard nuggets; methodology stays out of the body.",
  "",
  ...blocks.flat(),
  "> Draft for human review · Public fixtures only",
  "",
];

const outPath = path.join(reportDir, "sample-briefs-for-review.md");
fs.writeFileSync(outPath, md.join("\n"), "utf8");
fs.writeFileSync(
  path.join(reportDir, `sample-briefs-for-review-${stamp}.md`),
  md.join("\n"),
  "utf8"
);

console.log(`✅ sample briefs → ${outPath}`);
console.log(`cases=${selected.length} forbidden_hits=${forbidHits}`);
if (forbidHits > 0) process.exit(1);
