/**
 * Historical-style public-chain regression: assert thin→dense / corr↑ / social cap / desk routing.
 * Cases live in examples/regress/*.json — synthetic public-style Mandarin only.
 */
import fs from "fs";
import path from "path";
import { runBriefingPipeline } from "../src/lib/pipeline.js";

type Expect = {
  gate?: boolean;
  substance_band_in?: string[];
  substance_band?: string;
  corroboration_min?: number;
  corroboration_max?: number;
  confidence_eq?: string;
  confidence_min?: string;
  confidence_max?: string;
  desk_primary_in?: string[];
  primary_kind_in?: string[];
  source_class?: string;
  source_class_not?: string;
  canada_nexus_in?: string[];
  canada_policy_in?: string[];
  caps_include_any?: string[];
  missing_includes_any?: string[];
  corroboration_gt_stage?: string;
  substance_gt_stage?: string;
};

type Stage = {
  id: string;
  sources: { label: string; text: string }[];
  expect: Expect;
};

type CaseFile = {
  id: string;
  title_zh: string;
  framing?: string;
  notes?: string;
  stages: Stage[];
};

type StageSnap = {
  gate: boolean;
  substance: string;
  substanceScore: number;
  corr: number;
  conf: string;
  desk?: string;
  kind?: string;
  sourceClass?: string;
  canadaNexus?: string;
  canadaPolicy?: string;
  caps: string[];
  missing: string[];
};

const CONF_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };
const SUBSTANCE_RANK: Record<string, number> = { thin: 0, mixed: 1, dense: 2 };

const root = process.cwd();
const dir = path.join(root, "examples", "regress");
const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  : [];

if (files.length < 6) {
  console.error(`Expected ≥6 regress cases in ${dir}, got ${files.length}`);
  process.exit(1);
}

const failures: string[] = [];
const rows: {
  caseId: string;
  stageId: string;
  ok: boolean;
  snap: StageSnap;
  errors: string[];
}[] = [];

function fail(caseId: string, stageId: string, msg: string) {
  failures.push(`${caseId}/${stageId}: ${msg}`);
}

for (const file of files) {
  const c = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as CaseFile;
  const stageMap = new Map<string, StageSnap>();

  for (const stage of c.stages) {
    const result = await runBriefingPipeline({
      sources: stage.sources,
      forceOffline: true,
    });
    const b = result.briefing;
    const snap: StageSnap = {
      gate: result.gate.passed,
      substance: b.substance_cut?.band || "?",
      substanceScore: b.substance_cut?.substance_score_0_to_1 ?? 0,
      corr: b.corroboration?.score_0_to_3 ?? -1,
      conf: b.confidence_factors?.level || b.briefing_en?.confidence || "?",
      desk: b.desk_section?.primary,
      kind: b.info_triage?.primary_kind,
      sourceClass: b.source_class?.class,
      canadaNexus: b.canada_nexus?.level,
      canadaPolicy: b.canada_policy_link?.level,
      caps: b.confidence_factors?.caps_applied || [],
      missing: b.corroboration?.missing || [],
    };
    stageMap.set(stage.id, snap);

    const e = stage.expect || {};
    const errors: string[] = [];

    if (e.gate != null && snap.gate !== e.gate) {
      errors.push(`gate want=${e.gate} got=${snap.gate}`);
    }
    if (e.substance_band && snap.substance !== e.substance_band) {
      errors.push(`substance want=${e.substance_band} got=${snap.substance}`);
    }
    if (e.substance_band_in && !e.substance_band_in.includes(snap.substance)) {
      errors.push(`substance ${snap.substance} not in [${e.substance_band_in.join(",")}]`);
    }
    if (e.corroboration_min != null && snap.corr < e.corroboration_min) {
      errors.push(`corr ${snap.corr} < min ${e.corroboration_min}`);
    }
    if (e.corroboration_max != null && snap.corr > e.corroboration_max) {
      errors.push(`corr ${snap.corr} > max ${e.corroboration_max}`);
    }
    if (e.confidence_eq && snap.conf !== e.confidence_eq) {
      errors.push(`conf want=${e.confidence_eq} got=${snap.conf}`);
    }
    if (e.confidence_min != null) {
      if ((CONF_RANK[snap.conf] ?? -1) < (CONF_RANK[e.confidence_min] ?? 99)) {
        errors.push(`conf ${snap.conf} < min ${e.confidence_min}`);
      }
    }
    if (e.confidence_max != null) {
      if ((CONF_RANK[snap.conf] ?? 99) > (CONF_RANK[e.confidence_max] ?? -1)) {
        errors.push(`conf ${snap.conf} > max ${e.confidence_max}`);
      }
    }
    if (e.desk_primary_in && snap.desk && !e.desk_primary_in.includes(snap.desk)) {
      errors.push(`desk ${snap.desk} not in [${e.desk_primary_in.join(",")}]`);
    }
    if (e.primary_kind_in && snap.kind && !e.primary_kind_in.includes(snap.kind)) {
      errors.push(`kind ${snap.kind} not in [${e.primary_kind_in.join(",")}]`);
    }
    if (e.source_class && snap.sourceClass !== e.source_class) {
      errors.push(`source_class want=${e.source_class} got=${snap.sourceClass}`);
    }
    if (e.source_class_not && snap.sourceClass === e.source_class_not) {
      errors.push(`source_class must not be ${e.source_class_not}`);
    }
    if (e.canada_nexus_in && snap.canadaNexus && !e.canada_nexus_in.includes(snap.canadaNexus)) {
      errors.push(`canada_nexus ${snap.canadaNexus} not in [${e.canada_nexus_in.join(",")}]`);
    }
    if (e.canada_policy_in && snap.canadaPolicy && !e.canada_policy_in.includes(snap.canadaPolicy)) {
      errors.push(`canada_policy ${snap.canadaPolicy} not in [${e.canada_policy_in.join(",")}]`);
    }
    if (e.caps_include_any?.length) {
      const hit = e.caps_include_any.some((c) => snap.caps.includes(c));
      if (!hit) errors.push(`caps missing any of [${e.caps_include_any.join(",")}] got=[${snap.caps.join(",")}]`);
    }
    if (e.missing_includes_any?.length) {
      const blob = snap.missing.join("|");
      const hit = e.missing_includes_any.some((m) => blob.includes(m));
      if (!hit) errors.push(`missing[] should mention one of [${e.missing_includes_any.join(",")}]`);
    }
    if (e.corroboration_gt_stage) {
      const prev = stageMap.get(e.corroboration_gt_stage);
      if (!prev) errors.push(`unknown stage ${e.corroboration_gt_stage}`);
      else if (!(snap.corr > prev.corr)) {
        errors.push(`corr ${snap.corr} not > ${e.corroboration_gt_stage}(${prev.corr})`);
      }
    }
    if (e.substance_gt_stage) {
      const prev = stageMap.get(e.substance_gt_stage);
      if (!prev) errors.push(`unknown stage ${e.substance_gt_stage}`);
      else {
        const better =
          (SUBSTANCE_RANK[snap.substance] ?? -1) > (SUBSTANCE_RANK[prev.substance] ?? -1) ||
          snap.substanceScore > prev.substanceScore + 0.05;
        if (!better) {
          errors.push(
            `substance ${snap.substance}/${snap.substanceScore} not > ${e.substance_gt_stage}(${prev.substance}/${prev.substanceScore})`
          );
        }
      }
    }

    for (const err of errors) fail(c.id, stage.id, err);
    rows.push({ caseId: c.id, stageId: stage.id, ok: errors.length === 0, snap, errors });
  }
}

const reportDir = path.join(root, "outbox", "test-reports");
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const md = [
  `# Regress report — ${stamp}`,
  "",
  "Civilian public-style chains: meeting→instrument, formula→nugget, social cap, desk routing.",
  "",
  "Internal counters are shown on purpose: this report checks thresholds, it is not a reader-facing brief.",
  "",
  "| Case | Stage | OK | substance band | corr counter (internal) | conf | desk | kind |",
  "|------|-------|----|----------------|-------------------------|------|------|------|",
  ...rows.map(
    (r) =>
      `| ${r.caseId} | ${r.stageId} | ${r.ok ? "PASS" : "FAIL"} | ${r.snap.substance} | ${r.snap.corr} | ${r.snap.conf} | ${r.snap.desk || "—"} | ${r.snap.kind || "—"} |`
  ),
  "",
  failures.length
    ? `## Failures\n\n${failures.map((f) => `- ${f}`).join("\n")}`
    : "## Failures\n\nNone.",
  "",
  `cases=${files.length} stages=${rows.length} failed=${failures.length}`,
  "",
];

const reportPath = path.join(reportDir, `regress-${stamp}.md`);
fs.writeFileSync(reportPath, md.join("\n"), "utf8");
fs.writeFileSync(
  path.join(reportDir, "regress-latest.json"),
  JSON.stringify({ stamp, rows, failures }, null, 2),
  "utf8"
);

console.log(md.join("\n"));
console.log(`\n✅ test:regress report → ${reportPath}`);

if (failures.length) {
  console.error(`\n❌ ${failures.length} assertion(s) failed`);
  process.exit(1);
}
console.log("\n✅ test:regress OK");
