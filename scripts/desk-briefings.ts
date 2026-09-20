/**
 * Produce a multi-section civilian briefing desk report + within-section corroboration boards.
 * 总体目标 / 经济投资 / 外交 / 国防（公开） / 社会治理
 */
import fs from "fs";
import path from "path";
import { listDomainFixtures } from "../src/lib/domains.js";
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import {
  DESK_CATALOG,
  type DeskSectionId,
  deskSectionMeta,
} from "../src/lib/briefing-desk.js";
import {
  buildSectionCorroborationBoard,
  detectItemRole,
  renderBoardMarkdown,
  type CorroborationItemSnap,
  type SectionCorroborationBoard,
} from "../src/lib/corroboration-report.js";

type SectionBrief = {
  fixtureId: string;
  domain: string;
  primary: DeskSectionId;
  label_zh: string;
  gate: boolean;
  kind?: string;
  importance?: string;
  substance?: string;
  canada?: string;
  corr: number;
  conf: string;
  missing: string[];
  sourceText: string;
  what?: string;
  soWhat?: string;
  scenarios: { label?: string; likelihood?: string; basis?: string }[];
  watchpoints: string[];
  nuggets: { label_zh?: string; evidence?: string }[];
};

const fixtures = listDomainFixtures();
const bySection = new Map<DeskSectionId, SectionBrief[]>();
for (const s of DESK_CATALOG) bySection.set(s.id, []);

for (const f of fixtures) {
  if (f.id === "boilerplate-heavy" || f.id === "canada-possible" || f.id === "social-commentary-paste") {
    continue;
  }

  const result = await runBriefingPipeline({
    sourceText: f.sourceText,
    sourceLabel: f.sourceLabel,
    forceOffline: true,
  });
  if (!result.gate.passed) {
    console.error("HARD FAIL", f.id, result.gate.findings);
    process.exit(1);
  }

  const desk = result.briefing.desk_section;
  const primary = (desk?.primary || "overall_goals") as DeskSectionId;
  const row: SectionBrief = {
    fixtureId: f.id,
    domain: f.domain,
    primary,
    label_zh: desk?.label_zh || deskSectionMeta(primary).label_zh,
    gate: result.gate.passed,
    kind: result.briefing.info_triage?.primary_kind,
    importance: result.briefing.info_triage?.importance?.grade,
    substance: result.briefing.substance_cut?.band,
    canada: result.briefing.canada_nexus?.level,
    corr: result.briefing.corroboration?.score_0_to_3 ?? 0,
    conf: result.briefing.confidence_factors?.level || result.briefing.briefing_en?.confidence || "?",
    missing: result.briefing.corroboration?.missing || [],
    sourceText: f.sourceText,
    what: result.briefing.briefing_en?.what,
    soWhat: result.briefing.briefing_en?.so_what,
    scenarios: result.briefing.policy_outlook?.scenarios || [],
    watchpoints: result.briefing.policy_outlook?.watchpoints || [],
    nuggets: result.briefing.substance_cut?.nuggets || [],
  };
  bySection.get(primary)!.push(row);
}

const boards: SectionCorroborationBoard[] = [];
const pairDeltas: {
  sectionId: string;
  pair: string;
  beforeMax: number;
  beforeMin: number;
  afterCorr: number;
  afterConf: string;
  rose: boolean;
  reinforced: boolean;
}[] = [];

for (const sec of DESK_CATALOG) {
  const rows = bySection.get(sec.id) || [];
  const snaps: CorroborationItemSnap[] = rows.map((r) => {
    const det = detectItemRole({ kind: r.kind, text: r.sourceText });
    return {
      fixtureId: r.fixtureId,
      label: r.fixtureId,
      role: det.role,
      corr: r.corr,
      conf: r.conf,
      substance: r.substance || "?",
      kind: r.kind,
      missing: r.missing,
      hasMeetingCue: det.hasMeetingCue,
      hasInstrumentCue: det.hasInstrumentCue,
    };
  });
  const board = buildSectionCorroborationBoard({
    sectionId: sec.id,
    label_zh: sec.label_zh,
    items: snaps,
  });
  boards.push(board);

  // Prefer pure direction (meeting, no instrument) + instrument within section;
  // if section has direction only, try bridging to economy_investment instruments.
  const pickDirection = (list: SectionBrief[]) =>
    list.find((r) => {
      const d = detectItemRole({ kind: r.kind, text: r.sourceText });
      return d.hasMeetingCue && !d.hasInstrumentCue;
    }) ||
    list.find((r) => {
      const d = detectItemRole({ kind: r.kind, text: r.sourceText });
      return d.hasMeetingCue || d.role === "direction_meeting";
    });

  const pickInstrument = (list: SectionBrief[]) =>
    list.find((r) => {
      const d = detectItemRole({ kind: r.kind, text: r.sourceText });
      return d.hasInstrumentCue || d.role === "implementing_instrument";
    });

  if (board.pairable) {
    const a = pickDirection(rows);
    const b = pickInstrument(rows);
    if (a && b && a.fixtureId !== b.fixtureId) {
      const merged = await runBriefingPipeline({
        sources: [
          { label: a.fixtureId, text: a.sourceText },
          { label: b.fixtureId, text: b.sourceText },
        ],
        forceOffline: true,
      });
      const afterCorr = merged.briefing.corroboration?.score_0_to_3 ?? 0;
      const beforeMax = Math.max(a.corr, b.corr);
      const beforeMin = Math.min(a.corr, b.corr);
      pairDeltas.push({
        sectionId: sec.id,
        pair: `${a.fixtureId} + ${b.fixtureId}`,
        beforeMax,
        beforeMin,
        afterCorr,
        afterConf: merged.briefing.confidence_factors?.level || "?",
        rose: afterCorr > beforeMax,
        reinforced: beforeMin < 2 && afterCorr >= 2,
      });
    }
  } else if (sec.id === "overall_goals") {
    const a = pickDirection(rows);
    const economyRows = bySection.get("economy_investment") || [];
    const b = pickInstrument(economyRows);
    if (a && b) {
      const merged = await runBriefingPipeline({
        sources: [
          { label: a.fixtureId, text: a.sourceText },
          { label: b.fixtureId, text: b.sourceText },
        ],
        forceOffline: true,
      });
      const afterCorr = merged.briefing.corroboration?.score_0_to_3 ?? 0;
      const beforeMax = Math.max(a.corr, b.corr);
      const beforeMin = Math.min(a.corr, b.corr);
      pairDeltas.push({
        sectionId: sec.id,
        pair: `${a.fixtureId} + ${b.fixtureId}（跨栏·经济投资细则）`,
        beforeMax,
        beforeMin,
        afterCorr,
        afterConf: merged.briefing.confidence_factors?.level || "?",
        rose: afterCorr > beforeMax,
        reinforced: beforeMin < 2 && afterCorr >= 2,
      });
      board.next_steps_zh.unshift(
        `跨栏建议：总体目标 \`${a.fixtureId}\` × 经济投资细则 \`${b.fixtureId}\`（合并实测见总览）`
      );
      board.pair_hint_zh = `跨栏配对：\`${a.fixtureId}\`（方向） + \`${b.fixtureId}\`（细则·经济投资）`;
      board.pairable = true;
    }
  }
}

const reportDir = path.join(process.cwd(), "outbox", "test-reports");
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

const md: string[] = [
  `# 分栏目简报桌面 + 印证报告 — ${stamp}`,
  "",
  "民用公开源 · 按 **总体目标 / 经济投资 / 外交 / 国防（公开表述） / 社会治理** 归类。",
  "非情报产品；预测均为 hypothesis；国防栏仅公开话语。",
  "",
  "## 全桌印证总览",
  "",
  "| 栏目 | 条目 | 最高 corr | 平均 | 可配对 | 首要缺口 |",
  "|------|------|-----------|------|--------|----------|",
  ...boards.map((b) => {
    const gap = b.next_steps_zh[0] || "—";
    return `| ${b.label_zh} | ${b.itemCount} | ${b.maxCorr}/3 | ${b.avgCorr} | ${b.pairable ? "是" : "否"} | ${gap.slice(0, 36)} |`;
  }),
  "",
];

if (pairDeltas.length) {
  md.push("### 栏内方向+细则合并实测");
  md.push("");
  md.push("| 栏目 | 配对 | 弱腿→合并后 | 最高→合并后 | conf | 抬升弱腿? | 刷新最高? |");
  md.push("|------|------|--------------|--------------|------|-----------|-----------|");
  for (const d of pairDeltas) {
    const label = DESK_CATALOG.find((s) => s.id === d.sectionId)?.label_zh || d.sectionId;
    md.push(
      `| ${label} | \`${d.pair}\` | ${d.beforeMin}→**${d.afterCorr}** | ${d.beforeMax}→${d.afterCorr} | ${d.afterConf} | ${d.reinforced ? "是" : "否"} | ${d.rose ? "是" : "否"} |`
    );
  }
  md.push("");
}

for (const sec of DESK_CATALOG) {
  const rows = bySection.get(sec.id) || [];
  const board = boards.find((b) => b.sectionId === sec.id)!;
  md.push(`## ${sec.order}. ${sec.label_zh}（${sec.label_en}）`);
  md.push("");
  md.push(`> ${sec.blurb_zh}`);
  md.push("");
  md.push(...renderBoardMarkdown(board));

  if (!rows.length) {
    md.push("_本轮样例未命中此栏；请补充公开摘录或白名单源。_");
    md.push("");
    continue;
  }

  for (const r of rows) {
    md.push(`### ${r.label_zh} · \`${r.fixtureId}\``);
    md.push("");
    md.push(
      `- triage: **${r.kind}** / **${r.importance}** · substance=${r.substance} · corr=${r.corr}/3 · conf=${r.conf} · CA=${r.canada || "none"} · gate=${r.gate ? "PASS" : "FAIL"}`
    );
    md.push("");
    md.push("**What**");
    md.push(r.what || "");
    md.push("");
    md.push("**So what（分析）**");
    md.push(r.soWhat || "");
    md.push("");
    if (r.nuggets.length) {
      md.push("**干货**");
      for (const n of r.nuggets.slice(0, 6)) {
        md.push(`- **${n.label_zh}:** ${n.evidence}`);
      }
      md.push("");
    }
    if (r.missing.length) {
      md.push("**缺印证**");
      for (const m of r.missing.slice(0, 4)) md.push(`- ${m}`);
      md.push("");
    }
    md.push("**Outlook（hypothesis）**");
    for (const s of r.scenarios) {
      md.push(`- **[${s.likelihood}]** ${s.label} — ${s.basis || ""}`);
    }
    md.push("");
    if (r.watchpoints.length) {
      md.push("**Watchpoints**");
      for (const w of r.watchpoints.slice(0, 5)) md.push(`- ${w}`);
      md.push("");
    }
  }
}

md.push("## 栏目覆盖");
md.push("");
for (const sec of DESK_CATALOG) {
  const n = (bySection.get(sec.id) || []).length;
  md.push(`- **${sec.label_zh}:** ${n} 条`);
}
md.push("");
md.push("> Draft for human review · Public fixtures only · 印证报告 = 有什么 / 缺什么 / 合并是否上升");
md.push("");

const reportPath = path.join(reportDir, `desk-briefings-${stamp}.md`);
const corrPath = path.join(reportDir, `corroboration-${stamp}.md`);
const corrOnly = [
  `# 栏目印证报告 — ${stamp}`,
  "",
  "第二支柱产物：栏内已有源、印证分、缺口、可配对合并实测。",
  "",
  ...md.slice(md.indexOf("## 全桌印证总览"), md.indexOf("## 1.")),
];
// Rebuild corr-only cleanly
const corrMd = [
  `# 栏目印证报告 — ${stamp}`,
  "",
  "民用 · 非情报产品。回答三问：**有什么源、缺什么、合并后印证是否上升。**",
  "",
  "## 全桌印证总览",
  "",
  "| 栏目 | 条目 | 最高 corr | 平均 | 可配对 | 首要缺口 |",
  "|------|------|-----------|------|--------|----------|",
  ...boards.map((b) => {
    const gap = b.next_steps_zh[0] || "—";
    return `| ${b.label_zh} | ${b.itemCount} | ${b.maxCorr}/3 | ${b.avgCorr} | ${b.pairable ? "是" : "否"} | ${gap.slice(0, 40)} |`;
  }),
  "",
];
if (pairDeltas.length) {
  corrMd.push("## 栏内配对合并实测", "");
  corrMd.push("| 栏目 | 配对 | 弱腿→合并后 | 最高→合并后 | conf | 抬升弱腿? | 刷新最高? |");
  corrMd.push("|------|------|--------------|--------------|------|-----------|-----------|");
  for (const d of pairDeltas) {
    const label = DESK_CATALOG.find((s) => s.id === d.sectionId)?.label_zh || d.sectionId;
    corrMd.push(
      `| ${label} | \`${d.pair}\` | ${d.beforeMin}→**${d.afterCorr}** | ${d.beforeMax}→${d.afterCorr} | ${d.afterConf} | ${d.reinforced ? "是" : "否"} | ${d.rose ? "是" : "否"} |`
    );
  }
  corrMd.push("");
}
for (const board of boards) {
  corrMd.push(`## ${board.label_zh}`);
  corrMd.push("");
  corrMd.push(...renderBoardMarkdown(board));
}
corrMd.push("> Human review · Public fixtures only");
corrMd.push("");

fs.writeFileSync(reportPath, md.join("\n"), "utf8");
fs.writeFileSync(corrPath, corrMd.join("\n"), "utf8");
fs.writeFileSync(path.join(reportDir, "corroboration-latest.md"), corrMd.join("\n"), "utf8");
fs.writeFileSync(
  path.join(reportDir, "desk-briefings-latest.json"),
  JSON.stringify({ stamp, boards, pairDeltas, sections: Object.fromEntries(DESK_CATALOG.map((s) => [s.id, bySection.get(s.id) || []])) }, null, 2),
  "utf8"
);
fs.writeFileSync(
  path.join(reportDir, "corroboration-latest.json"),
  JSON.stringify({ stamp, boards, pairDeltas }, null, 2),
  "utf8"
);

console.log(corrMd.join("\n"));
console.log(`\n✅ corroboration report → ${corrPath}`);
console.log(`✅ desk briefings (full) → ${reportPath}`);

const empty = DESK_CATALOG.filter((s) => !(bySection.get(s.id) || []).length);
if (empty.length) {
  console.warn("WARN empty desk sections:", empty.map((s) => s.id).join(", "));
}

// Soft quality: if any pairable section failed to rise, warn (do not fail CI yet — provenance caps may apply)
const stalled = pairDeltas.filter((d) => !d.rose && !d.reinforced);
if (stalled.length) {
  console.warn(
    "WARN pair merge neither rose nor reinforced:",
    stalled.map((d) => d.pair).join("; ")
  );
}
