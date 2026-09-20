/**
 * Within-desk-section corroboration board — what we have vs what would raise corr.
 * Civilian research aid; not an ops watch floor.
 */

export type ItemRole =
  | "direction_meeting"
  | "implementing_instrument"
  | "sector_or_risk"
  | "diplomatic"
  | "defense_public"
  | "social_or_ideology"
  | "other";

export type CorroborationItemSnap = {
  fixtureId: string;
  label: string;
  role: ItemRole;
  corr: number;
  conf: string;
  substance: string;
  kind?: string;
  missing: string[];
  sourceClass?: string;
  hasMeetingCue: boolean;
  hasInstrumentCue: boolean;
};

export type SectionCorroborationBoard = {
  sectionId: string;
  label_zh: string;
  itemCount: number;
  maxCorr: number;
  avgCorr: number;
  rolesPresent: ItemRole[];
  items: CorroborationItemSnap[];
  /** Union of missing cues across items (deduped). */
  gaps: string[];
  /** Human-readable next steps to raise section corroboration. */
  next_steps_zh: string[];
  /** Whether a direction+instrument pair exists in-section. */
  pairable: boolean;
  pair_hint_zh?: string;
};

export function detectItemRole(opts: {
  kind?: string;
  text: string;
}): { role: ItemRole; hasMeetingCue: boolean; hasInstrumentCue: boolean } {
  const text = opts.text || "";
  const hasMeetingCue = /中央经济工作会议|中央政治局|中央全会|两会|会议强调|会议指出/.test(text);
  const hasInstrumentCue = /实施细则|实施方案|管理办法|配套办法|印发通知|通知|意见|条例/.test(text);
  const kind = opts.kind || "";

  if (kind === "defense_public" || /国防|解放军|强军/.test(text)) {
    return { role: "defense_public", hasMeetingCue, hasInstrumentCue };
  }
  if (kind === "foreign_affairs" || /外交部|一带一路|中加|加方/.test(text)) {
    return { role: "diplomatic", hasMeetingCue, hasInstrumentCue };
  }
  if (
    kind === "social_governance" ||
    kind === "ideology_party" ||
    kind === "rural_revitalization" ||
    /社会治理|主题教育|乡村振兴/.test(text)
  ) {
    return { role: "social_or_ideology", hasMeetingCue, hasInstrumentCue };
  }
  if (hasInstrumentCue || kind === "implementing_instrument") {
    return { role: "implementing_instrument", hasMeetingCue, hasInstrumentCue };
  }
  if (hasMeetingCue || kind === "leadership_meeting" || kind === "macro_policy" || kind === "dual_circulation") {
    return { role: "direction_meeting", hasMeetingCue, hasInstrumentCue };
  }
  if (kind === "finance_risk" || kind === "industrial_tech_policy" || kind === "economic_data") {
    return { role: "sector_or_risk", hasMeetingCue, hasInstrumentCue };
  }
  return { role: "other", hasMeetingCue, hasInstrumentCue };
}

const ROLE_LABEL: Record<ItemRole, string> = {
  direction_meeting: "方向/会议语",
  implementing_instrument: "细则/工具语",
  sector_or_risk: "行业/风险语",
  diplomatic: "外交语",
  defense_public: "国防公开语",
  social_or_ideology: "社会/党建语",
  other: "其他",
};

export function roleLabelZh(role: ItemRole): string {
  return ROLE_LABEL[role];
}

export function buildSectionCorroborationBoard(opts: {
  sectionId: string;
  label_zh: string;
  items: CorroborationItemSnap[];
}): SectionCorroborationBoard {
  const items = opts.items;
  const maxCorr = items.reduce((m, i) => Math.max(m, i.corr), 0);
  const avgCorr = items.length
    ? Number((items.reduce((a, i) => a + i.corr, 0) / items.length).toFixed(2))
    : 0;
  const rolesPresent = [...new Set(items.map((i) => i.role))];
  const gapSet = new Set<string>();
  for (const i of items) for (const m of i.missing) gapSet.add(m);
  const gaps = [...gapSet];

  const hasDirection = items.some((i) => i.hasMeetingCue || i.role === "direction_meeting");
  const hasInstrument = items.some((i) => i.hasInstrumentCue || i.role === "implementing_instrument");
  const pairable = hasDirection && hasInstrument;

  const next_steps_zh: string[] = [];
  if (!items.length) {
    next_steps_zh.push("本栏暂无条目：补充公开摘录或白名单源");
  } else {
    if (maxCorr < 2) {
      next_steps_zh.push("栏内最高印证 < 2：优先补「方向语 + 细则语」配对或第二公开源");
    }
    if (hasDirection && !hasInstrument) {
      next_steps_zh.push("已有会议/方向语，缺具名通知/办法/细则");
    }
    if (hasInstrument && !hasDirection) {
      next_steps_zh.push("已有工具语，可补对应中央/部委会议或通稿方向语以便对照");
    }
    if (pairable) {
      next_steps_zh.push("栏内已同时具备方向语与工具语：合并跑简报可验证印证是否上升");
    }
    if (items.some((i) => i.substance === "thin")) {
      next_steps_zh.push("存在 substance=thin 条目：优先找带数字/时限/责任主体的公开摘录");
    }
    if (items.some((i) => i.sourceClass === "social_commentary")) {
      next_steps_zh.push("含社交转述：不得单独抬置信度，须换官方/通稿主源");
    }
    for (const g of gaps.slice(0, 3)) {
      next_steps_zh.push(`缺线索汇总：${g}`);
    }
  }

  let pair_hint_zh: string | undefined;
  if (pairable) {
    const a = items.find((i) => i.hasMeetingCue || i.role === "direction_meeting");
    const b = items.find((i) => i.hasInstrumentCue || i.role === "implementing_instrument");
    if (a && b && a.fixtureId !== b.fixtureId) {
      pair_hint_zh = `建议配对：\`${a.fixtureId}\`（方向） + \`${b.fixtureId}\`（细则）`;
    }
  }

  return {
    sectionId: opts.sectionId,
    label_zh: opts.label_zh,
    itemCount: items.length,
    maxCorr,
    avgCorr,
    rolesPresent,
    items,
    gaps,
    next_steps_zh: [...new Set(next_steps_zh)].slice(0, 8),
    pairable,
    pair_hint_zh,
  };
}

export function renderBoardMarkdown(board: SectionCorroborationBoard): string[] {
  const lines = [
    `#### 印证看板 · ${board.label_zh}`,
    "",
    `- 条目 **${board.itemCount}** · 最高印证 **${board.maxCorr}/3** · 平均 **${board.avgCorr}** · 可配对=${board.pairable ? "是" : "否"}`,
    `- 角色覆盖: ${board.rolesPresent.map(roleLabelZh).join("、") || "—"}`,
    "",
  ];
  if (board.items.length) {
    lines.push("| 样例 | 角色 | corr | conf | substance | 缺什么 |");
    lines.push("|------|------|------|------|-----------|--------|");
    for (const i of board.items) {
      lines.push(
        `| \`${i.fixtureId}\` | ${roleLabelZh(i.role)} | ${i.corr} | ${i.conf} | ${i.substance} | ${(i.missing[0] || "—").slice(0, 28)} |`
      );
    }
    lines.push("");
  }
  if (board.pair_hint_zh) {
    lines.push(`- ${board.pair_hint_zh}`);
    lines.push("");
  }
  if (board.next_steps_zh.length) {
    lines.push("**抬升印证的下一步**");
    for (const s of board.next_steps_zh) lines.push(`- ${s}`);
    lines.push("");
  }
  return lines;
}
