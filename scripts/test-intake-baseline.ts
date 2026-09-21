/**
 * Intake gold baseline: first cut + second cut (local gray / optional Jev)
 * vs editorial gold labels.
 *
 * Civilian public fixtures only — not an intelligence ranking.
 */
import fs from "fs";
import path from "path";
import { listDomainFixtures } from "../src/lib/domains.js";
import { buildSubstanceCut } from "../src/lib/substance.js";
import { evaluateAdoption } from "../src/lib/adoption.js";
import { detectSourceClass } from "../src/lib/source-class.js";
import {
  firstCutIntakeLabel,
  resolveIntake,
  type IntakeLabel,
  INTAKE_LABELS,
} from "../src/lib/intake.js";

type GoldCase = {
  id: string;
  fixtureId?: string;
  zone: "clear" | "gray";
  gold: IntakeLabel;
  why_en: string;
  sourceText?: string;
  sourceLabel?: string;
  sourceClass?: string;
};

type GoldFile = {
  framing: string;
  cases: GoldCase[];
};

const root = process.cwd();
const goldPath = path.join(root, "examples", "intake-gold.json");
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8")) as GoldFile;
const fixtures = new Map(listDomainFixtures(root).map((f) => [f.id, f]));

type Row = {
  id: string;
  zone: string;
  gold: IntakeLabel;
  firstCut: IntakeLabel;
  final: IntakeLabel;
  engine: string;
  firstAgree: boolean;
  finalAgree: boolean;
  adopted: boolean;
  substance: string;
  nuggetKinds: string[];
  why_en: string;
};

const rows: Row[] = [];

for (const c of gold.cases) {
  if (!INTAKE_LABELS.includes(c.gold)) {
    console.error(`Invalid gold label on ${c.id}: ${c.gold}`);
    process.exit(1);
  }
  let text = c.sourceText || "";
  let label = c.sourceLabel || c.id;
  if (c.fixtureId) {
    const f = fixtures.get(c.fixtureId);
    if (!f) {
      console.error(`Missing fixture ${c.fixtureId} for ${c.id}`);
      process.exit(1);
    }
    text = f.sourceText;
    label = f.sourceLabel;
  }
  if (text.length < 8) {
    console.error(`Empty text for ${c.id}`);
    process.exit(1);
  }

  const cut = buildSubstanceCut(text);
  const adoption = evaluateAdoption(cut);
  const detected = detectSourceClass(text, {
    forced: c.sourceClass as import("../src/lib/source-class.js").SourceClass | undefined,
    labels: [label],
  });
  const firstCut = firstCutIntakeLabel({
    adopted: adoption.adopted,
    sourceClass: detected.class,
  });
  const intake = await resolveIntake({
    adopted: adoption.adopted,
    sourceClass: detected.class,
    text,
    substance: cut,
    allowJev: process.env.JEV_IN_TESTS === "1",
  });

  rows.push({
    id: c.id,
    zone: c.zone,
    gold: c.gold,
    firstCut,
    final: intake.label,
    engine: intake.second_cut_engine,
    firstAgree: firstCut === c.gold,
    finalAgree: intake.label === c.gold,
    adopted: adoption.adopted,
    substance: cut.band,
    nuggetKinds: [...new Set(cut.nuggets.map((n) => n.kind))],
    why_en: c.why_en,
  });
}

const clear = rows.filter((r) => r.zone === "clear");
const gray = rows.filter((r) => r.zone === "gray");
const clearFinal = clear.filter((r) => r.finalAgree).length;
const grayFinal = gray.filter((r) => r.finalAgree).length;
const falseAdmit = rows.filter((r) => r.final === "admit" && r.gold !== "admit");
const falseReject = rows.filter((r) => r.final === "reject_thin" && r.gold === "admit");

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const reportDir = path.join(root, "outbox", "test-reports");
fs.mkdirSync(reportDir, { recursive: true });

const md = [
  `# Intake gold baseline — ${stamp}`,
  "",
  "First cut = hard-nugget adoption (+ social). Second cut = local gray heuristic (Jev optional via TYPESAFE_API_KEY).",
  "",
  "## Summary",
  "",
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Cases | ${rows.length} |`,
  `| Clear-zone final accuracy | ${clearFinal}/${clear.length} |`,
  `| Gray-zone final accuracy | ${grayFinal}/${gray.length} |`,
  `| False admit (final) | ${falseAdmit.length} |`,
  `| False reject admit (final) | ${falseReject.length} |`,
  "",
  "## Remaining disagreements",
  "",
  ...rows
    .filter((r) => !r.finalAgree)
    .flatMap((r) => [
      `- **${r.id}** · zone=${r.zone} · first=\`${r.firstCut}\` · final=\`${r.final}\` (${r.engine}) · gold=\`${r.gold}\``,
      `  - ${r.why_en}`,
    ]),
  rows.every((r) => r.finalAgree) ? "_None._" : "",
  "",
  "## All cases",
  "",
  "| ID | Zone | First | Final | Engine | Gold | Final OK |",
  "|----|------|-------|-------|--------|------|----------|",
  ...rows.map(
    (r) =>
      `| ${r.id} | ${r.zone} | ${r.firstCut} | ${r.final} | ${r.engine} | ${r.gold} | ${r.finalAgree ? "yes" : "NO"} |`
  ),
  "",
  "> Civilian public fixtures · Not an intelligence product",
  "",
];

const reportPath = path.join(reportDir, `intake-baseline-${stamp}.md`);
fs.writeFileSync(reportPath, md.join("\n"), "utf8");
fs.writeFileSync(
  path.join(reportDir, "intake-baseline-latest.json"),
  JSON.stringify(
    {
      stamp,
      summary: {
        cases: rows.length,
        clearFinal: `${clearFinal}/${clear.length}`,
        grayFinal: `${grayFinal}/${gray.length}`,
        falseAdmit: falseAdmit.length,
        falseReject: falseReject.length,
      },
      rows,
    },
    null,
    2
  ),
  "utf8"
);

console.log(md.join("\n"));
console.log(`\n✅ intake baseline → ${reportPath}`);

if (clear.length && clearFinal / clear.length < 0.85) {
  console.error("Clear-zone final accuracy below 85%.");
  process.exit(1);
}
if (falseAdmit.length > 0) {
  console.error(`Final false-admits ${falseAdmit.length} — stop.`);
  process.exit(1);
}
if (gray.length && grayFinal / gray.length < 0.8) {
  console.error(`Gray-zone final accuracy ${grayFinal}/${gray.length} below 80%.`);
  process.exit(1);
}
