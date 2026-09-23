/**
 * Civilian briefing desk: fixed portfolio sections for human-review digests.
 * Not an intelligence "desk" / watch floor imitation — topic buckets only.
 *
 * Direction-only "总体目标" removed — vague macro slogans are not a desk;
 * CEWC/plan vocabulary routes to economy_investment when substantive.
 * Recurring public hot themes (Taiwan Strait, EVs, China AI, …) aggregate in hot_topics.
 */

export const DESK_SECTIONS = [
  "hot_topics",
  "economy_investment",
  "industrial_tech",
  "foreign_affairs",
  "defense_public",
  "social_governance",
] as const;

export type DeskSectionId = (typeof DESK_SECTIONS)[number];

/** Curated public hot-theme buckets inside the hot_topics channel. */
export const HOT_THEME_IDS = [
  "taiwan_strait",
  "electric_vehicles",
  "china_ai",
  "semiconductors",
  "critical_minerals",
] as const;

export type HotThemeId = (typeof HOT_THEME_IDS)[number];

export type HotThemeHit = {
  id: HotThemeId;
  label_en: string;
  evidence: string;
  tag: "hypothesis";
};

export type HotThemeMeta = {
  id: HotThemeId;
  label_en: string;
  rx: RegExp;
};

export const HOT_THEME_CATALOG: HotThemeMeta[] = [
  {
    id: "taiwan_strait",
    label_en: "Taiwan Strait",
    rx: /台海|两岸|海峡两岸|台湾问题|一个中国|反独促统|金门|马祖|武统|赖清德|民进党|解放军.*台|台.*军演|环台/,
  },
  {
    id: "electric_vehicles",
    label_en: "Electric vehicles",
    rx: /电动汽车|新能源汽车|新能源车|电动车|动力电池|锂电池|充电桩|比亚迪|特斯拉中国|整车出口.*电|汽车出口/,
  },
  {
    id: "china_ai",
    label_en: "China AI",
    rx: /人工智能|大模型|生成式\s*AI|生成式人工智能|ChatGPT|DeepSeek|算力|智算|AI\s*芯片|机器学习|算法备案/,
  },
  {
    id: "semiconductors",
    label_en: "Semiconductors",
    rx: /芯片|半导体|集成电路|晶圆|光刻|先进制程|国产替代.*芯|存储芯片/,
  },
  {
    id: "critical_minerals",
    label_en: "Critical minerals",
    rx: /关键矿产|稀土|锂矿|镍矿|钴矿|石墨出口管制|出口管制.*稀土/,
  },
];

export type DeskSectionMeta = {
  id: DeskSectionId;
  label_zh: string;
  label_en: string;
  blurb_zh: string;
  /** Regex cues for routing public Mandarin text into this section. */
  rx: RegExp;
  /** Preferred info_triage kinds that map here. */
  kinds: string[];
  order: number;
};

export const DESK_CATALOG: DeskSectionMeta[] = [
  {
    id: "hot_topics",
    label_zh: "Hot topics",
    label_en: "Hot topics",
    blurb_zh:
      "Aggregated public hot themes: Taiwan Strait, EVs, China AI, semiconductors, critical minerals — still adoption-gated on hard detail",
    rx: /台海|两岸|台湾问题|电动汽车|新能源汽车|电动车|人工智能|大模型|DeepSeek|芯片|半导体|稀土|关键矿产|出口管制/,
    kinds: [],
    order: 0,
  },
  {
    id: "economy_investment",
    label_zh: "Economy & investment",
    label_en: "Economy & investment",
    blurb_zh:
      "Fiscal/monetary, industrial investment, special funds, local debt/property, meeting→instrument detail (excl. hot-theme AI/EV/chips which route to Hot topics)",
    rx: /财政政策|货币政策|扩大内需|稳增长|投资|专项资金|专项债|专精特新|地方债|房地产|保交楼|化债|制造业|营商环境|中央经济工作会议|政府工作报告|十四五|十五五|高质量发展|新质生产力|双循环|统一大市场|积极的财政|稳健的货币/,
    kinds: [
      "finance_risk",
      "economic_data",
      "implementing_instrument",
      "leadership_meeting",
      "macro_policy",
      "five_year_plan",
      "dual_circulation",
    ],
    order: 1,
  },
  {
    id: "industrial_tech",
    label_zh: "Tech & industry",
    label_en: "Tech & industry",
    blurb_zh:
      "Industrial/tech policy, self-reliance, manufacturing upgrade — chips/AI/EV specifics still route to Hot topics when they hit a hot-theme cue",
    rx: /制造强国|科技自立自强|专精特新|产业政策|数字经济|战略性新兴产业|卡脖子|国产替代|工业和信息化部|工信部|产业链供应链/,
    kinds: ["industrial_tech_policy"],
    order: 2,
  },
  {
    id: "foreign_affairs",
    label_zh: "Foreign affairs",
    label_en: "Foreign affairs",
    blurb_zh: "Diplomatic discourse, bilateral ties, Belt and Road, sanctions/cooperation in open text",
    rx: /外交部|外事|一带一路|人类命运共同体|中加|加方|加拿大|制裁|双边|多边|联合国|G7|CPTPP/,
    kinds: ["foreign_affairs"],
    order: 3,
  },
  {
    id: "defense_public",
    label_zh: "Defense — public discourse only",
    label_en: "Defense — public discourse only",
    blurb_zh:
      "Open defense/military/industry reporting and white-paper style language; not operational intel or targeting",
    rx: /国防|军队|解放军|军委|军工|武警|演训|战备|国防白皮书|强军|军民融合|海空|航母/,
    kinds: ["defense_public"],
    order: 4,
  },
  {
    id: "social_governance",
    label_zh: "Social governance",
    label_en: "Social governance",
    blurb_zh:
      "Livelihood, grassroots governance, education, public opinion, common prosperity, party education — open social-governance language",
    rx: /社会治理|基层治理|民生|共同富裕|舆情|正能量|和谐稳定|主题教育|意识形态|巡视|乡村振兴|粮食安全|三农|教育部|双减|教育改革|职业教育/,
    kinds: ["social_governance", "ideology_party", "rural_revitalization"],
    order: 5,
  },
];

export type DeskAssignment = {
  framing: "civilian-briefing-desk-section";
  primary: DeskSectionId;
  label_zh: string;
  label_en: string;
  secondary: DeskSectionId[];
  evidence: string[];
  /** When primary is hot_topics (or secondary), matched theme tags. */
  hot_themes: HotThemeHit[];
  rationale: string;
  tag: "hypothesis";
};

function evidenceFor(text: string, rx: RegExp): string | null {
  const m = text.match(rx);
  return m ? m[0].slice(0, 40) : null;
}

export function matchHotThemes(sourceText: string): HotThemeHit[] {
  const text = sourceText || "";
  const hits: HotThemeHit[] = [];
  for (const th of HOT_THEME_CATALOG) {
    const ev = evidenceFor(text, th.rx);
    if (!ev) continue;
    hits.push({
      id: th.id,
      label_en: th.label_en,
      evidence: ev,
      tag: "hypothesis",
    });
  }
  return hits.slice(0, 6);
}

export function assignDeskSection(
  sourceText: string,
  opts?: { primaryKind?: string }
): DeskAssignment {
  const text = sourceText || "";
  const hot_themes = matchHotThemes(text);
  const scores: { id: DeskSectionId; score: number; evidence: string[] }[] = [];

  for (const sec of DESK_CATALOG) {
    let score = 0;
    const evidence: string[] = [];
    const ev = evidenceFor(text, sec.rx);
    if (ev) {
      score += 1;
      evidence.push(ev);
    }
    if (opts?.primaryKind && sec.kinds.includes(opts.primaryKind)) {
      score += 1.2;
      evidence.push(`kind:${opts.primaryKind}`);
    }
    if (sec.id === "defense_public" && /国防|解放军|军委|强军|军工/.test(text)) {
      score += 0.8;
    }
    if (sec.id === "hot_topics" && hot_themes.length) {
      score += 2 + Math.min(1.5, hot_themes.length * 0.4);
      evidence.push(...hot_themes.map((h) => `theme:${h.id}`));
    }
    if (score > 0) scores.push({ id: sec.id, score, evidence });
  }

  scores.sort((a, b) => b.score - a.score);

  if (!scores.length) {
    const meta = DESK_CATALOG.find((s) => s.id === "economy_investment")!;
    return {
      framing: "civilian-briefing-desk-section",
      primary: meta.id,
      label_zh: meta.label_zh,
      label_en: meta.label_en,
      secondary: [],
      evidence: [],
      hot_themes: [],
      rationale: "No strong desk cue; default to economy_investment for human refiling.",
      tag: "hypothesis",
    };
  }

  const primary = scores[0].id;
  const meta = DESK_CATALOG.find((s) => s.id === primary)!;
  const secondary = scores.slice(1, 3).map((s) => s.id);

  return {
    framing: "civilian-briefing-desk-section",
    primary,
    label_zh: meta.label_zh,
    label_en: meta.label_en,
    secondary,
    evidence: scores[0].evidence.slice(0, 6),
    hot_themes,
    rationale: hot_themes.length
      ? `Hot-topic channel preferred (${hot_themes.map((h) => h.id).join(", ")}). Secondary: ${secondary.join(", ") || "none"}.`
      : `Routed by public-text cues + triage kind. Secondary: ${secondary.join(", ") || "none"}.`,
    tag: "hypothesis",
  };
}

export function deskSectionMeta(id: DeskSectionId): DeskSectionMeta {
  return DESK_CATALOG.find((s) => s.id === id) || DESK_CATALOG.find((s) => s.id === "economy_investment")!;
}
