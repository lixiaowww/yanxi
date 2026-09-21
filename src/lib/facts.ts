/**
 * Typed fact extraction from public Mandarin policy/news text.
 *
 * The offline briefing path used to echo the first Chinese sentence and show
 * ±18-character windows. This module instead pulls out the VALUE itself
 * (amount, date, instrument name, scope, prohibition) together with an exact
 * source span, and renders it in English so the analyst-facing briefing states
 * WHO / WHAT / HOW MUCH / BY WHEN / FOR WHICH SCOPE / WHAT IS BARRED.
 *
 * Civilian reading aid: extraction and translation only. Nothing here infers
 * intent, and every downstream note stays a background/hypothesis draft for
 * human review.
 */

export type FactKind =
  | "actor"
  | "instrument"
  | "deadline"
  | "money"
  | "quantity"
  | "scope"
  | "subject"
  | "prohibition";

export type FactQualifier = "at_least" | "at_most" | "more_than" | "about" | null;

export type ActorForm = "person" | "meeting" | "body" | "unnamed";

export type ExtractedFact = {
  kind: FactKind;
  /** Verbatim Chinese value as written — exact substring of the paste. */
  value_zh: string;
  /** English rendering for analyst-facing prose. */
  value_en: string;
  /** "deadline: by end-2026" style fragment for composed sentences. */
  fragment_en: string;
  /** Standalone English statement of what this fact establishes. */
  point_en: string;
  /** Clause-bounded exact substring of the paste. */
  quote: string;
  /** Sentence-bounded exact substring of the paste (digest evidence). */
  sentence: string;
  /** Offset of value_zh inside the paste. */
  index: number;
  qualifier: FactQualifier;
  /** actor only. */
  actor_form?: ActorForm;
  /** money only — a bare vehicle with no amount is still a funding cue. */
  has_amount?: boolean;
  /** money only, e.g. "special funds". */
  vehicle_en?: string;
  /** money only — amount without the funding-vehicle suffix. */
  amount_en?: string;
  /** instrument only — normalized type, e.g. "management measures". */
  type_en?: string;
  /** instrument only — already published vs promised. */
  issued?: boolean;
};

export type FactSet = {
  facts: ExtractedFact[];
  actor: ExtractedFact[];
  instrument: ExtractedFact[];
  deadline: ExtractedFact[];
  money: ExtractedFact[];
  quantity: ExtractedFact[];
  scope: ExtractedFact[];
  subject: ExtractedFact[];
  prohibition: ExtractedFact[];
  /** Named institution present (excludes "有关部门"-style placeholders). */
  named_actor: boolean;
  /** Funding cue carrying an actual amount. */
  funded: boolean;
};

/* ------------------------------------------------------------------ spans */

const CLAUSE_BREAKS = "。！？；，、：·\n\r\t　,;:!?…";
const SENTENCE_BREAKS = "。！？；\n\r";
const TRIMMABLE = "。！？；，、：·\n\r\t　 ,;:!?…“”\"'‘’()（）";

/**
 * Widen [index, index+len) to a clause/sentence boundary and trim punctuation.
 * Only slices — the result stays an exact substring so the claim gate and the
 * UI source highlight keep working.
 */
function spanAround(
  text: string,
  index: number,
  len: number,
  breaks: string,
  maxLen: number
): string {
  let start = index;
  while (start > 0 && !breaks.includes(text[start - 1])) start -= 1;
  let end = index + len;
  while (end < text.length && !breaks.includes(text[end])) end += 1;

  if (end - start > maxLen) {
    const leftRoom = index - start;
    start += Math.min(end - start - maxLen, leftRoom);
    if (end - start > maxLen) end = Math.max(index + len, start + maxLen);
  }
  while (start < end && TRIMMABLE.includes(text[start])) start += 1;
  while (end > start && TRIMMABLE.includes(text[end - 1])) end -= 1;
  return text.slice(start, end);
}

function clauseSpan(text: string, index: number, len: number): string {
  return spanAround(text, index, len, CLAUSE_BREAKS, 52) || text.slice(index, index + len);
}

function sentenceSpan(text: string, index: number, len: number): string {
  return spanAround(text, index, len, SENTENCE_BREAKS, 96) || clauseSpan(text, index, len);
}

/** Exported so substance.ts can reuse identical, gate-safe evidence spans. */
export function evidenceSpan(text: string, index: number, len: number): string {
  return clauseSpan(text, index, len);
}

/* -------------------------------------------------------------- glossary */

type Gloss = { zh: string; en: string };

/**
 * Term glossary for rendering extracted Chinese values into English.
 * Vocabulary only — see skills/context-cards/*.md for interpretive context.
 */
const GLOSS: Gloss[] = [
  // instrument types
  { zh: "十四五规划纲要", en: "14th Five-Year Plan Outline" },
  { zh: "十五五规划纲要", en: "15th Five-Year Plan Outline" },
  { zh: "实施细则", en: "implementing rules" },
  { zh: "实施方案", en: "implementation plan" },
  { zh: "行动计划", en: "action plan" },
  { zh: "试点方案", en: "pilot scheme" },
  { zh: "管理办法", en: "management measures" },
  { zh: "暂行办法", en: "interim measures" },
  { zh: "配套办法", en: "supporting measures" },
  { zh: "指导意见", en: "guiding opinion" },
  { zh: "实施意见", en: "implementing opinion" },
  { zh: "负面清单", en: "negative list" },
  { zh: "白皮书", en: "white paper" },
  { zh: "办法", en: "measures" },
  { zh: "条例", en: "regulation" },
  { zh: "通知", en: "notice" },
  { zh: "公告", en: "announcement" },
  { zh: "规定", en: "provisions" },
  { zh: "意见", en: "opinion" },
  { zh: "目录", en: "catalogue" },
  { zh: "清单", en: "list" },
  { zh: "纲要", en: "outline" },
  { zh: "规划", en: "plan" },
  // sectors / products / places
  { zh: "新能源汽车", en: "new-energy vehicles" },
  { zh: "动力电池", en: "power batteries" },
  { zh: "锂电池", en: "lithium batteries" },
  { zh: "充电桩", en: "charging piles" },
  { zh: "集成电路", en: "integrated circuits" },
  { zh: "半导体", en: "semiconductors" },
  { zh: "先进制程", en: "advanced-node manufacturing" },
  { zh: "人工智能", en: "artificial intelligence" },
  { zh: "生成式人工智能", en: "generative artificial intelligence" },
  { zh: "大模型", en: "large models" },
  { zh: "算力枢纽", en: "computing-power hubs" },
  { zh: "算力", en: "computing power" },
  { zh: "智算", en: "intelligent computing" },
  { zh: "关键核心技术", en: "core technologies" },
  { zh: "产业链供应链", en: "industrial and supply chains" },
  { zh: "专精特新", en: "specialised SMEs" },
  { zh: "中小企业", en: "small and medium enterprises" },
  { zh: "制造业", en: "manufacturing" },
  { zh: "房地产", en: "real estate" },
  { zh: "保交楼", en: "housing-delivery guarantees" },
  { zh: "隐性债务", en: "hidden local debt" },
  { zh: "地方债", en: "local-government debt" },
  { zh: "系统性金融风险", en: "systemic financial risk" },
  { zh: "系统性风险", en: "systemic risk" },
  { zh: "资本无序扩张", en: "disorderly capital expansion" },
  { zh: "关键矿产", en: "critical minerals" },
  { zh: "稀土", en: "rare earths" },
  { zh: "菜籽油", en: "canola oil" },
  { zh: "菜籽", en: "canola" },
  { zh: "软木", en: "softwood" },
  { zh: "粮食安全", en: "food security" },
  { zh: "乡村振兴", en: "rural revitalisation" },
  { zh: "耕地", en: "arable land" },
  { zh: "粤港澳", en: "the Greater Bay Area" },
  { zh: "长三角", en: "the Yangtze River Delta" },
  { zh: "京津冀", en: "Beijing-Tianjin-Hebei" },
  { zh: "东北", en: "Northeast China" },
  { zh: "新疆", en: "Xinjiang" },
  { zh: "西藏", en: "Tibet" },
  { zh: "南海", en: "the South China Sea" },
  { zh: "台海", en: "the Taiwan Strait" },
  { zh: "两岸", en: "cross-Strait" },
  { zh: "台湾", en: "Taiwan" },
  { zh: "中加", en: "China-Canada" },
  { zh: "加方", en: "the Canadian side" },
  { zh: "加拿大", en: "Canada" },
  { zh: "一带一路", en: "the Belt and Road Initiative" },
  { zh: "军工", en: "the defence industry" },
  { zh: "国防", en: "national defence" },
  { zh: "演训", en: "training exercises" },
  { zh: "战备", en: "combat readiness" },
  { zh: "社会治理", en: "social governance" },
  { zh: "基层治理", en: "grassroots governance" },
  { zh: "共同富裕", en: "common prosperity" },
  { zh: "民生", en: "livelihood" },
  { zh: "舆情", en: "public-opinion management" },
  { zh: "营商环境", en: "the business environment" },
  { zh: "扩大内需", en: "domestic-demand expansion" },
  { zh: "统一大市场", en: "the unified national market" },
  { zh: "双循环", en: "dual circulation" },
  { zh: "新质生产力", en: "new quality productive forces" },
  { zh: "高质量发展", en: "high-quality development" },
  { zh: "数据违规出境", en: "improper cross-border data transfers" },
  { zh: "违规出境", en: "improper cross-border transfer" },
  { zh: "数据出境", en: "cross-border data transfer" },
  { zh: "出境", en: "cross-border transfer" },
  { zh: "违规", en: "rule-breaking" },
  { zh: "数据", en: "data" },
  { zh: "骗补", en: "subsidy fraud" },
  { zh: "挪用", en: "misappropriation" },
  { zh: "青年", en: "youth" },
  { zh: "交流", en: "exchange" },
  { zh: "宣传", en: "publicity" },
  { zh: "备案", en: "filing" },
  { zh: "配套", en: "supporting" },
  { zh: "枢纽", en: "hub" },
  { zh: "芯片", en: "chips" },
  { zh: "企业", en: "enterprises" },
  { zh: "试点", en: "pilot" },
  { zh: "自主可控", en: "self-controllable supply" },
  { zh: "国产替代", en: "domestic substitution" },
  { zh: "卡脖子", en: "chokepoint" },
  // connectives / function words (kept so coverage scores stay meaningful)
  { zh: "有关", en: "relevant" },
  { zh: "相关", en: "related" },
  { zh: "等", en: "and related" },
  { zh: "与", en: "and" },
  { zh: "和", en: "and" },
  { zh: "及", en: "and" },
  { zh: "或", en: "or" },
  { zh: "的", en: "" },
  { zh: "在", en: "" },
  { zh: "上", en: "" },
  { zh: "中", en: "" },
];

const GLOSS_SORTED = [...GLOSS].sort((a, b) => b.zh.length - a.zh.length);

/** Longest-match glossary render. `covered` = share of chars translated. */
export function glossPhrase(zh: string): { en: string; covered: number } {
  const parts: string[] = [];
  let i = 0;
  let hit = 0;
  while (i < zh.length) {
    let matched = false;
    for (const g of GLOSS_SORTED) {
      if (zh.startsWith(g.zh, i)) {
        if (g.en) parts.push(g.en);
        hit += g.zh.length;
        i += g.zh.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  return {
    en: parts.join(" ").replace(/\s+/g, " ").trim(),
    covered: zh.length ? hit / zh.length : 0,
  };
}

/* ----------------------------------------------------------------- actors */

type IssuerMeta = { zh: string; en: string; form: ActorForm };

const ISSUERS: IssuerMeta[] = [
  { zh: "中共中央办公厅", en: "the CPC Central Committee General Office", form: "body" },
  { zh: "国务院办公厅", en: "the State Council General Office", form: "body" },
  { zh: "国务院台湾事务办公室", en: "the Taiwan Affairs Office", form: "body" },
  { zh: "国台办", en: "the Taiwan Affairs Office", form: "body" },
  { zh: "国家发展改革委员会", en: "the National Development and Reform Commission", form: "body" },
  { zh: "国家发展改革委", en: "the National Development and Reform Commission", form: "body" },
  { zh: "国家发改委", en: "the National Development and Reform Commission", form: "body" },
  { zh: "发改委", en: "the National Development and Reform Commission", form: "body" },
  { zh: "工业和信息化部", en: "the Ministry of Industry and Information Technology", form: "body" },
  { zh: "工信部", en: "the Ministry of Industry and Information Technology", form: "body" },
  { zh: "科学技术部", en: "the Ministry of Science and Technology", form: "body" },
  { zh: "科技部", en: "the Ministry of Science and Technology", form: "body" },
  { zh: "商务部", en: "the Ministry of Commerce", form: "body" },
  { zh: "外交部", en: "the Ministry of Foreign Affairs", form: "body" },
  { zh: "财政部", en: "the Ministry of Finance", form: "body" },
  { zh: "教育部", en: "the Ministry of Education", form: "body" },
  { zh: "公安部", en: "the Ministry of Public Security", form: "body" },
  { zh: "国防部", en: "the Ministry of National Defense", form: "body" },
  { zh: "农业农村部", en: "the Ministry of Agriculture and Rural Affairs", form: "body" },
  { zh: "交通运输部", en: "the Ministry of Transport", form: "body" },
  { zh: "自然资源部", en: "the Ministry of Natural Resources", form: "body" },
  { zh: "生态环境部", en: "the Ministry of Ecology and Environment", form: "body" },
  { zh: "住房和城乡建设部", en: "the Ministry of Housing and Urban-Rural Development", form: "body" },
  { zh: "人力资源和社会保障部", en: "the Ministry of Human Resources and Social Security", form: "body" },
  { zh: "国家卫生健康委员会", en: "the National Health Commission", form: "body" },
  { zh: "国家卫健委", en: "the National Health Commission", form: "body" },
  { zh: "国家能源局", en: "the National Energy Administration", form: "body" },
  { zh: "国家市场监督管理总局", en: "the State Administration for Market Regulation", form: "body" },
  { zh: "市场监管总局", en: "the State Administration for Market Regulation", form: "body" },
  { zh: "国家互联网信息办公室", en: "the Cyberspace Administration of China", form: "body" },
  { zh: "中央网信办", en: "the Cyberspace Administration of China", form: "body" },
  { zh: "国家网信办", en: "the Cyberspace Administration of China", form: "body" },
  { zh: "国家税务总局", en: "the State Taxation Administration", form: "body" },
  { zh: "国家统计局", en: "the National Bureau of Statistics", form: "body" },
  { zh: "国家金融监督管理总局", en: "the National Financial Regulatory Administration", form: "body" },
  { zh: "中国证监会", en: "the China Securities Regulatory Commission", form: "body" },
  { zh: "证监会", en: "the China Securities Regulatory Commission", form: "body" },
  { zh: "中国人民银行", en: "the People's Bank of China", form: "body" },
  { zh: "人民银行", en: "the People's Bank of China", form: "body" },
  { zh: "海关总署", en: "the General Administration of Customs", form: "body" },
  { zh: "国务院", en: "the State Council", form: "body" },
  { zh: "省级人民政府", en: "provincial governments", form: "body" },
  { zh: "中央经济工作会议", en: "the Central Economic Work Conference", form: "meeting" },
  { zh: "中共中央政治局", en: "the CPC Politburo", form: "meeting" },
  { zh: "中央政治局", en: "the CPC Politburo", form: "meeting" },
  { zh: "国务院常务会议", en: "the State Council executive meeting", form: "meeting" },
  { zh: "中央全会", en: "a Central Committee plenum", form: "meeting" },
  { zh: "全国人民代表大会", en: "the National People's Congress", form: "meeting" },
];

const ISSUERS_SORTED = [...ISSUERS].sort((a, b) => b.zh.length - a.zh.length);

const ROLES: Gloss[] = [
  { zh: "新闻发言人", en: "spokesperson" },
  { zh: "发言人", en: "spokesperson" },
  { zh: "有关负责人", en: "official" },
  { zh: "主要负责人", en: "senior official" },
  { zh: "负责人", en: "official" },
  { zh: "例行记者会", en: "regular press conference" },
  { zh: "部长", en: "minister" },
];

/** Placeholders that explicitly leave the acting body unnamed. */
const UNNAMED_ACTORS: Gloss[] = [
  { zh: "各地各部门", en: "unnamed local authorities and departments" },
  { zh: "各级党委", en: "unnamed Party committees at all levels" },
  { zh: "有关部门", en: "unnamed “relevant departments”" },
  { zh: "有关方面", en: "unnamed “relevant parties”" },
  { zh: "有关单位", en: "unnamed “relevant units”" },
  { zh: "有关会议", en: "an unnamed meeting" },
  { zh: "地方会议", en: "an unnamed local meeting" },
];

/* ------------------------------------------------------------- instruments */

type InstrumentMeta = { zh: string; en: string; plural: boolean };

const INSTRUMENT_TYPES: InstrumentMeta[] = [
  { zh: "实施细则", en: "implementing rules", plural: true },
  { zh: "实施方案", en: "an implementation plan", plural: false },
  { zh: "行动计划", en: "an action plan", plural: false },
  { zh: "试点方案", en: "a pilot scheme", plural: false },
  { zh: "管理办法", en: "management measures", plural: true },
  { zh: "暂行办法", en: "interim measures", plural: true },
  { zh: "配套办法", en: "supporting measures", plural: true },
  { zh: "指导意见", en: "a guiding opinion", plural: false },
  { zh: "实施意见", en: "an implementing opinion", plural: false },
  { zh: "负面清单", en: "a negative list", plural: false },
  { zh: "白皮书", en: "a white paper", plural: false },
  { zh: "办法", en: "measures", plural: true },
  { zh: "条例", en: "a regulation", plural: false },
  { zh: "通知", en: "a notice", plural: false },
  { zh: "公告", en: "an announcement", plural: false },
  { zh: "规定", en: "provisions", plural: true },
  { zh: "纲要", en: "an outline", plural: false },
];

const INSTRUMENT_SORTED = [...INSTRUMENT_TYPES].sort((a, b) => b.zh.length - a.zh.length);

/** Verbs that end a modifier walk-back — everything before them is not part of the title. */
const MODIFIER_STOPS = [
  "出台",
  "印发",
  "制定",
  "制订",
  "发布",
  "公布",
  "颁布",
  "修订",
  "编制",
  "研究",
  "适时",
  "推出",
  "要求",
  "落实",
  "完善",
];

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

/** Walk left over CJK characters, then drop everything up to the last policy verb. */
function modifierBefore(text: string, index: number, max = 12): string {
  let start = index;
  while (start > 0 && index - start < max && CJK.test(text[start - 1])) start -= 1;
  let raw = text.slice(start, index);
  for (const stop of MODIFIER_STOPS) {
    const at = raw.lastIndexOf(stop);
    if (at >= 0) raw = raw.slice(at + stop.length);
  }
  return raw;
}

/* ------------------------------------------------------------------ money */

const MONEY_UNITS: { zh: string; multiplier: number }[] = [
  { zh: "万亿元", multiplier: 1e12 },
  { zh: "万亿", multiplier: 1e12 },
  { zh: "亿元", multiplier: 1e8 },
  { zh: "亿", multiplier: 1e8 },
  { zh: "万元", multiplier: 1e4 },
];

const MONEY_RX = new RegExp(
  `(不少于|不低于|至少|不超过|不高于|最高|超过|逾|达|约|近)?\\s*(\\d+(?:\\.\\d+)?)\\s*(${MONEY_UNITS.map((u) => u.zh).join("|")})`,
  "g"
);

const FUNDING_VEHICLES: Gloss[] = [
  { zh: "中央预算内投资", en: "central budget investment" },
  { zh: "专项债券", en: "special-purpose bonds" },
  { zh: "专项资金", en: "special funds" },
  { zh: "专项支持", en: "dedicated support" },
  { zh: "财政资金", en: "fiscal funds" },
  { zh: "预算安排", en: "budget appropriations" },
  { zh: "财政支持", en: "fiscal support" },
  { zh: "专项债", en: "special-purpose bonds" },
  { zh: "贴息", en: "interest subsidies" },
  { zh: "补贴", en: "subsidies" },
  { zh: "拨款", en: "appropriations" },
  { zh: "信贷", en: "credit" },
  { zh: "基金", en: "a fund" },
  { zh: "额度", en: "a quota" },
];

const QUALIFIER_EN: Record<string, { q: FactQualifier; en: string }> = {
  不少于: { q: "at_least", en: "no less than" },
  不低于: { q: "at_least", en: "no less than" },
  至少: { q: "at_least", en: "at least" },
  不超过: { q: "at_most", en: "no more than" },
  不高于: { q: "at_most", en: "no more than" },
  最高: { q: "at_most", en: "up to" },
  超过: { q: "more_than", en: "more than" },
  逾: { q: "more_than", en: "more than" },
  达: { q: "more_than", en: "reaching" },
  约: { q: "about", en: "about" },
  近: { q: "about", en: "nearly" },
};

function formatYuan(amount: number): string {
  if (amount >= 1e12) return `RMB ${trimNum(amount / 1e12)} trillion`;
  if (amount >= 1e9) return `RMB ${trimNum(amount / 1e9)} billion`;
  if (amount >= 1e6) return `RMB ${trimNum(amount / 1e6)} million`;
  return `RMB ${amount.toLocaleString("en-US")}`;
}

function trimNum(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/* --------------------------------------------------------------- deadlines */

const DEADLINE_RX =
  /(?:于|到|至|自|在)?((?:19|20)\d{2})\s*年(?:\s*(1[0-2]|[1-9])\s*月)?\s*(底|末)?\s*(前|以前|之前|以来|起|后)?/g;

const RELATIVE_TIME: Gloss[] = [
  { zh: "本月底前", en: "by the end of this month" },
  { zh: "本月底", en: "by the end of this month" },
  { zh: "本年底前", en: "by year-end" },
  { zh: "年底前", en: "by year-end" },
  { zh: "年内", en: "within the year" },
  { zh: "月内", en: "within the month" },
  { zh: "限期", en: "within a set deadline" },
  { zh: "十四五", en: "the 14th Five-Year Plan period (2021-2025)" },
  { zh: "十五五", en: "the 15th Five-Year Plan period (2026-2030)" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* ------------------------------------------------------------- quantities */

const QUANTITY_UNITS: Gloss[] = [
  { zh: "个百分点", en: "percentage points" },
  { zh: "百分点", en: "percentage points" },
  { zh: "万标箱", en: "×10,000 TEU" },
  { zh: "万千瓦", en: "×10,000 kW" },
  { zh: "万吨", en: "×10,000 tonnes" },
  { zh: "万辆", en: "×10,000 units" },
  { zh: "万台", en: "×10,000 units" },
  { zh: "万人", en: "×10,000 people" },
  { zh: "万家", en: "×10,000 firms" },
  { zh: "倍", en: "-fold" },
  { zh: "%", en: "%" },
  { zh: "％", en: "%" },
];

const QUANTITY_RX = new RegExp(
  `(不少于|不低于|至少|不超过|不高于|超过|约|近|达)?\\s*(\\d+(?:\\.\\d+)?)\\s*(${QUANTITY_UNITS.map((u) => u.zh).join("|")})`,
  "g"
);

/* ------------------------------------------------------------------ scope */

const SCOPE_MARKERS: { zh: string; en: string; takesSubject: boolean }[] = [
  { zh: "先行先试", en: "early-pilot latitude", takesSubject: false },
  { zh: "全国推开", en: "a nationwide rollout", takesSubject: false },
  { zh: "全面推开", en: "a full rollout", takesSubject: false },
  { zh: "重点地区", en: "designated key regions", takesSubject: false },
  { zh: "重点行业", en: "designated key industries", takesSubject: false },
  { zh: "分批", en: "a phased (batch) rollout", takesSubject: false },
  { zh: "试点", en: "pilot", takesSubject: true },
];

const SCOPE_STOPS = ["支持", "开展", "推进", "推动", "实施", "围绕", "启动", "扩大", "深化"];

function subjectBefore(text: string, index: number, max = 14): string {
  let start = index;
  while (start > 0 && index - start < max && CJK.test(text[start - 1])) start -= 1;
  let raw = text.slice(start, index);
  for (const stop of SCOPE_STOPS) {
    const at = raw.lastIndexOf(stop);
    if (at >= 0) raw = raw.slice(at + stop.length);
  }
  return raw;
}

/* ------------------------------------------------------------ prohibitions */

const PROHIBIT_LEADS: { zh: string; verb: string }[] = [
  { zh: "一律不得", verb: "flatly bars" },
  { zh: "严禁", verb: "expressly prohibits" },
  { zh: "禁止", verb: "prohibits" },
  { zh: "严肃查处", verb: "promises enforcement action against" },
  { zh: "坚决防止", verb: "commits to preventing" },
  { zh: "不得", verb: "bars" },
];

const REDLINE_RX = /(守住|坚决守住)?(不发生)?([\u4e00-\u9fff]{0,10})(底线|红线)/g;

/* --------------------------------------------------------------- subjects */

const SUBJECTS: Gloss[] = GLOSS.filter((g) =>
  [
    "新能源汽车",
    "动力电池",
    "充电桩",
    "集成电路",
    "半导体",
    "芯片",
    "人工智能",
    "大模型",
    "算力",
    "算力枢纽",
    "专精特新",
    "中小企业",
    "制造业",
    "房地产",
    "地方债",
    "隐性债务",
    "保交楼",
    "关键矿产",
    "稀土",
    "菜籽油",
    "菜籽",
    "软木",
    "粮食安全",
    "乡村振兴",
    "耕地",
    "粤港澳",
    "长三角",
    "京津冀",
    "东北",
    "新疆",
    "西藏",
    "南海",
    "台海",
    "两岸",
    "台湾",
    "中加",
    "加拿大",
    "一带一路",
    "军工",
    "国防",
    "社会治理",
    "基层治理",
    "共同富裕",
    "舆情",
    "统一大市场",
    "双循环",
    "数据",
  ].includes(g.zh)
);

const SUBJECTS_SORTED = [...SUBJECTS].sort((a, b) => b.zh.length - a.zh.length);

/* ------------------------------------------------------------- extraction */

function baseFact(
  text: string,
  index: number,
  valueZh: string
): Pick<ExtractedFact, "value_zh" | "quote" | "sentence" | "index"> {
  return {
    value_zh: valueZh,
    quote: clauseSpan(text, index, valueZh.length),
    sentence: sentenceSpan(text, index, valueZh.length),
    index,
  };
}

function allIndexes(text: string, needle: string): number[] {
  const out: number[] = [];
  let at = text.indexOf(needle);
  while (at >= 0) {
    out.push(at);
    at = text.indexOf(needle, at + needle.length);
  }
  return out;
}

function extractActors(text: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const claimed: { start: number; end: number }[] = [];
  const overlaps = (start: number, end: number) =>
    claimed.some((c) => start < c.end && end > c.start);

  for (const issuer of ISSUERS_SORTED) {
    for (const at of allIndexes(text, issuer.zh)) {
      let len = issuer.zh.length;
      let roleEn = "";
      for (const role of ROLES) {
        if (text.startsWith(role.zh, at + issuer.zh.length)) {
          len += role.zh.length;
          roleEn = role.en;
          break;
        }
      }
      if (overlaps(at, at + len)) continue;
      claimed.push({ start: at, end: at + len });
      const form: ActorForm = roleEn ? "person" : issuer.form;
      const value_en = roleEn ? `${issuer.en} ${roleEn}` : issuer.en;
      out.push({
        kind: "actor",
        ...baseFact(text, at, text.slice(at, at + len)),
        value_en,
        fragment_en: `acting body: ${value_en}`,
        point_en: `Names the acting body — ${value_en}.`,
        qualifier: null,
        actor_form: form,
      });
    }
  }

  for (const vague of UNNAMED_ACTORS) {
    const at = text.indexOf(vague.zh);
    if (at < 0 || overlaps(at, at + vague.zh.length)) continue;
    claimed.push({ start: at, end: at + vague.zh.length });
    out.push({
      kind: "actor",
      ...baseFact(text, at, vague.zh),
      value_en: vague.en,
      fragment_en: `acting body left open: ${vague.en}`,
      point_en: `Leaves the acting body unnamed — ${vague.en}.`,
      qualifier: null,
      actor_form: "unnamed",
    });
  }

  return out.sort((a, b) => a.index - b.index);
}

function extractInstruments(text: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const claimed: { start: number; end: number }[] = [];

  for (const meta of INSTRUMENT_SORTED) {
    for (const at of allIndexes(text, meta.zh)) {
      const end = at + meta.zh.length;
      if (claimed.some((c) => at < c.end && end > c.start)) continue;
      const modifier = modifierBefore(text, at);
      const start = at - modifier.length;
      claimed.push({ start, end });

      const value_zh = text.slice(start, end);
      const whole = glossPhrase(value_zh);
      const mod = glossPhrase(modifier);
      let value_en: string;
      if (modifier && whole.covered >= 0.85 && whole.en) {
        value_en = whole.en;
      } else if (modifier && mod.en) {
        value_en = `${mod.en} ${stripArticle(meta.en)}`;
      } else {
        value_en = meta.en;
      }
      value_en = withArticle(value_en, meta.plural);

      const clause = clauseSpan(text, start, value_zh.length);
      const issued = /(近日|日前|已)?\s*(印发|发布|公布|颁布)/.test(clause);

      out.push({
        kind: "instrument",
        ...baseFact(text, start, value_zh),
        value_en,
        type_en: stripArticle(meta.en),
        issued,
        fragment_en: `instrument: ${value_en}${issued ? " (already issued)" : " (promised, not yet published)"}`,
        point_en: issued
          ? `Names an instrument already issued — ${value_en}.`
          : `Names the instrument still to be issued — ${value_en}.`,
        qualifier: null,
      });
    }
  }

  return out.sort((a, b) => a.index - b.index);
}

function stripArticle(en: string): string {
  return en.replace(/^(a|an|the)\s+/i, "");
}

function withArticle(en: string, plural: boolean): string {
  if (plural) return stripArticle(en);
  if (/^(a|an|the)\s/i.test(en)) return en;
  return `${/^[aeiou]/i.test(en) ? "an" : "a"} ${en}`;
}

function extractDeadlines(text: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const claimed: { start: number; end: number }[] = [];

  DEADLINE_RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DEADLINE_RX.exec(text)) !== null) {
    const value_zh = m[0];
    if (!value_zh.trim()) continue;
    const year = m[1];
    const month = m[2] ? Number(m[2]) : null;
    const endMark = m[3];
    const rel = m[4];

    let value_en: string;
    const when = month ? `${MONTHS[month - 1]} ${year}` : year;
    if (endMark && (rel === "前" || rel === "以前" || rel === "之前")) {
      value_en = `by end-${month ? `${MONTHS[month - 1]} ${year}` : year}`;
    } else if (endMark) {
      value_en = `end-${when}`;
    } else if (rel === "前" || rel === "以前" || rel === "之前") {
      value_en = `before ${when}`;
    } else if (rel === "以来") {
      value_en = `since ${when}`;
    } else if (rel === "起") {
      value_en = `from ${when}`;
    } else if (rel === "后") {
      value_en = `after ${when}`;
    } else {
      value_en = `in ${when}`;
    }

    claimed.push({ start: m.index, end: m.index + value_zh.length });
    out.push({
      kind: "deadline",
      ...baseFact(text, m.index, value_zh),
      value_en,
      fragment_en: `deadline: ${value_en}`,
      point_en: `Sets a time marker — ${value_en}.`,
      qualifier: null,
    });
  }

  for (const rt of RELATIVE_TIME) {
    const at = text.indexOf(rt.zh);
    if (at < 0) continue;
    if (claimed.some((c) => at < c.end && at + rt.zh.length > c.start)) continue;
    claimed.push({ start: at, end: at + rt.zh.length });
    out.push({
      kind: "deadline",
      ...baseFact(text, at, rt.zh),
      value_en: rt.en,
      fragment_en: `deadline: ${rt.en}`,
      point_en: `Sets a time marker — ${rt.en}.`,
      qualifier: null,
    });
  }

  return out.sort((a, b) => a.index - b.index);
}

function vehicleIn(clause: string): Gloss | null {
  for (const v of FUNDING_VEHICLES) {
    if (clause.includes(v.zh)) return v;
  }
  return null;
}

function extractMoney(text: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const covered: { start: number; end: number }[] = [];

  MONEY_RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RX.exec(text)) !== null) {
    const qualZh = m[1] || "";
    const num = Number(m[2]);
    const unitZh = m[3];
    const unit = MONEY_UNITS.find((u) => u.zh === unitZh);
    if (!unit || !Number.isFinite(num)) continue;

    // Only treat as money when the unit is monetary or a funding cue sits nearby.
    const clause = clauseSpan(text, m.index, m[0].length);
    const vehicle = vehicleIn(clause);
    const monetaryUnit = unitZh.endsWith("元");
    if (!monetaryUnit && !vehicle) continue;

    const qual = qualZh ? QUALIFIER_EN[qualZh] : undefined;
    const amount = formatYuan(num * unit.multiplier);
    const amount_en = qual ? `${qual.en} ${amount}` : amount;
    const value_en = vehicle ? `${amount_en} in ${stripArticle(vehicle.en)}` : amount_en;

    covered.push({ start: m.index, end: m.index + m[0].length });
    out.push({
      kind: "money",
      ...baseFact(text, m.index, m[0]),
      value_en,
      fragment_en: `funding: ${value_en}`,
      point_en: `Attaches a funding line — ${value_en}.`,
      qualifier: qual?.q ?? null,
      has_amount: true,
      amount_en,
      vehicle_en: vehicle ? stripArticle(vehicle.en) : undefined,
    });
  }

  // Funding vehicle named with no amount attached — still a resource cue.
  if (!out.length) {
    for (const v of FUNDING_VEHICLES) {
      const at = text.indexOf(v.zh);
      if (at < 0) continue;
      if (covered.some((c) => at < c.end && at + v.zh.length > c.start)) continue;
      const value_en = `${v.en} (no amount stated)`;
      out.push({
        kind: "money",
        ...baseFact(text, at, v.zh),
        value_en,
        fragment_en: `funding: ${value_en}`,
        point_en: `Names a funding vehicle without an amount — ${v.en}.`,
        qualifier: null,
        has_amount: false,
        vehicle_en: stripArticle(v.en),
      });
      break;
    }
  }

  return out.sort((a, b) => a.index - b.index);
}

function extractQuantities(text: string, moneySpans: { start: number; end: number }[]): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  QUANTITY_RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUANTITY_RX.exec(text)) !== null) {
    if (moneySpans.some((s) => m!.index < s.end && m!.index + m![0].length > s.start)) continue;
    const qualZh = m[1] || "";
    const num = m[2];
    const unitZh = m[3];
    const unit = QUANTITY_UNITS.find((u) => u.zh === unitZh);
    if (!unit) continue;
    const qual = qualZh ? QUALIFIER_EN[qualZh] : undefined;
    const rendered = unit.en.startsWith("×")
      ? `${Number(num) * 10000} ${unit.en.replace(/^×[\d,]+\s*/, "")}`
      : unit.en === "%"
        ? `${num}%`
        : unit.en === "-fold"
          ? `${num}-fold`
          : `${num} ${unit.en}`;
    const value_en = qual ? `${qual.en} ${rendered}` : rendered;
    out.push({
      kind: "quantity",
      ...baseFact(text, m.index, m[0]),
      value_en,
      fragment_en: `quantified figure: ${value_en}`,
      point_en: `States a quantified figure — ${value_en}.`,
      qualifier: qual?.q ?? null,
    });
  }
  return out;
}

function extractScope(text: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const claimed: { start: number; end: number }[] = [];

  for (const marker of SCOPE_MARKERS) {
    for (const at of allIndexes(text, marker.zh)) {
      const end = at + marker.zh.length;
      if (claimed.some((c) => at < c.end && end > c.start)) continue;
      let start = at;
      let value_en = marker.en;
      if (marker.takesSubject) {
        const subject = subjectBefore(text, at);
        const glossed = glossPhrase(subject);
        start = at - subject.length;
        value_en =
          subject && glossed.en && glossed.covered >= 0.6
            ? `a ${glossed.en} pilot`
            : "a pilot (scope not translated — see quoted excerpt)";
      }
      claimed.push({ start, end });
      out.push({
        kind: "scope",
        ...baseFact(text, start, text.slice(start, end)),
        value_en,
        fragment_en: `scope: ${value_en}`,
        point_en: `Bounds delivery — ${value_en}.`,
        qualifier: null,
      });
    }
  }

  return out.sort((a, b) => a.index - b.index);
}

function extractProhibitions(text: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const claimed: { start: number; end: number }[] = [];

  for (const lead of PROHIBIT_LEADS) {
    for (const at of allIndexes(text, lead.zh)) {
      if (claimed.some((c) => at < c.end && at + lead.zh.length > c.start)) continue;
      let tail = "";
      let i = at + lead.zh.length;
      while (i < text.length && tail.length < 12 && CJK.test(text[i])) {
        tail += text[i];
        i += 1;
      }
      const value_zh = text.slice(at, at + lead.zh.length + tail.length);
      claimed.push({ start: at, end: at + value_zh.length });
      const glossed = glossPhrase(tail);
      const value_en =
        tail && glossed.en && glossed.covered >= 0.6
          ? `${lead.verb} ${glossed.en}`
          : `${lead.verb} a practice named only in the Mandarin excerpt`;
      out.push({
        kind: "prohibition",
        ...baseFact(text, at, value_zh),
        value_en,
        fragment_en: `prohibition: the text ${value_en}`,
        point_en: `States a prohibition — the text ${value_en}.`,
        qualifier: null,
      });
    }
  }

  REDLINE_RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REDLINE_RX.exec(text)) !== null) {
    if (claimed.some((c) => m!.index < c.end && m!.index + m![0].length > c.start)) continue;
    const topic = glossPhrase(m[3] || "");
    const value_en = topic.en && topic.covered >= 0.5
      ? `states a red line on ${topic.en}`
      : "states a red line (topic named only in the Mandarin excerpt)";
    claimed.push({ start: m.index, end: m.index + m[0].length });
    out.push({
      kind: "prohibition",
      ...baseFact(text, m.index, m[0]),
      value_en,
      fragment_en: `red line: the text ${value_en}`,
      point_en: `States a red line — the text ${value_en}.`,
      qualifier: null,
    });
  }

  return out.sort((a, b) => a.index - b.index);
}

function extractSubjects(text: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const claimed: { start: number; end: number }[] = [];
  const seen = new Set<string>();

  for (const s of SUBJECTS_SORTED) {
    const at = text.indexOf(s.zh);
    if (at < 0) continue;
    if (claimed.some((c) => at < c.end && at + s.zh.length > c.start)) continue;
    if (seen.has(s.en)) continue;
    seen.add(s.en);
    claimed.push({ start: at, end: at + s.zh.length });
    out.push({
      kind: "subject",
      ...baseFact(text, at, s.zh),
      value_en: s.en,
      fragment_en: `subject: ${s.en}`,
      point_en: `Names a subject in scope — ${s.en}.`,
      qualifier: null,
    });
  }

  return out.sort((a, b) => a.index - b.index);
}

export function extractFacts(sourceText: string): FactSet {
  const text = sourceText || "";
  const actor = extractActors(text);
  const instrument = extractInstruments(text);
  const deadline = extractDeadlines(text);
  const money = extractMoney(text);
  const moneySpans = money.map((f) => ({ start: f.index, end: f.index + f.value_zh.length }));
  const quantity = extractQuantities(text, moneySpans);
  const scope = extractScope(text);
  const prohibition = extractProhibitions(text);
  const subject = extractSubjects(text);

  const facts = [
    ...actor,
    ...instrument,
    ...deadline,
    ...money,
    ...quantity,
    ...scope,
    ...prohibition,
    ...subject,
  ].sort((a, b) => a.index - b.index);

  return {
    facts,
    actor,
    instrument,
    deadline,
    money,
    quantity,
    scope,
    subject,
    prohibition,
    named_actor: actor.some((a) => a.actor_form !== "unnamed"),
    funded: money.some((f) => f.has_amount),
  };
}

/* ------------------------------------------------------------ composition */

function joinList(items: string[]): string {
  const uniq = [...new Set(items.filter(Boolean))];
  if (uniq.length <= 1) return uniq[0] || "";
  if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]}`;
  return `${uniq.slice(0, -1).join(", ")} and ${uniq[uniq.length - 1]}`;
}

function actorSegment(set: FactSet): string {
  const named = set.actor.filter((a) => a.actor_form !== "unnamed");
  if (!named.length) {
    const vague = set.actor[0];
    return vague ? `Attributed only to ${vague.value_en}` : "";
  }
  const people = named.filter((a) => a.actor_form === "person");
  const meetings = named.filter((a) => a.actor_form === "meeting");
  const bodies = named.filter((a) => a.actor_form === "body");
  const segs: string[] = [];
  if (people.length) {
    segs.push(`${joinList(people.slice(0, 3).map((a) => a.value_en))} statement`);
  }
  if (meetings.length) {
    segs.push(`${joinList(meetings.slice(0, 2).map((a) => a.value_en))} readout`);
  }
  if (bodies.length && !people.length) {
    segs.push(joinList(bodies.slice(0, 2).map((a) => a.value_en)));
  }
  return joinList(segs);
}

const ABSENCE_LABELS: { key: keyof FactSet; label: string }[] = [
  { key: "instrument", label: "a named instrument" },
  { key: "money", label: "a funding line" },
  { key: "deadline", label: "a deadline or time marker" },
  { key: "quantity", label: "a quantified target" },
  { key: "scope", label: "a pilot or scope boundary" },
];

function absences(set: FactSet): string[] {
  return ABSENCE_LABELS.filter((a) => (set[a.key] as ExtractedFact[]).length === 0).map(
    (a) => a.label
  );
}

/** Composed factual WHAT — English prose built from extracted values. */
export function composeWhatEn(
  set: FactSet,
  opts?: { sourceCount?: number; sourceLabels?: string[] }
): string {
  const lead =
    (opts?.sourceCount ?? 1) > 1
      ? `Merged ${opts?.sourceCount} public excerpts (${(opts?.sourceLabels || []).join(", ")}). `
      : "";

  const segs: string[] = [];
  const actorSeg = actorSegment(set);
  if (actorSeg) segs.push(actorSeg);

  const instrument = set.instrument[0];
  const deadline = set.deadline[0];
  if (instrument) {
    const verb = instrument.issued ? "issued" : "to be issued";
    segs.push(`${instrument.value_en} ${verb}${deadline ? ` ${deadline.value_en}` : ""}`);
  } else if (deadline) {
    segs.push(`time marker set for ${deadline.value_en}, with no document title named`);
  }

  const money = set.money.filter((f) => f.has_amount);
  const scope = set.scope[0];
  if (money.length) {
    const amounts = joinList(money.slice(0, 2).map((f) => f.value_en));
    segs.push(scope ? `${amounts} for ${scope.value_en}` : amounts);
  } else if (scope) {
    segs.push(`delivery bounded to ${scope.value_en}`);
  } else if (set.money.length) {
    segs.push(set.money[0].value_en);
  }

  if (set.quantity.length) {
    segs.push(`quantified figures: ${joinList(set.quantity.slice(0, 3).map((f) => f.value_en))}`);
  }

  const carriedSubjects = Boolean(instrument || money.length || scope);
  if (set.subject.length && !carriedSubjects) {
    segs.push(`named subjects: ${joinList(set.subject.slice(0, 4).map((f) => f.value_en))}`);
  }

  const sentences: string[] = [];
  if (segs.length) sentences.push(sentenceCase(`${lead}${segs.join("; ")}.`));
  else if (lead) sentences.push(lead.trim());

  if (set.prohibition.length) {
    sentences.push(
      `The text also ${joinList(set.prohibition.slice(0, 2).map((f) => f.value_en))}.`
    );
  }

  const gaps = absences(set);
  if (!set.named_actor && set.actor.length) gaps.unshift("an implementing body");
  if (gaps.length) {
    sentences.push(`Not specified in the excerpt: ${joinList(gaps)}.`);
  }

  if (!sentences.length) {
    return "No actor, instrument, amount, deadline, scope, or prohibition could be extracted from this excerpt.";
  }
  return sentences.join(" ");
}

/** Capitalise the opening word without disturbing the rest of the sentence. */
function sentenceCase(s: string): string {
  const trimmed = s.replace(/^the\s+/, "The ");
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

export type DigestRow = { point: string; quote: string; source_label: string };

/**
 * Digest rows grouped by sentence: each `point` states in English what the
 * quote establishes, and each `quote` stays an exact substring of the paste.
 */
export function composeDigestRows(
  sourceText: string,
  sourceLabel: string,
  max = 4
): DigestRow[] {
  const set = extractFacts(sourceText);
  const groups = new Map<string, ExtractedFact[]>();
  for (const f of set.facts) {
    if (!f.sentence) continue;
    const bucket = groups.get(f.sentence);
    if (bucket) bucket.push(f);
    else groups.set(f.sentence, [f]);
  }

  const rows: DigestRow[] = [];
  for (const [sentence, facts] of groups) {
    if (!sourceText.includes(sentence)) continue;
    const seen = new Set<string>();
    const fragments: string[] = [];
    for (const f of facts) {
      if (seen.has(f.fragment_en)) continue;
      seen.add(f.fragment_en);
      fragments.push(f.fragment_en);
      if (fragments.length >= 4) break;
    }
    if (!fragments.length) continue;
    rows.push({
      point: `Establishes ${fragments.join("; ")}.`,
      quote: sentence,
      source_label: sourceLabel,
    });
    if (rows.length >= max) break;
  }
  return rows;
}

/** Plain-English summary of what a rejected paste was missing. */
export function composeRejectionWhat(set: FactSet): string {
  const present: string[] = [];
  if (set.actor.length) {
    present.push(`acting party (${set.actor[0].value_en})`);
  }
  if (set.subject.length) {
    present.push(`subject (${joinList(set.subject.slice(0, 3).map((f) => f.value_en))})`);
  }
  const gaps = absences(set);
  return [
    "Not adopted — this excerpt carries no verifiable detail.",
    present.length ? `Named in the paste: ${joinList(present)}.` : "",
    gaps.length ? `Missing: ${joinList(gaps)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
