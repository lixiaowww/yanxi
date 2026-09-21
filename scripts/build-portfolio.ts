/**
 * Build portfolio-facing JSON: five desk columns + method + regress green checks.
 * Civilian interview/self-use narrative — not an intelligence dashboard.
 */
import fs from "fs";
import path from "path";
import { listDomainFixtures } from "../src/lib/domains.js";
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { DESK_CATALOG, type DeskSectionId } from "../src/lib/briefing-desk.js";
import { listCanadaPolicyCatalog } from "../src/lib/canada-policy-link.js";
import { listOntologyCatalog } from "../src/lib/ontology-lite.js";
import {
  buildSectionCorroborationBoard,
  detectItemRole,
  type CorroborationItemSnap,
} from "../src/lib/corroboration-report.js";

type DeskItem = {
  fixtureId: string;
  kind?: string;
  importance?: string;
  substance?: string;
  corr: number;
  conf: string;
  what?: string;
  soWhat?: string;
  canada?: string;
  canadaPolicy?: string;
  outlook: { label?: string; likelihood?: string }[];
};

const root = process.cwd();
const fixtures = listDomainFixtures(root);
const bySection = new Map<DeskSectionId, DeskItem[]>();
const texts = new Map<string, string>();
for (const s of DESK_CATALOG) bySection.set(s.id, []);

for (const f of fixtures) {
  if (
    f.id === "boilerplate-heavy" ||
    f.id === "canada-possible" ||
    f.id === "social-commentary-paste"
  ) {
    continue;
  }
  const result = await runBriefingPipeline({
    sourceText: f.sourceText,
    sourceLabel: f.sourceLabel,
    forceOffline: true,
  });
  if (!result.gate.passed) continue;
  const primary = (result.briefing.desk_section?.primary || "economy_investment") as DeskSectionId;
  texts.set(f.id, f.sourceText);
  bySection.get(primary)!.push({
    fixtureId: f.id,
    kind: result.briefing.info_triage?.primary_kind,
    importance: result.briefing.info_triage?.importance?.grade,
    substance: result.briefing.substance_cut?.band,
    corr: result.briefing.corroboration?.score_0_to_3 ?? 0,
    conf: result.briefing.confidence_factors?.level || "?",
    what: result.briefing.briefing_en?.what,
    soWhat: (result.briefing.briefing_en?.so_what || "").slice(0, 280),
    canada: result.briefing.canada_nexus?.level,
    canadaPolicy: result.briefing.canada_policy_link?.level,
    outlook: (result.briefing.policy_outlook?.scenarios || []).map((s) => ({
      label: s.label,
      likelihood: s.likelihood,
    })),
  });
}

const columns = DESK_CATALOG.map((sec) => {
  const items = bySection.get(sec.id) || [];
  const snaps: CorroborationItemSnap[] = items.map((it) => {
    const text = texts.get(it.fixtureId) || "";
    const det = detectItemRole({ kind: it.kind, text });
    return {
      fixtureId: it.fixtureId,
      label: it.fixtureId,
      role: det.role,
      corr: it.corr,
      conf: it.conf,
      substance: it.substance || "?",
      kind: it.kind,
      missing: [],
      hasMeetingCue: det.hasMeetingCue,
      hasInstrumentCue: det.hasInstrumentCue,
    };
  });
  const board = buildSectionCorroborationBoard({
    sectionId: sec.id,
    label_zh: sec.label_zh,
    items: snaps,
  });
  return {
    id: sec.id,
    label_zh: sec.label_zh,
    label_en: sec.label_en,
    blurb_zh: sec.blurb_zh,
    itemCount: items.length,
    maxCorr: board.maxCorr,
    items: items.slice(0, 4),
    next_steps_zh: board.next_steps_zh.slice(0, 3),
  };
});

// Regress green checks
let regress: {
  ok: boolean;
  cases: number;
  stages: number;
  failed: number;
  stamp?: string;
  highlights: string[];
} = { ok: false, cases: 0, stages: 0, failed: 0, highlights: [] };

const regressJson = path.join(root, "outbox", "test-reports", "regress-latest.json");
if (fs.existsSync(regressJson)) {
  const raw = JSON.parse(fs.readFileSync(regressJson, "utf8")) as {
    stamp?: string;
    rows?: { caseId: string; stageId: string; ok: boolean; snap?: { corr?: number; conf?: string } }[];
    failures?: string[];
  };
  const rows = raw.rows || [];
  const failed = (raw.failures || []).length || rows.filter((r) => !r.ok).length;
  const caseIds = new Set(rows.map((r) => r.caseId));
  regress = {
    ok: failed === 0 && rows.length > 0,
    cases: caseIds.size,
    stages: rows.length,
    failed,
    stamp: raw.stamp,
    highlights: [
      "会议单独 → 弱印证；会议+细则 → 印证上升",
      "八股+干货 → substance 升档",
      "社交转述 → confidence 硬封顶 low",
      "五栏路由 + 加国 nexus/policy 稳定",
    ],
  };
}

const portfolio = {
  product: "yanxi",
  framing: "civilian-open-source-research-portfolio",
  title: "研析 Yanxi",
  tagline_zh: "公开中文材料 → 英文研究简报草稿（人在回路）",
  tagline_en: "Public Mandarin → English research briefing drafts for human review",
  not_zh: "不是情报产品、不是监听工具、不针对加拿大人或在加人士",
  method: {
    pillar1_zh: "潜规则 = 公开报道启发式：先枚举再加权（signaling scorecard）",
    pillar2_zh: "多源印证 = corroboration 0–3；缺源清单；栏内配对合并实测",
    confidence_zh: "因子化置信度（substance × 印证 × 出处 × 源类）；社交转述硬封顶 low",
    substance_zh: "八股剥离 → 只留数字/时限/工具/责任主体等可核验干货",
    canada_zh: "加拿大关联 + 公开政策/法规 URL 对照（非法律意见）",
    ontology_zh: "Civic Ontology Lite：栏目优先背景卡 ≤8；非 OWL/情报本体",
  },
  columns,
  regress,
  canada_policy_catalog: listCanadaPolicyCatalog(),
  ontology_catalog: listOntologyCatalog().map((c) => ({
    id: c.id,
    type: c.type,
    desk: c.desk,
    tag: c.tag,
    description: c.description,
    updated: c.updated,
    sources: c.sources,
  })),
  ethics: [
    "Quotes must be substrings of the paste (claim gate)",
    "Outlook = scenarios + watchpoints; never will-definitely",
    "Context cards = Civic Ontology Lite (background/hypothesis only)",
  ],
  generatedAt: new Date().toISOString(),
};

const outDir = path.join(root, "outbox");
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, "portfolio-data.json");
fs.writeFileSync(jsonPath, JSON.stringify(portfolio, null, 2), "utf8");

const mdPath = path.join(outDir, "portfolio.md");
const md = [
  `# ${portfolio.title}`,
  "",
  `> ${portfolio.tagline_zh}`,
  `> ${portfolio.tagline_en}`,
  "",
  `**${portfolio.not_zh}**`,
  "",
  "## 方法两支柱",
  "",
  `1. ${portfolio.method.pillar1_zh}`,
  `2. ${portfolio.method.pillar2_zh}`,
  "",
  `- ${portfolio.method.confidence_zh}`,
  `- ${portfolio.method.substance_zh}`,
  `- ${portfolio.method.canada_zh}`,
  `- ${portfolio.method.ontology_zh}`,
  "",
  "## 五栏摘要",
  "",
];
for (const col of columns) {
  md.push(`### ${col.label_zh} · ${col.label_en}`);
  md.push("");
  md.push(`${col.blurb_zh} · 条目 ${col.itemCount} · 最高印证 ${col.maxCorr}/3`);
  md.push("");
  for (const it of col.items.slice(0, 2)) {
    md.push(`- \`${it.fixtureId}\` · ${it.kind}/${it.importance} · corr=${it.corr} · conf=${it.conf}`);
    if (it.what) md.push(`  - ${it.what.slice(0, 120)}…`);
  }
  md.push("");
}
md.push("## 回归绿勾");
md.push("");
md.push(
  regress.ok
    ? `**PASS** · ${regress.cases} cases / ${regress.stages} stages · failed=${regress.failed}`
    : `**CHECK** · run \`npm run test:regress\` (failed=${regress.failed})`
);
for (const h of regress.highlights) md.push(`- ${h}`);
md.push("");
md.push("## Civic Ontology Lite（背景卡目录）");
md.push("");
md.push("栏目优先挂卡 · background/hypothesis only · 详见 `docs/ONTOLOGY-LITE.md`");
md.push("");
for (const c of portfolio.ontology_catalog) {
  md.push(
    `- \`${c.id}\` · ${c.type}/${c.tag} · desk=${(c.desk || []).join("|")} · ${c.description}`
  );
}
md.push("");
md.push("## 加国公开政策对照入口（可点击核验）");
md.push("");
for (const th of portfolio.canada_policy_catalog.slice(0, 6)) {
  md.push(`### ${th.theme_zh}`);
  for (const r of th.public_refs) {
    md.push(`- [${r.title}](${r.url}) · ${r.publisher}`);
  }
  md.push("");
}
md.push("---");
md.push("");
md.push("Draft for human review · Portfolio narrative only · Not an intelligence product");
md.push("");
fs.writeFileSync(mdPath, md.join("\n"), "utf8");

console.log(`✅ portfolio data → ${jsonPath}`);
console.log(`✅ portfolio md → ${mdPath}`);
