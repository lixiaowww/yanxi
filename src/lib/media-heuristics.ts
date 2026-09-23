/**
 * Public PRC media/reporting heuristics (“潜规则” as civilian research slang).
 * Enumerate first, then weight-score. Not classified knowledge; all tags hypothesis.
 */

export type HeuristicStatus = "hit" | "miss" | "unclear";

export type HeuristicRuleDef = {
  id: string;
  category:
    | "sequence"
    | "implementing_detail"
    | "press_placement"
    | "speech_verbs"
    | "attribution"
    | "concreteness"
    | "rollout_scope"
    | "tone_framing"
    | "diplomatic_severity";
  label_zh: string;
  label_en: string;
  /** Relative importance among valves; should sum ≈ 1.0 across catalog. */
  weight: number;
  detect: (text: string) => HeuristicStatus;
};

export type ScoredHeuristic = {
  id: string;
  category: string;
  label_zh: string;
  label_en: string;
  weight: number;
  status: HeuristicStatus;
  /** 0–1 contribution before weight; hit=1, unclear=0.4, miss=0 */
  raw_score: number;
  /** weight * raw_score */
  weighted_score: number;
  tag: "hypothesis";
};

export type SignalingScorecard = {
  method: "enumerate-then-weight";
  framing: "civilian-public-media-heuristics";
  rules: ScoredHeuristic[];
  /** Internal ordering totals (hand-set weights, never calibrated). Do not render to a human — show `band`. */
  weighted_total: number;
  weight_sum: number;
  band: "low" | "medium" | "high";
  calibration: string;
  tag: "hypothesis";
};

function statusScore(s: HeuristicStatus): number {
  if (s === "hit") return 1;
  if (s === "unclear") return 0.4;
  return 0;
}

function has(text: string, rx: RegExp): boolean {
  return rx.test(text);
}

/** Full catalog — keep in sync with skills/context-cards/policy-signaling-valves.md */
export const MEDIA_HEURISTICS: HeuristicRuleDef[] = [
  // --- sequence / 先后顺序 ---
  {
    id: "seq-party-before-state",
    category: "sequence",
    label_zh: "党的机关表述先于国务院/部委表述",
    label_en: "Party framing appears before State Council/ministry framing",
    weight: 0.08,
    detect: (t) => {
      const party = t.search(/党中央|中共中央|党的/);
      const state = t.search(/国务院|各部委|有关部门/);
      if (party < 0 && state < 0) return "unclear";
      if (party >= 0 && state >= 0) return party <= state ? "hit" : "miss";
      return party >= 0 ? "hit" : "unclear";
    },
  },
  {
    id: "seq-meeting-to-document",
    category: "sequence",
    label_zh: "会议语言→文件语言的阶段线索",
    label_en: "Meeting-language vs document-stage cues",
    weight: 0.07,
    detect: (t) =>
      has(t, /会议|公报|纪要/) ? (has(t, /印发|出台|发布|通知|意见/) ? "hit" : "miss") : "unclear",
  },
  {
    // Protocol precedence (docs/DP-V3.md §4, "协议排序"): names/titles in
    // official PRC bulletins follow a fixed rank
    // (总书记 > 国家主席 > 总理 > 常务副总理 > 人大委员长 > 政协主席 > 中纪委书记 > 书记处首位书记),
    // not appearance order chosen by the writer. This rule only checks that
    // ≥2 ranked titles co-occur (i.e. there's something to compare). It does
    // NOT detect an actual order change — that needs a prior comparable
    // bulletin to diff against, which requires collection history (see
    // task #7, deferred until real collect runs exist). A human reviewer
    // with two bulletins in hand should compare title order by eye.
    id: "seq-leader-title-order",
    category: "sequence",
    label_zh: "领导人/机构称谓排序可观察（协议序位；比较排序变化需要历史通稿，本轮暂不做）",
    label_en: "Observable leader/institution title ordering (protocol precedence; order-CHANGE detection needs a prior bulletin, not implemented yet)",
    weight: 0.04,
    detect: (t) => {
      const titles = t.match(/总书记|国家主席|总理|人大常委会委员长|政协主席|中央纪委书记|书记处书记|主任|部长/g) || [];
      return titles.length >= 2 ? "hit" : titles.length === 1 ? "unclear" : "unclear";
    },
  },

  // --- implementing detail / 细则 ---
  {
    id: "detail-named-instrument",
    category: "implementing_detail",
    label_zh: "出现意见/通知/办法/条例/细则等工具文件名",
    label_en: "Named implementing instrument (意见/通知/办法/条例/细则)",
    weight: 0.12,
    detect: (t) => (has(t, /实施细则|实施方案|办法|条例|通知|意见/) ? "hit" : "miss"),
  },
  {
    id: "detail-promised-later",
    category: "implementing_detail",
    label_zh: "承诺另行制定细则但本文未附",
    label_en: "Promises later detailed rules without attaching them",
    weight: 0.05,
    detect: (t) => (has(t, /另行制定|具体办法|细则另行|另行公布/) ? "hit" : "unclear"),
  },
  {
    id: "detail-slogan-only",
    category: "implementing_detail",
    label_zh: "仅有强调/坚持/推动等方向语、无工具文件",
    label_en: "Direction verbs only; no implementing instrument",
    weight: 0.06,
    detect: (t) => {
      const slogan = has(t, /强调|坚持|推动|抓好|持续/);
      const instrument = has(t, /实施细则|实施方案|办法|条例|通知|意见/);
      if (!slogan && !instrument) return "unclear";
      return slogan && !instrument ? "hit" : "miss";
    },
  },

  // --- press placement / 报刊位置 ---
  {
    id: "press-xinhua-wire",
    category: "press_placement",
    label_zh: "新华社电头",
    label_en: "Xinhua wire dateline",
    weight: 0.07,
    detect: (t) => (has(t, /新华社/) ? "hit" : "unclear"),
  },
  {
    id: "press-peoples-daily",
    category: "press_placement",
    label_zh: "人民日报署名/转载线索",
    label_en: "People's Daily byline/reprint cue",
    weight: 0.06,
    detect: (t) => (has(t, /人民日报/) ? "hit" : "unclear"),
  },
  {
    id: "press-front-page",
    category: "press_placement",
    label_zh: "头版/要闻位置明示",
    label_en: "Explicit front-page / 要闻 placement",
    weight: 0.08,
    detect: (t) => (has(t, /头版|要闻/) ? "hit" : "unclear"),
  },
  {
    id: "press-editorial-genre",
    category: "press_placement",
    label_zh: "社论/评论员文章文体",
    label_en: "Editorial / commentator genre",
    weight: 0.07,
    detect: (t) => (has(t, /社论|评论员文章|仲音/) ? "hit" : "unclear"),
  },
  {
    // Authority ladder of coded People's Daily/party-media bylines — each
    // name is a homophone/pun marking a specific institutional level, not a
    // real author. 任仲平="人民日报重要评论" (writing-group collective, major
    // reform topics); 钟声="中国之声" (int'l affairs, critical of another
    // state); 国纪平="国际重要评论" (central-consensus int'l commentary);
    // 金观平="经济日报观察评论" (State-Council-affiliated economic consensus).
    // "宣言" deliberately excluded — too common a word standalone to use as
    // a substring cue without false positives. Sources: China Media Project
    // ("Pen Names, Stern Warnings", 2025-03-25), 任仲平百度百科.
    id: "press-authoritative-byline",
    category: "press_placement",
    label_zh: "党媒权威笔名（任仲平/钟声/国纪平/金观平）——高于普通署名的机构级信号",
    label_en: "Coded party-media authority byline (任仲平/钟声/国纪平/金观平) — institutional-level signal, not an ordinary byline",
    weight: 0.09,
    detect: (t) => (has(t, /任仲平|钟声|国纪平|金观平|秋石/) ? "hit" : "unclear"),
  },

  // --- speech verbs ---
  {
    id: "verb-hierarchy-cues",
    category: "speech_verbs",
    label_zh: "指出/强调/要求等话语动词可分级阅读",
    label_en: "Speech-verb hierarchy cues (指出/强调/要求)",
    weight: 0.05,
    detect: (t) => (has(t, /指出|强调|要求|重申|部署/) ? "hit" : "unclear"),
  },

  // --- attribution ---
  {
    id: "attr-collective-center",
    category: "attribution",
    label_zh: "以党中央/会议集体归因而非个人演说",
    label_en: "Collective center/meeting attribution vs personal speech",
    weight: 0.04,
    detect: (t) =>
      has(t, /党中央|中央经济工作会议|会议指出|会议强调/)
        ? "hit"
        : has(t, /我[在讲]|个人认为/)
          ? "miss"
          : "unclear",
  },
  {
    id: "attr-ministry-issuer",
    category: "attribution",
    label_zh: "部委作为发文主体可识别",
    label_en: "Identifiable ministry as issuing body",
    weight: 0.04,
    detect: (t) => (has(t, /部昨日|部印发|总局|央行|发改委|工信部|财政部|商务部/) ? "hit" : "unclear"),
  },
  {
    // "亲自X" personal-involvement framing was rare for post-Mao paramount
    // leaders before Xi; CCP media have since used it to mark policies as
    // personally directed by him, not collectively decided. Asia Society
    // Policy Institute's "Xi's Personal Priorities" project used this exact
    // phrase pattern (亲自谋划/亲自部署/亲自推动 and variants) to identify
    // ~88 distinct policies. A hit here is a personalized-leadership signal,
    // not evidence the policy is more or less likely to happen.
    id: "attr-personal-leadership",
    category: "attribution",
    label_zh: "\"亲自\"个人化领导信号（亲自谋划/部署/推动/主持/出席）",
    label_en: "\"亲自\" (personally) personalized-leadership framing",
    weight: 0.05,
    detect: (t) => (has(t, /亲自谋划|亲自部署|亲自推动|亲自主持|亲自出席|亲自指挥|亲自决策/) ? "hit" : "unclear"),
  },

  // --- concreteness ---
  {
    id: "conc-numeric-targets",
    category: "concreteness",
    label_zh: "出现可核验数字目标/指标",
    label_en: "Verifiable numeric targets present",
    weight: 0.06,
    detect: (t) => (has(t, /\d+(\.\d+)?%|\d+亿|\d+万|不低于|左右/) ? "hit" : "miss"),
  },
  {
    id: "conc-timeline",
    category: "concreteness",
    label_zh: "出现明确时间表/年份节点",
    label_en: "Explicit timeline / year nodes",
    weight: 0.04,
    detect: (t) => (has(t, /\d{4}年|年底前|年内|“十四五”|“十五五”|到\d{4}/) ? "hit" : "unclear"),
  },

  // --- rollout scope ---
  {
    id: "scope-pilot-vs-national",
    category: "rollout_scope",
    label_zh: "试点/先行 vs 全国推开用语",
    label_en: "Pilot vs nationwide rollout language",
    weight: 0.04,
    detect: (t) =>
      has(t, /试点|先行先试|示范区/) ? "hit" : has(t, /全国范围|全面推开|各地要/) ? "hit" : "unclear",
  },

  // --- tone framing ---
  {
    id: "tone-stability-prosperity",
    category: "tone_framing",
    label_zh: "稳定/安全与发展话语同现",
    label_en: "Stability/security co-occurs with development framing",
    weight: 0.03,
    detect: (t) => {
      const stab = has(t, /稳定|安全|风险|忧患/);
      const grow = has(t, /发展|增长|回升|改革/);
      if (stab && grow) return "hit";
      if (stab || grow) return "unclear";
      return "miss";
    },
  },
  {
    // Minimization register: "个别/极少数/不代表整体" deliberately frames an
    // event as non-systemic. Source: the supplied 潜规则 research doc
    // (docs/DP-V3.md §4), synthesizing censorship/framing literature.
    id: "tone-minimize-language",
    category: "tone_framing",
    label_zh: "弱化措辞（个别/极少数/不代表整体）— 刻意降低事件系统性",
    label_en: "Minimization wording (个别/极少数/不代表整体) — frames an event as non-systemic",
    weight: 0.04,
    detect: (t) => (has(t, /个别|极少数|不代表整体|局部现象/) ? "hit" : "unclear"),
  },
  {
    // Resolve register: "坚决维护/严厉打击/高度重视" demonstrates control and
    // political will rather than describing a specific measure. Same source.
    id: "tone-resolve-language",
    category: "tone_framing",
    label_zh: "强化措辞（坚决维护/严厉打击/高度重视）— 展示管控能力和政治决心",
    label_en: "Resolve wording (坚决维护/严厉打击/高度重视) — demonstrates control/political will, not a specific measure",
    weight: 0.04,
    detect: (t) => (has(t, /坚决维护|严厉打击|高度重视|坚决防止|绝不允许/) ? "hit" : "unclear"),
  },

  // --- diplomatic severity / 外交措辞升级 ---
  {
    // Escalation ladder from lowest to highest severity: 关切 < 严重关切 <
    // 谴责 < 强烈谴责 < 抗议 < 严重抗议 < 极大的愤慨. This rule only flags
    // that SOME rung of the ladder is present — it does not itself rank
    // which rung, that's for a human reading the matched evidence. Source:
    // Gao Yang, "How to Understand Diplomacy Through PRC Diplomatic Jargon"
    // (David Cowhig's Translation Blog, 2020/2025).
    id: "diplo-severity-ladder",
    category: "diplomatic_severity",
    label_zh: "外交措辞升级阶梯命中（关切→严重关切→谴责→强烈谴责→抗议→严重抗议）",
    label_en: "Diplomatic severity-ladder phrase present (concern → serious concern → condemn → strongly condemn → protest → serious protest)",
    weight: 0.05,
    detect: (t) =>
      has(t, /严重抗议|强烈谴责|严重关切|极大的愤慨|表示遗憾|谴责|抗议|关切/) ? "hit" : "unclear",
  },
  {
    // Meeting-outcome euphemism ladder, weakest to strongest result:
    // 交换了意见 < 坦率交谈 < 充分交换了意见 < 增进了了解 < 有益的会谈 <
    // 亲切友好的交谈 < 建设性对话 < 态度积极气氛良好. Same source as above.
    id: "diplo-outcome-euphemism",
    category: "diplomatic_severity",
    label_zh: "会谈成果委婉语阶梯命中（交换意见→坦率交谈→建设性对话→亲切友好）",
    label_en: "Meeting-outcome euphemism ladder present (exchanged views → candid talk → constructive dialogue → cordial)",
    weight: 0.04,
    detect: (t) =>
      has(t, /建设性对话|亲切友好|坦率交谈|增进了了解|态度是积极的|交换了意见/) ? "hit" : "unclear",
  },
];

export function buildSignalingScorecard(sourceText: string): SignalingScorecard {
  const text = sourceText || "";
  const rules: ScoredHeuristic[] = MEDIA_HEURISTICS.map((r) => {
    const status = r.detect(text);
    const raw_score = statusScore(status);
    return {
      id: r.id,
      category: r.category,
      label_zh: r.label_zh,
      label_en: r.label_en,
      weight: r.weight,
      status,
      raw_score,
      weighted_score: Number((r.weight * raw_score).toFixed(4)),
      tag: "hypothesis",
    };
  });

  const weight_sum = Number(rules.reduce((a, r) => a + r.weight, 0).toFixed(4));
  const weighted_total = Number(rules.reduce((a, r) => a + r.weighted_score, 0).toFixed(4));
  const normalized = weight_sum > 0 ? weighted_total / weight_sum : 0;
  const band: SignalingScorecard["band"] =
    normalized >= 0.55 ? "high" : normalized >= 0.3 ? "medium" : "low";

  const hits = rules.filter((r) => r.status === "hit").length;
  const misses = rules.filter((r) => r.status === "miss").length;
  const unclear = rules.filter((r) => r.status === "unclear").length;

  return {
    method: "enumerate-then-weight",
    framing: "civilian-public-media-heuristics",
    rules,
    weighted_total,
    weight_sum,
    band,
    calibration: `Enumerated ${rules.length} public-media heuristics; observed=${hits}, absent=${misses}, unclear=${unclear} → band=${band}. Weights are hand-set editorial priors with no labelled corpus and no held-out validation: the band orders and flags, it does not measure. Hypothesis only — not proof of intent.`,
    tag: "hypothesis",
  };
}

/** Compact three-valve summary derived from the full scorecard. */
export function valvesFromScorecard(card: SignalingScorecard) {
  const byCat = (cat: string) => card.rules.filter((r) => r.category === cat);
  const summarize = (cat: string, label: string) => {
    const rows = byCat(cat);
    const hit = rows.filter((r) => r.status === "hit").map((r) => r.label_zh);
    const miss = rows.filter((r) => r.status === "miss").map((r) => r.label_zh);
    const status =
      hit.length > 0 ? "observed" : miss.length > 0 ? "absent" : "unclear";
    return {
      status,
      observation: `${label}: hit[${hit.join("; ") || "—"}] miss[${miss.join("; ") || "—"}]`,
      reading: `Category roll-up from enumerated heuristics (hypothesis).`,
      tag: "hypothesis" as const,
    };
  };

  return {
    sequence: summarize("sequence", "先后顺序"),
    implementing_detail: summarize("implementing_detail", "政策细则"),
    press_placement: summarize("press_placement", "报刊位置"),
    calibration: card.calibration,
  };
}

export function confidenceFromBand(band: SignalingScorecard["band"]): "low" | "medium" | "high" {
  return band;
}
