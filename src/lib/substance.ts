/**
 * Strip formulaic party-speak (党八股) and surface verifiable "substance" cues
 * in public Mandarin policy/media text. Civilian research aid — not mind-reading.
 *
 * Cue detection (which drives the substance band and the adoption gate) is
 * deliberately unchanged; what each nugget *carries* now comes from
 * `facts.ts`: the extracted value itself plus an English rendering and a
 * clause-bounded quote, instead of an arbitrary ±18-character window.
 */

import {
  evidenceSpan,
  extractFacts,
  glossPhrase,
  type ExtractedFact,
  type FactKind,
  type FactSet,
} from "./facts.js";

export type SubstanceKind =
  | "numeric_target"
  | "timeline"
  | "named_instrument"
  | "responsible_body"
  | "pilot_or_scope"
  | "constraint_or_ban"
  | "resource_or_funding"
  | "named_sector_or_place"
  | "delta_or_priority_shift"
  | "official_action"
  | "named_campaign";

export type SubstanceNugget = {
  kind: SubstanceKind;
  label_zh: string;
  /** Clause-bounded exact substring of the paste (readable evidence). */
  evidence: string;
  /** The extracted value verbatim, e.g. "2亿元" / "2026年底前". */
  value_zh: string;
  /** English rendering of the value, e.g. "no less than RMB 200 million". */
  value_en: string;
  tag: "hypothesis";
};

export type BoilerplateHit = {
  cue: string;
  evidence: string;
};

export type SubstanceCut = {
  framing: "civilian-boilerplate-vs-substance";
  method: "strip-formula-then-list-verifiables";
  /**
   * Internal only: rough share of chars covered by known formula phrases. The 3-decimal
   * precision is an artifact of the division, not a measurement — never render it.
   */
  boilerplate_ratio_0_to_1: number;
  /**
   * Internal ordering number from hand-set cue weights; the thresholds behind `band` were
   * chosen by eye, never fitted to labelled data. Show `band` to a human, never this.
   */
  substance_score_0_to_1: number;
  band: "thin" | "mixed" | "dense";
  label_zh: string;
  nuggets: SubstanceNugget[];
  boilerplate_hits: BoilerplateHit[];
  empty_calories: string[];
  analyst_prompt_zh: string;
  calibration: string;
  tag: "hypothesis";
};

const BOILERPLATE: { cue: string; rx: RegExp }[] = [
  { cue: "习近平新时代中国特色社会主义思想", rx: /习近平新时代中国特色社会主义思想/ },
  { cue: "以习近平同志为核心", rx: /以习近平同志为核心/ },
  { cue: "两个确立|两个维护", rx: /两个确立|两个维护/ },
  { cue: "四个意识|四个自信", rx: /四个意识|四个自信/ },
  { cue: "伟大复兴|中国梦", rx: /中华民族伟大复兴|中国梦/ },
  { cue: "高质量发展", rx: /高质量发展/ },
  { cue: "新发展理念", rx: /新发展理念/ },
  { cue: "统筹发展和安全", rx: /统筹发展和安全/ },
  { cue: "坚持…推动…抓好", rx: /坚持(?!党的领导.{0,6}制度)[^。]{0,8}(推动|抓好|持续)/ },
  { cue: "深入贯彻落实", rx: /深入贯彻落实|全面贯彻落实|认真贯彻落实/ },
  { cue: "提高政治站位", rx: /提高政治站位|增强四个意识/ },
  { cue: "凝心聚力|砥砺前行", rx: /凝心聚力|砥砺前行|奋勇前进|再创辉煌/ },
  { cue: "人民至上|以人民为中心", rx: /人民至上|以人民为中心/ },
  { cue: "强调指出要求", rx: /会议强调|会议指出|强调要|指出要|要求各/ },
  { cue: "社会和谐稳定", rx: /社会和谐稳定|安定团结/ },
  { cue: "正能量", rx: /正能量|主旋律/ },
];

type Detector = {
  kind: SubstanceKind;
  label_zh: string;
  rx: RegExp;
  /** Keep capture group or full match as evidence window. */
  max?: number;
};

const SUBSTANCE: Detector[] = [
  {
    kind: "numeric_target",
    label_zh: "Verifiable number / share",
    rx: /\d+(\.\d+)?\s*(%|％|个百分点|亿|万亿|万人|万吨|亿元|万亿元|倍)/g,
  },
  {
    kind: "timeline",
    label_zh: "Timeline / year marker",
    rx: /(到|于|自)?\d{4}\s*年(底|前|以来)?|(「|“)?十四五(」|”)?|(「|“)?十五五(」|”)?|本月底|年内|季度|月内|限期/g,
  },
  {
    kind: "named_instrument",
    label_zh: "Named policy instrument",
    rx: /实施细则|实施方案|管理办法|配套办法|办法|条例|通知|意见|目录|清单|白皮书|行动计划|试点方案/g,
  },
  {
    kind: "responsible_body",
    label_zh: "Responsible body / issuer",
    rx: /国务院办公厅|国家发改委|工业和信息化部|商务部|外交部|财政部|中国人民银行|农业农村部|各省级人民政府|有关部门要/g,
  },
  {
    kind: "pilot_or_scope",
    label_zh: "Pilot / scope boundary",
    rx: /试点|先行先试|全国推开|分批|局部|在.+范围|重点地区|重点行业/g,
  },
  {
    kind: "constraint_or_ban",
    label_zh: "Constraint / ban / red line",
    rx: /不得|严禁|禁止|红线|底线|坚决守住|一律不得|严肃查处|问责/g,
  },
  {
    kind: "resource_or_funding",
    label_zh: "Funding / resource line",
    rx: /专项资金|财政支持|贴息|补贴|拨款|额度|债券|专项债|预算安排/g,
  },
  {
    kind: "named_sector_or_place",
    label_zh: "Named sector / place",
    // Curated hot-theme sectors, plus a general administrative-division
    // catch-all (省/自治区/市/自治州/地区/县/区) so any China dateline or
    // provincial/city mention counts as a named place — not just the
    // hand-picked macro-policy sectors below. See docs/DP-V2.md (2026-09-23
    // "detail redefinition"): objective, specific facts are not limited to
    // policy-instrument vocabulary.
    rx: /芯片|半导体|人工智能|房地产|地方债|菜籽|稀土|粤港澳|长三角|京津冀|东北|新疆|西藏|台湾|南海|[一-龥]{2,6}(省|自治区|自治州|市|地区|县|区)/g,
  },
  {
    kind: "delta_or_priority_shift",
    label_zh: "Priority / wording shift cue",
    rx: /首次|更加突出|把.+放在|优先|重中之重|从.+转向|不再|淡化|暂缓|加力|加码/g,
  },
  {
    // Objective, specific, officially-reported occurrences that are not
    // policy-instrument language: personnel appointments/dismissals,
    // discipline/investigation actions, diplomatic meetings, launches and
    // openings, awards/results. These are "detail" in the same sense a
    // funding line is — a named subject did a specific, checkable thing —
    // just not about a policy document. Deliberately excludes vague
    // reporting verbs like 强调/指出/要求 (see BOILERPLATE above): those
    // carry no checkable action on their own. docs/DP-V2.md (2026-09-23).
    kind: "official_action",
    label_zh: "Official action / appointment / discipline / diplomatic readout",
    rx: /任命|免去.{0,6}职务|正式免职|调任|当选|连任|辞去.{0,6}职务|挂职|接受.{0,4}审查调查|立案审查|立案侦查|双开|开除党籍|开除公职|撤销.{0,6}职务|留党察看|党内警告|批准逮捕|提起公诉|一审判决|获刑|会见|会晤|正式访问|签署.{0,10}(协议|备忘录|合作)|成功发射|发射成功|发射升空|圆满成功|首飞|下水|交付使用|正式投产|正式开业|正式启用|揭牌|正式开工|竣工|启动仪式|论坛.{0,4}举办|颁奖仪式|颁授.{0,6}(奖章|证书|勋章)|授称|荣获|获得.{0,6}(冠军|奖|奖项)|夺得|摘得/g,
  },
  {
    // Named, dated ideological/educational/awareness campaigns — distinct
    // from official_action (a one-off transactional act): a sustained
    // messaging activity with a specific name and target, e.g. a youth
    // cybersecurity-literacy week. The campaign's existence and stated
    // target audience are themselves checkable facts, same as any other
    // detail — the interpretation of what the campaign signals belongs in
    // analysis/forecast, not the intake gate. docs/DP-V2.md (2026-09-23).
    kind: "named_campaign",
    label_zh: "Named ideological/educational campaign or activity",
    rx: /网络安全周|安全生产月|宪法宣传周|国家安全教育日|普法宣传周|主题教育活动|专项行动|巡回宣讲|进校园活动|进社区活动|进企业活动|进农村活动|培训班|学习班|观摩活动|文明实践.{0,6}活动|宣传月|宣传周/g,
  },
];

/** Last-resort English descriptions when a cue has no translatable value. */
const CUE_FALLBACK_EN: Record<SubstanceKind, string> = {
  numeric_target: "a numeric figure (see quoted excerpt)",
  timeline: "a time marker (see quoted excerpt)",
  named_instrument: "a policy instrument (see quoted excerpt)",
  responsible_body: "an issuing body (see quoted excerpt)",
  pilot_or_scope: "a pilot or scope boundary (see quoted excerpt)",
  constraint_or_ban: "a constraint or red line (see quoted excerpt)",
  resource_or_funding: "a funding or resource line (see quoted excerpt)",
  named_sector_or_place: "a named sector or place (see quoted excerpt)",
  delta_or_priority_shift: "a priority or wording-shift cue (see quoted excerpt)",
  official_action: "a named official action (see quoted excerpt)",
  named_campaign: "a named campaign or activity (see quoted excerpt)",
};

/** Which extracted fact kinds can supply the value for a given cue kind. */
const FACT_KINDS_FOR_CUE: Record<SubstanceKind, FactKind[]> = {
  numeric_target: ["quantity", "money"],
  timeline: ["deadline"],
  named_instrument: ["instrument"],
  responsible_body: ["actor"],
  pilot_or_scope: ["scope"],
  constraint_or_ban: ["prohibition"],
  resource_or_funding: ["money"],
  named_sector_or_place: ["subject"],
  delta_or_priority_shift: [],
  official_action: ["actor"],
  named_campaign: [],
};

/**
 * Render the value a cue carries. Kept distinct per cue kind so a single
 * funding clause no longer produces four nuggets that all repeat each other:
 * the numeric cue shows the amount, the funding cue shows the vehicle.
 */
function cueValue(
  kind: SubstanceKind,
  raw: string,
  fact: ExtractedFact | null
): { value_zh: string; value_en: string } {
  if (fact) {
    if (kind === "numeric_target" && fact.kind === "money" && fact.amount_en) {
      return { value_zh: fact.value_zh, value_en: fact.amount_en };
    }
    if (kind === "resource_or_funding" && fact.kind === "money" && fact.vehicle_en) {
      return {
        value_zh: raw,
        value_en: fact.amount_en ? `${fact.vehicle_en} (${fact.amount_en})` : fact.vehicle_en,
      };
    }
    return { value_zh: fact.value_zh, value_en: fact.value_en };
  }
  // Never leak Mandarin into an analyst-facing label: the Chinese stays in
  // value_zh and the English falls back to a generic cue description.
  const glossed = glossPhrase(raw);
  return { value_zh: raw, value_en: glossed.en || CUE_FALLBACK_EN[kind] };
}

/**
 * Pick the extracted fact that best explains this cue match: an overlapping
 * span first, then the nearest fact of a compatible kind in the same clause.
 */
function factForMatch(
  facts: FactSet,
  kind: SubstanceKind,
  index: number,
  len: number,
  clause: string
): ExtractedFact | null {
  const wanted = FACT_KINDS_FOR_CUE[kind];
  if (!wanted.length) return null;
  const candidates = facts.facts.filter((f) => wanted.includes(f.kind));
  const overlapping = candidates.find(
    (f) => index < f.index + f.value_zh.length && index + len > f.index
  );
  if (overlapping) return overlapping;
  const sameClause = candidates
    .filter((f) => clause.includes(f.value_zh))
    .sort((a, b) => Math.abs(a.index - index) - Math.abs(b.index - index));
  return sameClause[0] || null;
}

function collectBoilerplate(text: string): { hits: BoilerplateHit[]; covered: number } {
  const hits: BoilerplateHit[] = [];
  let covered = 0;
  for (const row of BOILERPLATE) {
    const m = text.match(row.rx);
    if (!m) continue;
    hits.push({ cue: row.cue, evidence: m[0].slice(0, 40) });
    covered += m[0].length;
  }
  return { hits: hits.slice(0, 12), covered: Math.min(covered, text.length) };
}

function collectNuggets(text: string, facts: FactSet): SubstanceNugget[] {
  const out: SubstanceNugget[] = [];
  const seen = new Set<string>();
  for (const det of SUBSTANCE) {
    const rx = new RegExp(det.rx.source, det.rx.flags.includes("g") ? det.rx.flags : det.rx.flags + "g");
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = rx.exec(text)) !== null && n < 4) {
      // Dedupe on the raw cue match so band + adoption scoring stay stable.
      const key = `${det.kind}:${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const clause = evidenceSpan(text, m.index, m[0].length);
      const fact = factForMatch(facts, det.kind, m.index, m[0].length, clause);
      out.push({
        kind: det.kind,
        label_zh: det.label_zh,
        evidence: fact ? fact.quote : clause,
        ...cueValue(det.kind, m[0], fact),
        tag: "hypothesis",
      });
      n += 1;
    }
  }
  return out.slice(0, 16);
}

function emptyCalories(text: string, nuggets: SubstanceNugget[]): string[] {
  const notes: string[] = [];
  if (/强调|坚持|推动|抓好/.test(text) && !nuggets.some((n) => n.kind === "named_instrument")) {
    notes.push("Many direction verbs, few named instruments → posture language; wait for implementing detail");
  }
  if (/高质量发展|新质生产力/.test(text) && !nuggets.some((n) => n.kind === "numeric_target" || n.kind === "timeline")) {
    notes.push("Macro slogans without numbers/timelines → vocabulary only, not delivery");
  }
  if (/正能量|主旋律|意识形态|主题教育/.test(text) && nuggets.length < 2) {
    notes.push("High propaganda/education share → mobilization signal; little policy-instrument substance");
  }
  if (!nuggets.length) {
    notes.push("No verifiable detail cues → keep confidence low and list public sources still needed");
  }
  return notes.slice(0, 5);
}

export function buildSubstanceCut(sourceText: string, facts?: FactSet): SubstanceCut {
  const text = sourceText || "";
  const { hits: boilerplate_hits, covered } = collectBoilerplate(text);
  const nuggets = collectNuggets(text, facts ?? extractFacts(text));
  const boilerplate_ratio_0_to_1 =
    text.length > 0 ? Number(Math.min(1, covered / Math.max(text.length, 1)).toFixed(3)) : 0;

  // Density: each nugget kind counts; duplicates already capped.
  const kinds = new Set(nuggets.map((n) => n.kind));
  const substance_score_0_to_1 = Number(
    Math.min(1, kinds.size * 0.12 + nuggets.length * 0.04).toFixed(3)
  );

  const band: SubstanceCut["band"] =
    substance_score_0_to_1 >= 0.45 ? "dense" : substance_score_0_to_1 >= 0.2 ? "mixed" : "thin";

  const label_zh =
    band === "dense"
      ? "Denser substance (multiple verifiable cue types)"
      : band === "mixed"
        ? "Mixed substance and formula language"
        : "Thin substance (formula / direction-heavy)";

  const empty_calories = emptyCalories(text, nuggets);

  return {
    framing: "civilian-boilerplate-vs-substance",
    method: "strip-formula-then-list-verifiables",
    boilerplate_ratio_0_to_1,
    substance_score_0_to_1,
    band,
    label_zh,
    nuggets,
    boilerplate_hits,
    empty_calories,
    analyst_prompt_zh:
      "Strip formula language; keep only: numbers, deadlines, named documents, responsible bodies, pilot scope, bans/red lines, funding, named sectors. Without these, treat as rhetoric skeleton until an implementing public text appears.",
    calibration:
      band === "thin"
        ? "Thin substance band: keep confidence low; outlook stays continuity/rhetoric until instruments appear."
        : band === "mixed"
          ? "Mixed band: lead the briefing with nuggets; treat unmatched slogans as atmosphere only."
          : "Dense band: multiple verifiable cue types — still hypothesis until cross-checked.",
    tag: "hypothesis",
  };
}
