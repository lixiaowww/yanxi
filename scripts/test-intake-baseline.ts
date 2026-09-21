/**
 * Intake gold baseline: first cut (whitelist-eligible paste + hard nuggets)
 * vs editorial gold labels. Gray disagreements are the Jev second-cut target set.
 *
 * Civilian public fixtures only — not an intelligence ranking.
 */
import fs from "fs";
import path from "path";
import { listDomainFixtures } from "../src/lib/domains.js";
import { buildSubstanceCut } from "../src/lib/substance.js";
import { evaluateAdoption } from "../src/lib/adoption.js";
import { detectSourceClass } from "../src/lib/source-class.js";
import { firstCutIntakeLabel, type IntakeLabel, INTAKE_LABELS } from "../src/lib/intake.js";

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
  agree: boolean;
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

  rows.push({
    id: c.id,
    zone: c.zone,
    gold: c.gold,
    firstCut,
    agree: firstCut === c.gold,
    adopted: adoption.adopted,
    substance: cut.band,
    nuggetKinds: [...new Set(cut.nuggets.map((n) => n.kind))],
    why_en: c.why_en,
  });
}

const clear = rows.filter((r) => r.zone === "clear");
const gray = rows.filter((r) => r.zone === "gray");
const clearAgree = clear.filter((r) => r.agree).length;
const grayDisagree = gray.filter((r) => !r.agree).length;
const falseAdmit = rows.filter(
  (r) => r.firstCut === "admit" && (r.gold === "defer" || r.gold === "reject_thin" || r.gold === "social_downweight")
);
const falseReject = rows.filter((r) => r.firstCut === "reject_thin" && r.gold === "admit");
const goldDefer = rows.filter((r) => r.gold === "defer");

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const reportDir = path.join(root, "outbox", "test-reports");
fs.mkdirSync(reportDir, { recursive: true });

const md = [
  `# Intake gold baseline — ${stamp}`,
  "",
  "First cut = hard-nugget adoption (+ social class). Gold is editorial. Gray disagreements = Jev second-cut targets.",
  "",
  "## Summary",
  "",
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Cases | ${rows.length} |`,
  `| Clear-zone accuracy | ${clearAgree}/${clear.length} |`,
  `| Gray cases | ${gray.length} |`,
  `| Gray where first cut ≠ gold | ${grayDisagree}/${gray.length} |`,
  `| False admit (first=admit, gold≠admit) | ${falseAdmit.length} |`,
  `| False reject (first=reject, gold=admit) | ${falseReject.length} |`,
  `| Gold defer (Jev-shaped) | ${goldDefer.length} |`,
  "",
  "## Disagreements (Jev candidates)",
  "",
  ...rows
    .filter((r) => !r.agree)
    .flatMap((r) => [
      `- **${r.id}** · zone=${r.zone} · first=\`${r.firstCut}\` · gold=\`${r.gold}\` · substance=${r.substance} · kinds=${r.nuggetKinds.join(",") || "—"}`,
      `  - ${r.why_en}`,
    ]),
  "",
  "## All cases",
  "",
  "| ID | Zone | First cut | Gold | Agree | Substance |",
  "|----|------|-----------|------|-------|-----------|",
  ...rows.map(
    (r) =>
      `| ${r.id} | ${r.zone} | ${r.firstCut} | ${r.gold} | ${r.agree ? "yes" : "NO"} | ${r.substance} |`
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
        clearAccuracy: `${clearAgree}/${clear.length}`,
        grayDisagree: `${grayDisagree}/${gray.length}`,
        falseAdmit: falseAdmit.length,
        falseReject: falseReject.length,
        goldDefer: goldDefer.length,
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

// Gate: clear zone must stay high; we expect gray disagreements (that is the point).
if (clear.length && clearAgree / clear.length < 0.85) {
  console.error("Clear-zone accuracy below 85% — first cut or gold labels need repair.");
  process.exit(1);
}
if (falseAdmit.length > 0) {
  console.error(`First cut false-admits ${falseAdmit.length} gold non-admit case(s) — tighten adoption.`);
  process.exit(1);
}
if (grayDisagree < 3) {
  console.error("Expected ≥3 gray disagreements to justify a second cut; expand gold set.");
  process.exit(1);
}
