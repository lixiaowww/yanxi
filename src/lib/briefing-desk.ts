/**
 * Civilian briefing desk: fixed portfolio sections for human-review digests.
 * Not an intelligence "desk" / watch floor imitation — topic buckets only.
 *
 * Direction-only "总体目标" removed — vague macro slogans are not a desk;
 * CEWC/plan vocabulary routes to economy_investment when substantive.
 */

export const DESK_SECTIONS = [
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
    id: "economy_investment",
    label_zh: "Economy & investment",
    label_en: "Economy & investment",
    blurb_zh:
      "Fiscal/monetary, industrial investment, special funds, local debt/property, meeting→instrument detail (incl. verifiable macro deployments)",
    rx: /财政政策|货币政策|扩大内需|稳增长|投资|专项资金|专项债|芯片|半导体|人工智能|专精特新|地方债|房地产|保交楼|化债|制造业|营商环境|中央经济工作会议|政府工作报告|十四五|十五五|高质量发展|新质生产力|双循环|统一大市场|积极的财政|稳健的货币/,
    kinds: [
      "industrial_tech_policy",
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
    id: "foreign_affairs",
    label_zh: "Foreign affairs",
    label_en: "Foreign affairs",
    blurb_zh: "Diplomatic discourse, bilateral ties, Belt and Road, sanctions/cooperation in open text",
    rx: /外交部|外事|一带一路|人类命运共同体|中加|加方|加拿大|制裁|双边|多边|联合国|G7|CPTPP/,
    kinds: ["foreign_affairs"],
    order: 2,
  },
  {
    id: "defense_public",
    label_zh: "Defense — public discourse only",
    label_en: "Defense — public discourse only",
    blurb_zh:
      "Open defense/military/industry reporting and white-paper style language; not operational intel or targeting",
    rx: /国防|军队|解放军|军委|军工|武警|演训|战备|国防白皮书|强军|军民融合|海空|航母/,
    kinds: ["defense_public"],
    order: 3,
  },
  {
    id: "social_governance",
    label_zh: "Social governance",
    label_en: "Social governance",
    blurb_zh:
      "Livelihood, grassroots governance, public opinion, common prosperity, party education — open social-governance language",
    rx: /社会治理|基层治理|民生|共同富裕|舆情|正能量|和谐稳定|主题教育|意识形态|巡视|乡村振兴|粮食安全|三农/,
    kinds: ["social_governance", "ideology_party", "rural_revitalization"],
    order: 4,
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
    if (sec.id === "defense_public" && /国防|解放军|军委|强军|军工/.test(text)) {
      score += 0.8;
    }
    if (score > 0) scores.push({ id: sec.id, score, evidence });
  }

  scores.sort((a, b) => b.score - a.score);

  if (!scores.length) {
    const meta = DESK_CATALOG[0];
    return {
      framing: "civilian-briefing-desk-section",
      primary: meta.id,
      label_zh: meta.label_zh,
      label_en: meta.label_en,
      secondary: [],
      evidence: [],
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
    evidence: scores[0].evidence.slice(0, 4),
    rationale: `Routed by public-text cues + triage kind. Secondary: ${secondary.join(", ") || "none"}.`,
    tag: "hypothesis",
  };
}

export function deskSectionMeta(id: DeskSectionId): DeskSectionMeta {
  return DESK_CATALOG.find((s) => s.id === id) || DESK_CATALOG[0];
}
