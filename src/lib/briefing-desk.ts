/**
 * Civilian briefing desk: fixed portfolio sections for human-review digests.
 * Not an intelligence "desk" / watch floor imitation — topic buckets only.
 */

export const DESK_SECTIONS = [
  "overall_goals",
  "economy_investment",
  "foreign_affairs",
  "defense_public",
  "social_governance",
] as const;

export type DeskSectionId = (typeof DESK_SECTIONS)[number];

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
    id: "overall_goals",
    label_zh: "总体目标",
    label_en: "Overall goals & direction",
    blurb_zh: "中央会议、五年规划、高质量发展等方向性公开表述",
    rx: /中央经济工作会议|中央全会|两会|政府工作报告|十四五|十五五|高质量发展|新质生产力|中国式现代化|新发展格局|双循环|统一大市场/,
    kinds: ["leadership_meeting", "macro_policy", "five_year_plan", "dual_circulation"],
    order: 1,
  },
  {
    id: "economy_investment",
    label_zh: "经济投资",
    label_en: "Economy & investment",
    blurb_zh: "财政货币、产业投资、地方债/房地产、营商与专项资金等公开线索",
    rx: /财政政策|货币政策|扩大内需|稳增长|投资|专项资金|专项债|芯片|半导体|人工智能|专精特新|地方债|房地产|保交楼|化债|制造业|营商环境/,
    kinds: ["industrial_tech_policy", "finance_risk", "economic_data", "implementing_instrument"],
    order: 2,
  },
  {
    id: "foreign_affairs",
    label_zh: "外交",
    label_en: "Foreign affairs",
    blurb_zh: "外交话语、双边关系、一带一路、制裁/合作等公开表述",
    rx: /外交部|外事|一带一路|人类命运共同体|中加|加方|加拿大|制裁|双边|多边|联合国|G7|CPTPP/,
    kinds: ["foreign_affairs"],
    order: 3,
  },
  {
    id: "defense_public",
    label_zh: "国防（公开表述）",
    label_en: "Defense — public discourse only",
    blurb_zh: "国防/军队/军工公开报道与白皮书式语言；非作战情报、非目标跟踪",
    rx: /国防|军队|解放军|军委|军工|武警|演训|战备|国防白皮书|强军|军民融合|海空|航母/,
    kinds: ["defense_public"],
    order: 4,
  },
  {
    id: "social_governance",
    label_zh: "社会治理",
    label_en: "Social governance",
    blurb_zh: "民生、基层治理、舆情、共同富裕、党建教育等公开社会治理表述",
    rx: /社会治理|基层治理|民生|共同富裕|舆情|正能量|和谐稳定|主题教育|意识形态|巡视|乡村振兴|粮食安全|三农/,
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
  rationale: string;
  tag: "hypothesis";
};

function evidenceFor(text: string, rx: RegExp): string | null {
  const m = text.match(rx);
  return m ? m[0].slice(0, 40) : null;
}

export function assignDeskSection(
  sourceText: string,
  opts?: { primaryKind?: string }
): DeskAssignment {
  const text = sourceText || "";
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
    // Extra weight for explicit defense lexicon (often under-tagged by info_triage)
    if (sec.id === "defense_public" && /国防|解放军|军委|强军|军工/.test(text)) {
      score += 0.8;
    }
    if (score > 0) scores.push({ id: sec.id, score, evidence });
  }

  scores.sort((a, b) => b.score - a.score);

  if (!scores.length) {
    return {
      framing: "civilian-briefing-desk-section",
      primary: "overall_goals",
      label_zh: "总体目标",
      label_en: "Overall goals & direction",
      secondary: [],
      evidence: [],
      rationale: "No strong desk cue; default to overall_goals for human refiling.",
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
    evidence: scores[0].evidence.slice(0, 4),
    rationale: `Routed by public-text cues + triage kind. Secondary: ${secondary.join(", ") || "none"}.`,
    tag: "hypothesis",
  };
}

export function deskSectionMeta(id: DeskSectionId): DeskSectionMeta {
  return DESK_CATALOG.find((s) => s.id === id) || DESK_CATALOG[0];
}
