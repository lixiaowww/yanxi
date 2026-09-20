/**
 * Strip formulaic party-speak (党八股) and surface verifiable "substance" cues
 * in public Mandarin policy/media text. Civilian research aid — not mind-reading.
 */

export type SubstanceKind =
  | "numeric_target"
  | "timeline"
  | "named_instrument"
  | "responsible_body"
  | "pilot_or_scope"
  | "constraint_or_ban"
  | "resource_or_funding"
  | "named_sector_or_place"
  | "delta_or_priority_shift";

export type SubstanceNugget = {
  kind: SubstanceKind;
  label_zh: string;
  evidence: string;
  tag: "hypothesis";
};

export type BoilerplateHit = {
  cue: string;
  evidence: string;
};

export type SubstanceCut = {
  framing: "civilian-boilerplate-vs-substance";
  method: "strip-formula-then-list-verifiables";
  /** 0–1 share of chars covered by known formula phrases (rough). */
  boilerplate_ratio_0_to_1: number;
  /** 0–1 based on nugget count / density. */
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
    label_zh: "可核验数字/比例",
    rx: /\d+(\.\d+)?\s*(%|％|个百分点|亿|万亿|万人|万吨|亿元|万亿元|倍)/g,
  },
  {
    kind: "timeline",
    label_zh: "时间表/年份节点",
    rx: /(到|于|自)?\d{4}\s*年(底|前|以来)?|(「|“)?十四五(」|”)?|(「|“)?十五五(」|”)?|本月底|年内|季度|月内|限期/g,
  },
  {
    kind: "named_instrument",
    label_zh: "具名政策工具",
    rx: /实施细则|实施方案|管理办法|配套办法|办法|条例|通知|意见|目录|清单|白皮书|行动计划|试点方案/g,
  },
  {
    kind: "responsible_body",
    label_zh: "责任主体/发文机关",
    rx: /国务院办公厅|国家发改委|工业和信息化部|商务部|外交部|财政部|中国人民银行|农业农村部|各省级人民政府|有关部门要/g,
  },
  {
    kind: "pilot_or_scope",
    label_zh: "试点/范围边界",
    rx: /试点|先行先试|全国推开|分批|局部|在.+范围|重点地区|重点行业/g,
  },
  {
    kind: "constraint_or_ban",
    label_zh: "约束/禁止/红线",
    rx: /不得|严禁|禁止|红线|底线|坚决守住|一律不得|严肃查处|问责/g,
  },
  {
    kind: "resource_or_funding",
    label_zh: "资金/资源安排",
    rx: /专项资金|财政支持|贴息|补贴|拨款|额度|债券|专项债|预算安排/g,
  },
  {
    kind: "named_sector_or_place",
    label_zh: "具名行业/地域",
    rx: /芯片|半导体|人工智能|房地产|地方债|菜籽|稀土|粤港澳|长三角|京津冀|东北|新疆|西藏|台湾|南海/g,
  },
  {
    kind: "delta_or_priority_shift",
    label_zh: "缓急/排序/新提法线索",
    rx: /首次|更加突出|把.+放在|优先|重中之重|从.+转向|不再|淡化|暂缓|加力|加码/g,
  },
];

function windowAround(text: string, index: number, len: number, pad = 18): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + len + pad);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
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

function collectNuggets(text: string): SubstanceNugget[] {
  const out: SubstanceNugget[] = [];
  const seen = new Set<string>();
  for (const det of SUBSTANCE) {
    const rx = new RegExp(det.rx.source, det.rx.flags.includes("g") ? det.rx.flags : det.rx.flags + "g");
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = rx.exec(text)) !== null && n < 4) {
      const key = `${det.kind}:${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: det.kind,
        label_zh: det.label_zh,
        evidence: windowAround(text, m.index, m[0].length),
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
    notes.push("方向动词多、具名工具少 → 多为姿态语，等细则再抬置信度");
  }
  if (/高质量发展|新质生产力/.test(text) && !nuggets.some((n) => n.kind === "numeric_target" || n.kind === "timeline")) {
    notes.push("宏观口号未配数字/时间表 → 先记词汇，勿当已落地");
  }
  if (/正能量|主旋律|意识形态|主题教育/.test(text) && nuggets.length < 2) {
    notes.push("宣传/教育语占比高 → 组织动员信号为主，政策工具干货可能很少");
  }
  if (!nuggets.length) {
    notes.push("未检出可核验干货线索 → 简报应降置信度并列出待补公开源");
  }
  return notes.slice(0, 5);
}

export function buildSubstanceCut(sourceText: string): SubstanceCut {
  const text = sourceText || "";
  const { hits: boilerplate_hits, covered } = collectBoilerplate(text);
  const nuggets = collectNuggets(text);
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
      ? "干货较密（多类可核验线索）"
      : band === "mixed"
        ? "干货与套话混杂"
        : "干货偏薄（套话/方向语为主）";

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
      "先划掉套话，只保留：数字、时限、文件名、责任主体、试点范围、红线/禁止、资金、具名行业。没有这些就当作宣传骨架，等后续公开细则。",
    calibration:
      band === "thin"
        ? "Thin substance band: keep confidence low; outlook stays continuity/rhetoric until instruments appear."
        : band === "mixed"
          ? "Mixed band: lead the briefing with nuggets; treat unmatched slogans as atmosphere only."
          : "Dense band: multiple verifiable cue types — still hypothesis until cross-checked.",
    tag: "hypothesis",
  };
}
