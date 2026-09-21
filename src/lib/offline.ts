import type { BriefingJson } from "./gate.js";
import {
  buildSignalingScorecard,
  confidenceFromBand,
  valvesFromScorecard,
} from "./media-heuristics.js";

export type OfflineSource = { label: string; text: string };

type DomainHint = {
  id: string;
  test: (text: string, cards: string[]) => boolean;
  soWhat: string;
  base: string;
  downside: string;
  upside: string;
  watch: string[];
};

const DOMAIN_HINTS: DomainHint[] = [
  {
    id: "implementing_instrument",
    test: (t) => /实施细则|实施方案|配套办法|印发通知|印发.*办法/.test(t),
    soWhat:
      "Instrument language raises implementation-track confidence vs meeting-only text, but still only within the public excerpt — check scope, timeline, and responsible bodies if named.",
    base: "Instrument vocabulary continues to operationalize the same priorities",
    downside: "Instrument is procedural/empty of timelines or responsible units",
    upside: "Subsequent instruments cite the same measures with measurable targets",
    watch: ["Deadlines, responsible departments, and whether targets are quantified"],
  },
  {
    id: "leadership_meeting",
    test: (t) => /中央经济工作会议|中央政治局|中央全会|两会/.test(t),
    soWhat:
      "Treat as high-salience direction language. Separate stated priorities from any implementing detail; do not equate meeting vocabulary with operational rollout.",
    base: "Public messaging continues to repeat the same priority set from the meeting excerpt",
    downside: "Follow-on coverage thins or shifts vocabulary before 细则 appear",
    upside: "Later notices/methods reuse the same priority terms",
    watch: [
      "First named 通知/办法 after the meeting language",
      "Whether 高质量发展 / 新质生产力 remain co-located in later texts",
    ],
  },
  {
    id: "dual_circulation",
    test: (t) => /双循环|统一大市场|国内大循环/.test(t),
    soWhat:
      "Dual-circulation / unified-market language points to domestic market integration and supply-chain resilience themes — keep claims inside the excerpt.",
    base: "Dual-circulation vocabulary continues alongside industrial-security cues",
    downside: "Unified-market rhetoric without anti-protection / flow-facilitation measures",
    upside: "Instruments name market-integration or substitution steps",
    watch: ["统一大市场 vs 产业链安全可控 pairing"],
  },
  {
    id: "foreign_affairs",
    test: (t, c) => /一带一路|人类命运共同体|外交部|外事/.test(t) || c.includes("foreign-policy-discourse"),
    soWhat:
      "Map diplomatic framing terms carefully; distinguish ritual greetings from substantive commitments evidenced in the paste.",
    base: "Diplomatic framing vocabulary remains stable in public statements",
    downside: "Tone hardens or partners named differently without matching deeds in open sources",
    upside: "Follow-on public MOUs/projects echo the same framing",
    watch: ["Named partners, project lists, and MFA-style formulations vs economic follow-through"],
  },
  {
    id: "finance_risk",
    test: (t, c) =>
      /地方债|房地产|系统性风险|金融风险|化债/.test(t) || c.includes("finance-risk-lexicon"),
    soWhat:
      "Risk-management language is often precautionary. Separate acknowledgment of risk from evidence of a concrete containment package.",
    base: "Public risk-management vocabulary continues without abrupt escalation markers",
    downside: "Risk terms intensify while instruments remain generic",
    upside: "Named 化债 / property support tools appear with scope limits",
    watch: ["Local debt vs property framing; whether ‘系统性’ is used carefully"],
  },
  {
    id: "rural_food",
    test: (t, c) =>
      /乡村振兴|粮食安全|耕地|三农/.test(t) || c.includes("rural-revitalization-lexicon"),
    soWhat:
      "Rural/food-security language often pairs continuity with seasonal/campaign cues; note whether targets or land/food metrics appear.",
    base: "Rural revitalization / food-security priorities stay in the public cycle",
    downside: "Campaign language without measurable acreage/yield/support tools",
    upside: "Follow-on notices quantify support or land-protection measures",
    watch: ["粮食安全 vs 乡村振兴 co-occurrence; any numeric targets"],
  },
  {
    id: "ideology_party",
    test: (t, c) =>
      /主题教育|思想政治|全面从严治党|意识形态|巡视/.test(t) ||
      c.includes("ideology-education-lexicon"),
    soWhat:
      "Ideology/Party-building language is organizational signaling. Track study campaigns vs discipline/inspection vocabulary separately.",
    base: "Study/discipline vocabulary continues in routine public reporting",
    downside: "Inspection/rectification language rises without clarifying scope in the excerpt",
    upside: "Theme-education language ties explicitly to policy delivery metrics",
    watch: ["主题教育 vs 巡视整改 balance; any named rectification outcomes"],
  },
  {
    id: "defense_public",
    test: (t, c) =>
      /国防|军队|解放军|军委|强军|军工|演训|战备/.test(t) || c.includes("defense-public-discourse"),
    soWhat:
      "Read as public defense discourse only. Separate ritual 强军 language from any named exchanges, white-paper lines, or industrial-support cues in the paste — do not invent readiness or ORBAT claims.",
    base: "Public defense framing vocabulary continues in routine open reporting",
    downside: "Readiness/演训 language rises without open instruments or budget cues",
    upside: "Follow-on public white papers or exchange notices echo the same framing",
    watch: ["Named 演训/交流 vs generic 强军 slogans", "Any open 军工/自主可控 industrial link"],
  },
  {
    id: "industrial_tech",
    test: (t, c) =>
      /芯片|半导体|人工智能|专精特新|卡脖子/.test(t) ||
      (c.includes("industrial-tech-policy") && /制造业|关键核心技术|新质生产力/.test(t)),
    soWhat:
      "Industrial/tech vocabulary signals priority domains for open-source tracking; avoid inferring capability leaps beyond what the text states.",
    base: "Tech-industry priority language persists in subsequent public guidance",
    downside: "Rhetoric outpaces named instruments or funding vehicles in open corpus",
    upside: "Sector notices name chips/AI/supply-chain measures with concrete tools",
    watch: ["Named industries, 国产替代 cues, and whether 卡脖子 appears with remedies"],
  },
  {
    id: "social_governance",
    test: (t, c) =>
      /社会治理|舆情|正能量|和谐稳定|共同富裕|基层治理/.test(t) ||
      c.includes("social-governance-lexicon"),
    soWhat:
      "Social-governance excerpts often mix livelihood and stability vocabulary; note which side dominates the paste.",
    base: "Governance/stability framing remains routine in local public messaging",
    downside: "Stability/舆情 language rises relative to livelihood measures in later texts",
    upside: "Livelihood/common-prosperity tools appear with concrete local measures",
    watch: ["舆情/正能量 vs 民生/共同富裕 balance"],
  },
];

function pickDomainHint(text: string, cards: string[]): DomainHint | null {
  for (const h of DOMAIN_HINTS) {
    if (h.test(text, cards)) return h;
  }
  return null;
}

/** Rule-based fallback so the demo runs without API keys. */
export function offlineBriefing(
  sourceText: string,
  matchedCards: string[],
  sourceLabel?: string,
  sources?: OfflineSource[]
): BriefingJson {
  const corpus: OfflineSource[] =
    sources && sources.length > 0
      ? sources
      : [{ label: sourceLabel || "paste-1", text: sourceText }];

  const digest: BriefingJson["source_digest_zh"] = [];
  for (const src of corpus) {
    const sentences = src.text
      .split(/[。！？；\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8)
      .slice(0, corpus.length > 1 ? 2 : 4);
    for (const s of sentences) {
      const quote = s.length > 36 ? s.slice(0, 36) : s;
      digest.push({
        point: `[${src.label}] ${quote}${s.length > 36 ? "…" : ""}`,
        quote,
        source_label: src.label,
      });
    }
  }

  const context_notes = matchedCards.map((card) => ({
    card,
    note:
      card === "policy-signaling-valves"
        ? "Matched signaling catalog: enumerate all public-media heuristics, then apply weights — not secret rules."
        : `Matched lexicon/card "${card}" from keywords in the paste. Treat as background for vocabulary only — not proof of intent.`,
    tag: "background" as const,
  }));

  if (!context_notes.length) {
    context_notes.push({
      card: "(none)",
      note: "No context-card keywords matched. Briefing stays close to the literal source.",
      tag: "background",
    });
  }

  const head =
    corpus[0].text
      .split(/[。！？；\n]+/)
      .map((s) => s.trim())
      .find((s) => s.length >= 8) || corpus[0].text.slice(0, 80);
  const what =
    corpus.length > 1
      ? `Merged ${corpus.length} public sources (${corpus.map((s) => s.label).join(", ")}). Lead excerpt: ${head.slice(0, 100)}${head.length > 100 ? "…" : ""}`
      : `The Mandarin source discusses: ${head.slice(0, 120)}${head.length > 120 ? "…" : ""}`;

  const policyRelated = matchedCards.some((c) =>
    /macro-policy|industrial-tech|foreign-policy|party-state|social-governance|policy-signaling|five-year|finance-risk|dual-circulation|rural-revitalization|ideology|defense-public|boilerplate/.test(
      c
    )
  );

  const joined = corpus.map((s) => s.text).join("\n");
  const scorecard = buildSignalingScorecard(joined);
  const valves = valvesFromScorecard(scorecard);
  const detailMiss = scorecard.rules.find((r) => r.id === "detail-named-instrument")?.status === "miss";
  const hasInstrument = corpus.some((s) => /通知|办法|意见|细则|条例|印发/.test(s.text));
  const hint = pickDomainHint(joined, matchedCards);

  const so_what =
    corpus.length > 1
      ? hint
        ? `${hint.soWhat} With ${corpus.length} excerpts, compare meeting-style direction vs any 通知/办法 language before raising confidence.`
        : `With ${corpus.length} excerpts, compare direction language vs implementing detail; do not invent facts beyond the paste.`
      : hint
        ? hint.soWhat
        : substance_cut_band_hint(scorecard.band);

  const scenarios = policyRelated
    ? [
        {
          label: hint?.base || "Public messaging continues to repeat the same priorities",
          likelihood: "medium" as const,
          basis: "Continuity reading from this paste only (hypothesis).",
          tag: "hypothesis" as const,
        },
        {
          label: hint?.downside || "Implementation stays thin until a named 细则/办法 appears",
          likelihood: (detailMiss ? "medium" : "low") as "medium" | "low",
          basis: "No clear implementing instrument in the paste (hypothesis).",
          tag: "hypothesis" as const,
        },
        {
          label: hint?.upside || "A later public instrument reinforces the same vocabulary",
          likelihood: (hasInstrument ? "medium" : "low") as "medium" | "low",
          basis: hasInstrument
            ? "Instrument cues already present in paste (hypothesis)."
            : "Would need a follow-on public notice (hypothesis).",
          tag: "hypothesis" as const,
        },
      ]
    : [
        {
          label: "Keep outlook minimal — weak policy-card match",
          likelihood: "low" as const,
          basis: "Few policy cards matched.",
          tag: "hypothesis" as const,
        },
      ];

  const watchpoints = policyRelated
    ? [
        ...(hint?.watch || []),
        "Find a later 通知/办法 that names the same priorities",
        "Confirm outlet/title if not in the paste",
      ].slice(0, 5)
    : ["Paste a fuller public policy excerpt and re-run"];

  return {
    source_digest_zh: digest,
    context_notes,
    signaling_scorecard: scorecard,
    signaling_valves: valves,
    briefing_en: {
      what,
      context: `Public Mandarin excerpt(s): ${corpus.map((s) => s.label).join(", ")}. Signaling band=${scorecard.band} (hypothesis calibrator only).`,
      so_what,
      confidence: confidenceFromBand(scorecard.band),
      sources_used: corpus.map((s) => s.label),
    },
    policy_outlook: {
      horizon: "near",
      scenarios,
      watchpoints,
    },
    open_questions: [
      "Is there a public URL/title for this excerpt?",
      corpus.length > 1
        ? "Do the merged excerpts agree on priorities and instruments?"
        : "Is there a matching implementing notice for the same priorities?",
      "Which claims still need a second open source?",
    ],
  };
}

function substance_cut_band_hint(band: string): string {
  if (band === "high") {
    return "Public cues look relatively strong in this excerpt; still verify with a second open source before raising confidence.";
  }
  if (band === "medium") {
    return "Mixed public cues — separate slogan/direction language from any concrete numbers, deadlines, or named instruments.";
  }
  return "Thin public cues in this excerpt — treat as low-information direction language until denser detail appears.";
}
