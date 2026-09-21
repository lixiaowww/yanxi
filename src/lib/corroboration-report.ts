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
  direction_meeting: "Direction / meeting",
  implementing_instrument: "Implementing instrument",
  sector_or_risk: "Sector / risk",
  diplomatic: "Diplomatic",
  defense_public: "Defense (public)",
  social_or_ideology: "Social / party education",
  other: "Other",
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
    next_steps_zh.push("No items in this column yet — add a public excerpt or whitelist feed");
  } else {
    if (maxCorr < 2) {
      next_steps_zh.push(
        "Max corroboration < 2: prioritize direction+instrument pairing or a second public source"
      );
    }
    if (hasDirection && !hasInstrument) {
      next_steps_zh.push("Has meeting/direction language; missing named notice/measure/detail");
    }
    if (hasInstrument && !hasDirection) {
      next_steps_zh.push(
        "Has instrument language; add matching central/ministry meeting or wire direction for contrast"
      );
    }
    if (pairable) {
      next_steps_zh.push(
        "Column already has direction + instrument: merge-run a brief to check if corroboration rises"
      );
    }
    if (items.some((i) => i.substance === "thin")) {
      next_steps_zh.push(
        "Has substance=thin items: prefer public excerpts with numbers/deadlines/responsible bodies"
      );
    }
    if (items.some((i) => i.sourceClass === "social_commentary")) {
      next_steps_zh.push(
        "Includes social commentary: do not raise confidence alone; swap in official/wire primary"
      );
    }
    for (const g of gaps.slice(0, 3)) {
      next_steps_zh.push(`Gap summary: ${g}`);
    }
  }

  let pair_hint_zh: string | undefined;
  if (pairable) {
    const a = items.find((i) => i.hasMeetingCue || i.role === "direction_meeting");
    const b = items.find((i) => i.hasInstrumentCue || i.role === "implementing_instrument");
    if (a && b && a.fixtureId !== b.fixtureId) {
      pair_hint_zh = `Suggested pair: \`${a.fixtureId}\` (direction) + \`${b.fixtureId}\` (instrument)`;
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
    `#### Corroboration board · ${board.label_zh}`,
    "",
    `- Items **${board.itemCount}** · max corr **${board.maxCorr}/3** · avg **${board.avgCorr}** · pairable=${board.pairable ? "yes" : "no"}`,
    `- Roles: ${board.rolesPresent.map(roleLabelZh).join(", ") || "—"}`,
    "",
  ];
  if (board.items.length) {
    lines.push("| Fixture | Role | corr | conf | substance | Missing |");
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
    lines.push("**Next steps to raise corroboration**");
    for (const s of board.next_steps_zh) lines.push(`- ${s}`);
    lines.push("");
  }
  return lines;
}
