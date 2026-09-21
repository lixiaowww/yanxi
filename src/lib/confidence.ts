/**
 * Factorized research confidence + cross-source corroboration strength.
 *
 * Corroboration answers ONE question: do distinct public sources cross-check
 * each other on the same subject? Wording cues found inside a single pasted
 * passage (instrument vocabulary, meeting+instrument sequence, numbers) are
 * substance density — they are reported separately under `single_source_cues`
 * and are never summed into `score_0_to_3`.
 *
 * Confidence = "how well evidenced is this draft?", NOT "will event X happen?".
 */

import type { SignalingScorecard } from "./media-heuristics.js";
import type { SubstanceCut } from "./substance.js";
import type { SourceClass } from "./source-class.js";
import { resolveSourceTier, type SourceTier } from "./source-tier.js";
import { corroborationBand } from "./score-bands.js";

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * Within-passage wording cues. Real reading signals, but they say nothing about
 * independent verification — kept out of the corroboration score on purpose.
 */
export type SingleSourceCues = {
  framing: "civilian-single-source-substance-cues";
  /** 0–3 count of within-passage cues. Never added to corroboration.score_0_to_3. */
  count_0_to_3: 0 | 1 | 2 | 3;
  drivers: string[];
  label_en: string;
  note: string;
  tag: "hypothesis";
};

export type CorroborationSource = { label?: string; text: string };

export type Corroboration = {
  framing: "civilian-multi-source-corroboration";
  method: "cross-source-subject-overlap";
  /** 0–3. Driven only by agreement between distinct sources. */
  score_0_to_3: 0 | 1 | 2 | 3;
  source_count: number;
  /** Sources left after dropping byte-identical repastes. */
  distinct_source_count: number;
  /** True only when ≥2 distinct sources share a named subject (score ≥ 2). */
  cross_checked: boolean;
  /** Subject anchors quoted from the paste that appear in ≥2 distinct sources. */
  shared_subjects: string[];
  /** Issuers that are present in the paste and do not overlap between sources. */
  independent_issuers: string[];
  /** Legacy field name; holds an English string. */
  label_zh: string;
  label_en: string;
  drivers: string[];
  single_source_cues: SingleSourceCues;
  missing: string[];
  tag: "hypothesis";
};

export type ConfidenceFactors = {
  framing: "civilian-factorized-confidence";
  level: ConfidenceLevel;
  /** 0–1 internal blend for debugging; UI uses level. */
  score_0_to_1: number;
  factors: {
    signaling_band: ConfidenceLevel;
    substance_band: string;
    corroboration_0_to_3: number;
    cross_checked: boolean;
    distinct_source_count: number;
    single_source_cue_count: number;
    provenance: "weak" | "adequate";
    source_class: SourceClass;
    source_tier: SourceTier["tier"];
    source_tier_weight_0_to_1: number;
  };
  source_tier: SourceTier;
  caps_applied: string[];
  rationale: string;
  tag: "hypothesis";
};

function hasMeeting(text: string): boolean {
  return /中央经济工作会议|中央政治局|中央全会|两会|会议强调|会议指出/.test(text);
}

function hasInstrument(text: string): boolean {
  return /实施细则|实施方案|管理办法|配套办法|通知|意见|条例|印发/.test(text);
}

function hasNumericOrTimeline(text: string): boolean {
  return /\d+(\.\d+)?\s*(%|％|亿|万|亿元)|20\d{2}\s*年|年内|年底前/.test(text);
}

/**
 * A single passage that quotes a separately published record (a titled document
 * or a named wire) gives a reviewer one thing to go pull. That is a lead, not a
 * cross-check — it is worth at most 1 point.
 */
function namesTraceableRecord(text: string): boolean {
  return /《[^》]{2,40}》|据(新华社|人民日报|中新社|央视|经济日报|光明日报|中国政府网)|新华社[^，。]{0,6}电|援引|转引自/.test(
    text
  );
}

/** Publishers / institutions that can be named as the source of a statement. */
const ISSUERS = [
  "新华社",
  "人民日报",
  "光明日报",
  "经济日报",
  "求是",
  "中新社",
  "央视",
  "中国政府网",
  "国务院办公厅",
  "国务院国资委",
  "国务院台办",
  "国台办",
  "国务院",
  "国家发展改革委",
  "国家发改委",
  "工业和信息化部",
  "商务部",
  "外交部",
  "财政部",
  "教育部",
  "科技部",
  "农业农村部",
  "交通运输部",
  "自然资源部",
  "生态环境部",
  "国防部",
  "国家统计局",
  "中国人民银行",
  "国家金融监督管理总局",
  "中国证监会",
  "海关总署",
  "市场监管总局",
  "国家能源局",
  "国家网信办",
  "省级人民政府",
];

/** Named subjects specific enough that two sources sharing one are on the same story. */
const SUBJECT_TERMS = [
  "中央经济工作会议",
  "中央政治局会议",
  "中央金融工作会议",
  "中央财经委员会",
  "中央全会",
  "全国两会",
  "十四五",
  "十五五",
  "新质生产力",
  "专精特新",
  "产业链供应链",
  "关键核心技术",
  "芯片",
  "半导体",
  "人工智能",
  "新能源汽车",
  "房地产",
  "保交楼",
  "地方债",
  "隐性债务",
  "系统性金融风险",
  "资本无序扩张",
  "稀土",
  "菜籽",
  "软木",
  "粮食安全",
  "乡村振兴",
  "共同富裕",
  "全国统一大市场",
  "双循环",
  "一带一路",
  "两岸",
  "台海",
  "台湾",
  "南海",
  "粤港澳",
  "长三角",
  "京津冀",
  "新疆",
  "西藏",
  "主题教育",
  "社会治理",
  "强军",
  "练兵备战",
];

/** Formula wording that two unrelated official texts share by default. */
const FORMULA_PHRASES = [
  "习近平新时代中国特色社会主义思想",
  "以习近平同志为核心",
  "中国特色社会主义",
  "中华民族伟大复兴",
  "高质量发展",
  "深入贯彻落实",
  "全面贯彻落实",
  "认真贯彻落实",
  "新发展理念",
  "统筹发展和安全",
  "提高政治站位",
  "增强四个意识",
  "四个自信",
  "两个维护",
  "两个确立",
  "凝心聚力",
  "砥砺前行",
  "人民至上",
  "以人民为中心",
  "保障和改善民生",
  "社会和谐稳定",
  "安定团结",
  "正能量",
  "主旋律",
  "经济社会发展",
  "持续健康发展",
  "健康稳定发展",
  "改革开放",
  "有关部门",
  "有关负责人",
  "有关方面",
  "相互尊重",
  "扎实推进",
  "会议强调",
  "会议指出",
  "会议要求",
];

const NGRAM = 4;

function ngrams(text: string, n = NGRAM): Set<string> {
  const out = new Set<string>();
  for (const run of text.match(/[\u4e00-\u9fff]{4,}/g) || []) {
    for (let i = 0; i + n <= run.length; i += 1) out.add(run.slice(i, i + n));
  }
  return out;
}

const FORMULA_NGRAMS = (() => {
  const set = new Set<string>();
  for (const phrase of FORMULA_PHRASES) for (const g of ngrams(phrase)) set.add(g);
  return set;
})();

function matchesFrom(text: string, terms: string[]): string[] {
  const hits = terms.filter((t) => text.includes(t));
  // Keep only the most specific hit of a nested pair (国务院办公厅 over 国务院).
  return hits.filter((t) => !hits.some((other) => other !== t && other.includes(t)));
}

function detailAnchors(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(/\d+(\.\d+)?\s*(%|％|个百分点|亿元|万亿元|亿|万吨|万人)/g) || []) {
    out.add(m.replace(/\s+/g, ""));
  }
  for (const m of text.match(/20\d{2}\s*年(底|前)?/g) || []) out.add(m.replace(/\s+/g, ""));
  for (const m of text.match(/《[^》]{2,40}》/g) || []) out.add(m);
  return [...out];
}

type SourceView = {
  label: string;
  issuers: string[];
  subjects: string[];
  details: string[];
  phrases: Set<string>;
};

function viewOf(src: CorroborationSource, index: number): SourceView {
  const text = src.text || "";
  const phrases = new Set<string>();
  for (const g of ngrams(text)) if (!FORMULA_NGRAMS.has(g)) phrases.add(g);
  return {
    label: (src.label || `source-${index + 1}`).trim(),
    issuers: matchesFrom(text, ISSUERS),
    subjects: matchesFrom(text, SUBJECT_TERMS),
    details: detailAnchors(text),
    phrases,
  };
}

/** Terms present in at least two distinct sources. */
function sharedAcross(views: SourceView[], pick: (v: SourceView) => Iterable<string>): string[] {
  const counts = new Map<string, number>();
  for (const v of views) {
    for (const term of new Set(pick(v))) counts.set(term, (counts.get(term) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([term]) => term)
    .sort();
}

/** A pair of sources whose named issuers do not overlap = genuinely separate publishers. */
function independentIssuerPair(views: SourceView[]): string[] {
  for (let i = 0; i < views.length; i += 1) {
    for (let j = i + 1; j < views.length; j += 1) {
      const a = views[i].issuers;
      const b = views[j].issuers;
      if (!a.length || !b.length) continue;
      if (a.some((x) => b.includes(x))) continue;
      return [...new Set([...a, ...b])];
    }
  }
  return [];
}

function buildSingleSourceCues(sourceText: string, substance: SubstanceCut): SingleSourceCues {
  const drivers: string[] = [];
  if (hasInstrument(sourceText)) drivers.push("named_or_cue_instrument");
  if (hasMeeting(sourceText) && hasInstrument(sourceText)) {
    drivers.push("meeting_plus_instrument_sequence");
  }
  if (hasNumericOrTimeline(sourceText) || substance.band === "dense") {
    drivers.push("numeric_or_dense_substance");
  }
  const count_0_to_3 = Math.min(3, drivers.length) as 0 | 1 | 2 | 3;
  return {
    framing: "civilian-single-source-substance-cues",
    count_0_to_3,
    drivers,
    label_en: `Within-passage detail cues ${count_0_to_3}/3 (not corroboration)`,
    note: "Wording cues inside the pasted passage. They describe how specific the text is (see substance_cut), not whether any independent source confirms it.",
    tag: "hypothesis",
  };
}

export function buildCorroboration(opts: {
  sourceText: string;
  sourceCount: number;
  substance: SubstanceCut;
  /** Per-source texts. Required to observe cross-source agreement at all. */
  sources?: CorroborationSource[];
}): Corroboration {
  const { sourceText, sourceCount, substance } = opts;
  const single_source_cues = buildSingleSourceCues(sourceText, substance);

  const provided =
    opts.sources && opts.sources.length
      ? opts.sources
      : sourceCount <= 1
        ? [{ label: "paste-1", text: sourceText }]
        : [];

  // Byte-identical repastes are one source, not two.
  const seen = new Set<string>();
  const distinct: CorroborationSource[] = [];
  for (const s of provided) {
    const key = (s.text || "").replace(/\s+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distinct.push(s);
  }

  // Without per-source texts a merged run cannot be inspected for overlap at all.
  const observable = distinct.length > 0;
  const views = distinct.map(viewOf);
  const distinct_source_count = observable ? views.length : Math.max(sourceCount, 1);
  const shared_subjects = sharedAcross(views, (v) => v.subjects);
  const shared_details = sharedAcross(views, (v) => v.details);
  const shared_phrases = sharedAcross(views, (v) => v.phrases);
  const independent_issuers = shared_subjects.length ? independentIssuerPair(views) : [];

  const drivers: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (!observable) {
    missing.push(
      "Second public source (independent issuer, same subject) — per-source texts were not supplied, so overlap could not be checked"
    );
  } else if (distinct_source_count < 2) {
    // Nothing to cross-check. At most one point, and only for a traceable pointer.
    if (namesTraceableRecord(sourceText)) {
      score = 1;
      drivers.push("single_source_names_traceable_record");
    }
    missing.push(
      "Second public source (independent issuer, same subject) to cross-check this passage"
    );
  } else if (shared_subjects.length) {
    score = 2;
    drivers.push("cross_source_subject_match");
    if (shared_details.length) drivers.push("cross_source_detail_match");
    if (independent_issuers.length) {
      score = 3;
      drivers.push("independent_issuer_agreement");
    } else if (distinct_source_count >= 3) {
      score = 3;
      drivers.push("three_plus_sources_same_subject");
    } else {
      missing.push(
        "Restatement from a different issuer — the current sources name the same issuer, so they are not independent"
      );
    }
  } else if (shared_phrases.length >= 3) {
    score = 1;
    drivers.push("cross_source_topic_overlap_only");
    missing.push(
      `Second public source on the SAME named subject — the ${distinct_source_count} sources share only general wording`
    );
  } else {
    missing.push(
      `Second public source on the SAME named subject — the ${distinct_source_count} sources do not overlap`
    );
  }

  if (!hasInstrument(sourceText)) {
    missing.push("Named notice / measure / implementing detail");
  }
  if (hasMeeting(sourceText) && !hasInstrument(sourceText)) {
    missing.push("Implementing document matching the meeting language");
  }
  if (substance.band === "thin") {
    missing.push("Verifiable numbers / deadlines / responsible bodies");
  }

  const score_0_to_3 = Math.min(3, score) as 0 | 1 | 2 | 3;
  const cross_checked = score_0_to_3 >= 2;
  const n = distinct_source_count;
  const plural = n === 1 ? "source" : "sources";
  const subjectList = shared_subjects.slice(0, 3).join(", ");

  const label_zh =
    score_0_to_3 >= 3
      ? `Cross-checked across independent issuers — ${n} ${plural} (${independent_issuers.slice(0, 3).join(" / ") || "3+ sources"}) share: ${subjectList}`
      : score_0_to_3 === 2
        ? `Subject cross-checked — ${n} ${plural} share: ${subjectList}; issuer independence not established`
        : score_0_to_3 === 1
          ? n < 2
            ? `Not cross-checked — 1 source only; it names a public record a reviewer can pull`
            : `Weak cross-check — ${n} ${plural} overlap on general wording only, no shared named subject`
          : !observable
            ? `Not cross-checked — ${n} ${plural} merged, but per-source texts were unavailable to compare`
            : n < 2
              ? `Not cross-checked — 1 source only; nothing has been compared against a second source`
              : `Not cross-checked — ${n} ${plural} with no shared subject`;

  const label_en =
    score_0_to_3 >= 3
      ? `Cross-checked across independent issuers (${n} ${plural})`
      : score_0_to_3 === 2
        ? `Subject cross-checked, same issuer family (${n} ${plural})`
        : score_0_to_3 === 1
          ? n < 2
            ? `Not cross-checked (1 source, traceable record named)`
            : `Weak cross-check, wording overlap only (${n} ${plural})`
          : `Not cross-checked (${n} ${plural})`;

  return {
    framing: "civilian-multi-source-corroboration",
    method: "cross-source-subject-overlap",
    score_0_to_3,
    source_count: sourceCount,
    distinct_source_count,
    cross_checked,
    shared_subjects: shared_subjects.slice(0, 8),
    independent_issuers,
    label_zh,
    label_en,
    drivers,
    single_source_cues,
    missing: missing.slice(0, 5),
    tag: "hypothesis",
  };
}

function rank(level: ConfidenceLevel): number {
  return level === "high" ? 2 : level === "medium" ? 1 : 0;
}

function fromRank(n: number): ConfidenceLevel {
  if (n >= 2) return "high";
  if (n >= 1) return "medium";
  return "low";
}

function minLevel(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
  return fromRank(Math.min(rank(a), rank(b)));
}

export function buildConfidenceFactors(opts: {
  scorecard: SignalingScorecard;
  substance: SubstanceCut;
  corroboration: Corroboration;
  sourceClass: SourceClass;
  sourceLabels: string[];
  sourceText?: string;
}): ConfidenceFactors {
  const caps: string[] = [];
  let level: ConfidenceLevel = opts.scorecard.band;
  const provenance: "weak" | "adequate" = opts.sourceLabels.some(
    (l) => /^https?:\/\//i.test(l) || /新华社|人民日报|gov\.cn|部|国务院/.test(l)
  )
    ? "adequate"
    : "weak";

  const source_tier = resolveSourceTier(
    opts.sourceClass,
    opts.sourceText || "",
    opts.sourceLabels
  );

  const corr = opts.corroboration;
  const cueCount = corr.single_source_cues?.count_0_to_3 ?? 0;

  if (opts.substance.band === "thin") {
    level = minLevel(level, "medium");
    caps.push("substance_thin_cap_medium");
  }
  if (corr.distinct_source_count < 2) {
    // One source says one thing once. Rich wording does not make it verified.
    level = minLevel(level, "low");
    caps.push("single_source_not_cross_checked_cap_low");
  } else if (!corr.cross_checked) {
    level = minLevel(level, "medium");
    caps.push("corroboration_lt2_cap_medium");
    if (corr.score_0_to_3 === 0) {
      level = minLevel(level, "low");
      caps.push("corroboration_no_shared_subject_cap_low");
    }
  }
  if (opts.sourceClass === "social_commentary") {
    level = "low";
    caps.push("social_commentary_hard_cap_low");
  }
  if (provenance === "weak" && level === "high") {
    level = "medium";
    caps.push("weak_provenance_cap_medium");
  }

  // Curated tier max (A/B may reach high; C/U ≤ medium; D ≤ low)
  if (rank(level) > rank(source_tier.max_confidence)) {
    level = source_tier.max_confidence;
    caps.push(`source_tier_${source_tier.tier}_max_${source_tier.max_confidence}`);
  }

  const blend =
    (opts.scorecard.band === "high" ? 0.7 : opts.scorecard.band === "medium" ? 0.45 : 0.2) * 0.3 +
    (opts.substance.substance_score_0_to_1 || 0) * 0.22 +
    (corr.score_0_to_3 / 3) * 0.18 +
    (cueCount / 3) * 0.1 +
    (provenance === "adequate" ? 0.08 : 0.02) +
    source_tier.weight_0_to_1 * 0.12;
  // The debug blend must not read higher than the level the caps allow.
  const ceiling = level === "high" ? 1 : level === "medium" ? 0.7 : 0.45;
  const score_0_to_1 = Number(Math.min(blend, ceiling).toFixed(3));

  const crossCheckNote = corr.cross_checked
    ? `cross-checked across ${corr.distinct_source_count} sources on ${corr.shared_subjects.slice(0, 3).join(", ") || "a shared subject"}`
    : `not cross-checked (${corr.distinct_source_count} distinct source${corr.distinct_source_count === 1 ? "" : "s"})`;

  return {
    framing: "civilian-factorized-confidence",
    level,
    score_0_to_1: Math.min(1, score_0_to_1),
    factors: {
      signaling_band: opts.scorecard.band,
      substance_band: opts.substance.band,
      corroboration_0_to_3: corr.score_0_to_3,
      cross_checked: corr.cross_checked,
      distinct_source_count: corr.distinct_source_count,
      single_source_cue_count: cueCount,
      provenance,
      source_class: opts.sourceClass,
      source_tier: source_tier.tier,
      source_tier_weight_0_to_1: source_tier.weight_0_to_1,
    },
    source_tier,
    caps_applied: caps,
    rationale: `Research confidence=${level} from signaling=${opts.scorecard.band}, substance=${opts.substance.band}, corroboration=${corroborationBand(corr.score_0_to_3)} (${crossCheckNote}), within-passage detail cues=${cueCount >= 2 ? "several" : cueCount === 1 ? "one" : "none"} (not corroboration), provenance=${provenance}, source_class=${opts.sourceClass}, source_tier=${source_tier.tier} (stated editorial prior). Caps: ${caps.join(", ") || "none"}. Bands come from hand-set rule cues with no labelled-data calibration — they order and flag, they do not measure. Not an event-probability forecast.`,
    tag: "hypothesis",
  };
}
