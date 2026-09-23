/**
 * Curated outlet/channel-tier priors (hypothesis) — docs/DP-V3.md §2.
 *
 * Distinct from src/lib/source-tier.ts (which tiers the DOCUMENT TYPE —
 * instrument vs wire vs commentary). This tiers the OUTLET a document was
 * published through (People's Daily vs a commercial blog), independent of
 * what kind of document it is. The two compose: a policy instrument
 * republished on a commercial aggregator is document-tier A but
 * channel-tier "commercial".
 *
 * Like source-tier.ts: `authority_weight` is a stated editorial prior, hand-set
 * from publicly documented institutional rank (see sources below) — never
 * fitted to labelled data. Show the tier label + `basis_en`, not the raw
 * number, to a reader.
 */

export const CHANNEL_TIER_IDS = [
  "central_party_organ",
  "central_wire",
  "central_broadcast",
  "specialized_channel",
  "ministry_official",
  "cac_licensed_account",
  "local_party_organ",
  "commercial",
  "unknown",
] as const;
export type ChannelTierId = (typeof CHANNEL_TIER_IDS)[number];

export const CHANNEL_TYPES = ["official_site", "wire", "tv", "wechat", "weibo"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export type ChannelTier = {
  tier: ChannelTierId;
  label_en: string;
  /** Stated editorial prior, 0-1 — internal ordering only, never shown raw to a reader. */
  authority_weight: number;
  basis_en: string;
  sources: string[];
};

/**
 * Political/institutional rank of the big three central outlets is not flat
 * even though all three hold ministerial (正部级) administrative rank —
 * People's Daily outranks Xinhua outranks CCTV by protocol convention
 * ("党领导一切" ordering). See docs/DP-V3.md §2 for the research trail.
 */
export const CHANNEL_TIER_CATALOG: ChannelTier[] = [
  {
    tier: "central_party_organ",
    label_en: "Central party organ (People's Daily)",
    authority_weight: 1.0,
    basis_en:
      "Ministerial-rank (正部级) and ranked first among central outlets by party-protocol convention.",
    sources: ["知乎/中国经济传媒协会 — 人民日报社、新华社、总台都是啥级别"],
  },
  {
    tier: "central_wire",
    label_en: "Central wire service (Xinhua)",
    authority_weight: 0.92,
    basis_en: "Ministerial-rank State Council-affiliated wire; ranked second after People's Daily by convention.",
    sources: ["同上"],
  },
  {
    tier: "central_broadcast",
    label_en: "Central broadcast flagship (CCTV-1 / Xinwen Lianbo)",
    authority_weight: 0.85,
    basis_en:
      "CMG (parent) is ministerial-rank; CCTV alone is vice-ministerial (副部级). Xinwen Lianbo has been the designated first-release channel for major news since a 1982 CPC Central Committee directive.",
    sources: ["China Media Project", "zh.wikipedia.org — 新闻联播"],
  },
  {
    tier: "specialized_channel",
    label_en: "CCTV specialized channel (finance / defense)",
    authority_weight: 0.6,
    basis_en:
      "Authoritative for its beat (CCTV-2 finance, CCTV-7 defense/military — the latter explicitly positioned by MOD as a military-thought platform) but not a political-agenda-setting flagship like Xinwen Lianbo.",
    sources: ["中华人民共和国国防部 — CCTV-7国防军事频道开播通稿"],
  },
  {
    tier: "ministry_official",
    label_en: "Ministry / State Council official site",
    authority_weight: 0.8,
    basis_en: "Direct institutional source for its own portfolio (e.g. MOFCOM, NDRC, gov.cn).",
    sources: [],
  },
  {
    tier: "cac_licensed_account",
    label_en: "CAC-licensed news account (WeChat/Weibo)",
    authority_weight: 0.5,
    basis_en:
      "Holds a 互联网新闻信息服务许可 from the Cyberspace Administration of China — an objective, externally-checkable authorization, not an editorial guess.",
    sources: ["国家网信办 — 获得互联网新闻信息服务许可的公众账号名单"],
  },
  {
    tier: "local_party_organ",
    label_en: "Local/provincial party organ",
    authority_weight: 0.5,
    basis_en: "Authoritative for local matters; central-vs-local wording differences are themselves a signal (see corroboration §4).",
    sources: [],
  },
  {
    tier: "commercial",
    label_en: "Commercial / market media",
    authority_weight: 0.35,
    basis_en: "Market-facing outlet; useful for corroboration but not a first-line policy citation.",
    sources: [],
  },
  {
    tier: "unknown",
    label_en: "Unclassified channel",
    authority_weight: 0.3,
    basis_en: "No channel tier assigned — treat as low-mid prior until classified.",
    sources: [],
  },
];

export function resolveChannelTier(tier?: string | null): ChannelTier {
  const found = CHANNEL_TIER_CATALOG.find((c) => c.tier === tier);
  return found || CHANNEL_TIER_CATALOG.find((c) => c.tier === "unknown")!;
}

export function listChannelTierCatalog(): ChannelTier[] {
  return CHANNEL_TIER_CATALOG;
}
