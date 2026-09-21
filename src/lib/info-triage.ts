/**
 * Civilian triage of public-source research items:
 * - kind taxonomy (信息种类)
 * - importance grade (重要性分级)
 *
 * NOT security/intelligence classification markings (SECRET / TS / etc.).
 */

export const INFO_KINDS = [
  "macro_policy",
  "implementing_instrument",
  "industrial_tech_policy",
  "foreign_affairs",
  "defense_public",
  "finance_risk",
  "rural_revitalization",
  "ideology_party",
  "dual_circulation",
  "five_year_plan",
  "social_governance",
  "economic_data",
  "press_commentary",
  "leadership_meeting",
  "local_policy",
  "other_public_text",
] as const;

export type InfoKind = (typeof INFO_KINDS)[number];

export const IMPORTANCE_GRADES = ["P1", "P2", "P3", "P4"] as const;
export type ImportanceGrade = (typeof IMPORTANCE_GRADES)[number];

export type KindHit = {
  kind: InfoKind;
  label_zh: string;
  score: number;
  evidence: string;
};

export type InfoTriage = {
  framing: "civilian-public-source-triage";
  kinds: KindHit[];
  primary_kind: InfoKind;
  importance: {
    grade: ImportanceGrade;
    label_zh: string;
    score_0_to_1: number;
    rationale: string;
    drivers: string[];
    tag: "hypothesis";
  };
  tag: "hypothesis";
};

const KIND_META: Record<InfoKind, { label_zh: string; rx: RegExp; weight: number }> = {
  leadership_meeting: {
    label_zh: "Leadership / central work meeting",
    rx: /中央经济工作会议|中央政治局|中央全会|两会|全国人大|政协|总书记/,
    weight: 1,
  },
  macro_policy: {
    label_zh: "Macro policy direction",
    rx: /高质量发展|稳增长|宏观调控|积极的财政政策|稳健的货币政策|扩大内需|新质生产力/,
    weight: 0.95,
  },
  implementing_instrument: {
    label_zh: "Policy instrument / implementing file",
    rx: /实施细则|实施方案|办法|条例|通知|意见|印发/,
    weight: 0.9,
  },
  industrial_tech_policy: {
    label_zh: "Industrial & tech policy",
    rx: /新质生产力|芯片|半导体|人工智能|专精特新|制造业|关键核心技术|卡脖子/,
    weight: 0.85,
  },
  foreign_affairs: {
    label_zh: "Foreign affairs discourse",
    rx: /一带一路|人类命运共同体|外交部|外事|制裁|南海|台湾/,
    weight: 0.85,
  },
  defense_public: {
    label_zh: "Defense — public discourse",
    rx: /国防|军队|解放军|军委|军工|强军|演训|战备|国防白皮书|军民融合/,
    weight: 0.84,
  },
  finance_risk: {
    label_zh: "Finance & property risk",
    rx: /金融风险|地方债|隐性债务|保交楼|房地产|系统性风险|资本无序扩张|去杠杆/,
    weight: 0.82,
  },
  dual_circulation: {
    label_zh: "Dual circulation / unified market",
    rx: /双循环|国内大循环|国际循环|统一大市场|供应链|产业链|安全可控|国产替代/,
    weight: 0.8,
  },
  five_year_plan: {
    label_zh: "Five-year plan / long-horizon target",
    rx: /五年规划|十四五|十五五|规划纲要|远景目标|二〇三五|2035/,
    weight: 0.78,
  },
  rural_revitalization: {
    label_zh: "Rural revitalization / food security",
    rx: /乡村振兴|三农|耕地|粮食安全|种业|脱贫攻坚|防止返贫|高标准农田|农业农村/,
    weight: 0.76,
  },
  ideology_party: {
    label_zh: "Ideology / party education",
    rx: /意识形态|思想政治工作|主题教育|学习贯彻|二十大|党的建设|全面从严治党|反腐败|巡视/,
    weight: 0.74,
  },
  social_governance: {
    label_zh: "Social governance / livelihood stability",
    rx: /社会和谐稳定|社会治理|正能量|舆情|民生|共同富裕/,
    weight: 0.72,
  },
  economic_data: {
    label_zh: "Economic data / indicators",
    rx: /GDP|同比增长|百分点|居民消费|通胀|失业率|\d+(\.\d+)?%/,
    weight: 0.7,
  },
  press_commentary: {
    label_zh: "Press commentary / editorial style",
    rx: /社论|评论员文章|仲音|任仲平/,
    weight: 0.65,
  },
  local_policy: {
    label_zh: "Local policy",
    rx: /省政府|市委|市政府|自治区|因地制宜|各地各部门/,
    weight: 0.55,
  },
  other_public_text: {
    label_zh: "Other public text",
    rx: /.*/,
    weight: 0.2,
  },
};

function importanceLabel(g: ImportanceGrade): string {
  switch (g) {
    case "P1":
      return "Highest priority (central meeting / front-page open signal + strong instrument or impact cues)";
    case "P2":
      return "High priority (clear policy direction; high tracking value)";
    case "P3":
      return "Medium priority (background value; needs more sources)";
    case "P4":
      return "Low priority (weak signal or fragmentary excerpt)";
  }
}

export function buildInfoTriage(
  sourceText: string,
  opts?: {
    scorecardBand?: "low" | "medium" | "high";
    scorecardTotal?: number;
    /** Extra civilian reader-interest bump (e.g. Canada nexus). */
    readerInterestBump?: number;
    readerInterestDriver?: string;
  }
): InfoTriage {
  const text = sourceText || "";
  const kinds: KindHit[] = [];

  for (const kind of INFO_KINDS) {
    if (kind === "other_public_text") continue;
    const meta = KIND_META[kind];
    if (meta.rx.test(text)) {
      const m = text.match(meta.rx);
      kinds.push({
        kind,
        label_zh: meta.label_zh,
        score: meta.weight,
        evidence: (m?.[0] || kind).slice(0, 40),
      });
    }
  }

  if (!kinds.length) {
    kinds.push({
      kind: "other_public_text",
      label_zh: KIND_META.other_public_text.label_zh,
      score: 0.2,
      evidence: "(no specialty kind matched)",
    });
  }

  kinds.sort((a, b) => b.score - a.score);
  // Prefer implementing-instrument when the excerpt is clearly an 通知/办法 carrying meeting language.
  const instrumentHit = kinds.find((k) => k.kind === "implementing_instrument");
  const meetingHit = kinds.find((k) => k.kind === "leadership_meeting");
  if (
    instrumentHit &&
    meetingHit &&
    /印发|实施细则|实施方案|配套办法/.test(text) &&
    instrumentHit.score >= meetingHit.score - 0.15
  ) {
    kinds.sort((a, b) => {
      if (a.kind === "implementing_instrument") return -1;
      if (b.kind === "implementing_instrument") return 1;
      return b.score - a.score;
    });
  }
  const primary_kind = kinds[0].kind;

  const drivers: string[] = [];
  let score = 0.25;

  if (kinds.some((k) => k.kind === "leadership_meeting")) {
    score += 0.28;
    drivers.push("leadership_meeting");
  }
  if (kinds.some((k) => k.kind === "macro_policy")) {
    score += 0.12;
    drivers.push("macro_policy");
  }
  if (kinds.some((k) => k.kind === "implementing_instrument")) {
    score += 0.14;
    drivers.push("implementing_instrument");
  }
  if (kinds.some((k) => k.kind === "foreign_affairs" || k.kind === "finance_risk" || k.kind === "industrial_tech_policy" || k.kind === "defense_public")) {
    score += 0.06;
    drivers.push("high_salience_domain");
  }
  if (
    kinds.some((k) =>
      ["rural_revitalization", "ideology_party", "dual_circulation", "five_year_plan", "social_governance"].includes(
        k.kind
      )
    )
  ) {
    score += 0.12;
    drivers.push("job_fit_domain_coverage");
  }
  if (/新华社|人民日报|头版|要闻/.test(text)) {
    score += 0.1;
    drivers.push("authoritative_or_front_press_cue");
  }
  if (opts?.scorecardBand === "high") {
    score += 0.08;
    drivers.push("signaling_band_high");
  } else if (opts?.scorecardBand === "medium") {
    score += 0.04;
    drivers.push("signaling_band_medium");
  }
  if ((opts?.scorecardTotal || 0) >= 0.5) {
    score += 0.05;
    drivers.push("signaling_weighted_total>=0.5");
  }
  if (text.length < 80) {
    score -= 0.12;
    drivers.push("short_excerpt_penalty");
  }
  if ((opts?.readerInterestBump || 0) > 0) {
    score += opts!.readerInterestBump!;
    drivers.push(opts?.readerInterestDriver || "reader_interest_bump");
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(3))));
  const grade: ImportanceGrade =
    score >= 0.75 ? "P1" : score >= 0.55 ? "P2" : score >= 0.35 ? "P3" : "P4";

  return {
    framing: "civilian-public-source-triage",
    kinds,
    primary_kind,
    importance: {
      grade,
      label_zh: importanceLabel(grade),
      score_0_to_1: score,
      rationale: `Public-source triage from kind hits [${kinds
        .map((k) => k.kind)
        .join(", ")}] and drivers [${drivers.join(", ") || "none"}]. Not a secrecy marking.`,
      drivers,
      tag: "hypothesis",
    },
    tag: "hypothesis",
  };
}
