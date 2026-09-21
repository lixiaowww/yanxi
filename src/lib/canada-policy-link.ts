/**
 * Link Mandarin public excerpts to *public* Canadian policy/regulation themes.
 * Reader-interest overlay only — NOT legal advice, NOT personal targeting.
 */

export type CanadaPolicyLinkLevel = "none" | "topical" | "named_instrument";

/** Stable public URL the human can open and verify. */
export type PublicRef = {
  title: string;
  url: string;
  publisher: string;
};

export type CanadaPolicyHit = {
  theme_id: string;
  theme_zh: string;
  theme_en: string;
  public_refs: PublicRef[];
  evidence: string;
  level: "topical" | "named_instrument";
};

export type CanadaPolicyLink = {
  framing: "civilian-canada-public-policy-overlay";
  level: CanadaPolicyLinkLevel;
  label_zh: string;
  hits: CanadaPolicyHit[];
  disclaimer_zh: string;
  rationale: string;
  tag: "hypothesis";
};

type Theme = {
  id: string;
  theme_zh: string;
  theme_en: string;
  rx: RegExp;
  public_refs: PublicRef[];
  namedRx?: RegExp;
};

/**
 * Prefer laws-lois.justice.gc.ca / canada.ca / international.gc.ca stable entry points.
 * Titles may drift; URLs are the verification surface for humans.
 */
const THEMES: Theme[] = [
  {
    id: "trade_agri_forestry",
    theme_zh: "农产品/软木贸易与救济程序",
    theme_en: "Agri/forestry trade & remedy processes",
    rx: /菜籽|油菜籽|canola|软木|softwood|木材出口/i,
    public_refs: [
      {
        title: "CUSMA full text (table of contents)",
        url: "https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/agr-acc/cusma-aceum/text-texte/toc-tdm.aspx?lang=eng",
        publisher: "Global Affairs Canada",
      },
      {
        title: "SIMA / trade remedies (CBSA)",
        url: "https://www.cbsa-asfc.gc.ca/sima-lmsi/menu-eng.html",
        publisher: "Canada Border Services Agency",
      },
    ],
  },
  {
    id: "critical_minerals",
    theme_zh: "关键矿产与供应链",
    theme_en: "Critical minerals & supply chains",
    rx: /关键矿产|稀土|锂矿|镍矿|critical\s+minerals/i,
    public_refs: [
      {
        title: "Canada’s Critical Minerals Strategy",
        url: "https://www.canada.ca/en/campaign/critical-minerals-in-canada/canada-critical-minerals-strategy.html",
        publisher: "Government of Canada / NRCan",
      },
      {
        title: "Investment Canada Act (consolidated)",
        url: "https://laws-lois.justice.gc.ca/eng/acts/I-21.8/",
        publisher: "Justice Laws Website",
      },
    ],
  },
  {
    id: "arctic",
    theme_zh: "北极与北方政策",
    theme_en: "Arctic & Northern policy",
    rx: /北极|Arctic|极地航道/i,
    public_refs: [
      {
        title: "Canada’s Arctic foreign policy",
        url: "https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/priorities-priorites/arctic-policy-politique-arctique.aspx?lang=eng",
        publisher: "Global Affairs Canada",
      },
    ],
  },
  {
    id: "investment_screening",
    theme_zh: "外资审查 / Investment Canada",
    theme_en: "Investment Canada Act screening (public)",
    rx: /投资审查|外资安全|并购|Investment\s+Canada/i,
    public_refs: [
      {
        title: "Investment Canada Act (consolidated)",
        url: "https://laws-lois.justice.gc.ca/eng/acts/I-21.8/",
        publisher: "Justice Laws Website",
      },
      {
        title: "Investment Review (ISED overview)",
        url: "https://ised-isde.canada.ca/site/investment-canada-act/en",
        publisher: "Innovation, Science and Economic Development Canada",
      },
    ],
    namedRx: /Investment\s+Canada\s+Act|加拿大投资法/i,
  },
  {
    id: "foreign_influence_transparency",
    theme_zh: "外国影响透明度（公开法）",
    theme_en: "Foreign influence transparency (public statute themes)",
    rx: /外国干涉|外国影响|代理人|foreign\s+influence|foreign\s+interference/i,
    public_refs: [
      {
        title: "Protecting democracy (public overview)",
        url: "https://www.canada.ca/en/democratic-institutions/services/protecting-democracy.html",
        publisher: "Democratic Institutions / Canada.ca",
      },
      {
        title: "Justice Laws Website (search / consolidated acts)",
        url: "https://laws-lois.justice.gc.ca/eng/",
        publisher: "Justice Laws Website",
      },
    ],
    namedRx: /Foreign\s+Influence\s+Transparency|外国影响透明/i,
  },
  {
    id: "sanctions_sema",
    theme_zh: "制裁 / SEMA 公开清单主题",
    theme_en: "Sanctions / SEMA public listing themes",
    rx: /制裁|制裁清单|SEMA|special\s+economic\s+measures/i,
    public_refs: [
      {
        title: "Special Economic Measures Act (consolidated)",
        url: "https://laws-lois.justice.gc.ca/eng/acts/S-14.5/",
        publisher: "Justice Laws Website",
      },
      {
        title: "Canadian sanctions (GAC)",
        url: "https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/index.aspx?lang=eng",
        publisher: "Global Affairs Canada",
      },
    ],
    namedRx: /SEMA|Special\s+Economic\s+Measures/i,
  },
  {
    id: "ev_tariffs_trade",
    theme_zh: "电动车/关税与产业政策",
    theme_en: "EV / tariff & industrial policy",
    rx: /电动车|新能源车|关税|反补贴|反倾销/,
    public_refs: [
      {
        title: "Department of Finance Canada",
        url: "https://www.canada.ca/en/department-finance.html",
        publisher: "Finance Canada",
      },
      {
        title: "SIMA / trade remedies (CBSA)",
        url: "https://www.cbsa-asfc.gc.ca/sima-lmsi/menu-eng.html",
        publisher: "Canada Border Services Agency",
      },
    ],
  },
  {
    id: "bilateral_china",
    theme_zh: "对华双边关系公开表述",
    theme_en: "Canada–China bilateral public framing",
    rx: /中加|加中|加方|加拿大/,
    public_refs: [
      {
        title: "Canada–China relations (country page)",
        url: "https://www.international.gc.ca/country-pays/china-chine/index.aspx?lang=eng",
        publisher: "Global Affairs Canada",
      },
      {
        title: "Justice Laws Website",
        url: "https://laws-lois.justice.gc.ca/eng/",
        publisher: "Justice Laws Website",
      },
    ],
  },
];

function evidenceAround(text: string, rx: RegExp): string {
  const m = text.match(rx);
  if (!m || m.index == null) return m?.[0] || "";
  const start = Math.max(0, m.index - 10);
  const end = Math.min(text.length, m.index + m[0].length + 10);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function buildCanadaPolicyLink(sourceText: string): CanadaPolicyLink {
  const text = sourceText || "";
  const hits: CanadaPolicyHit[] = [];

  for (const th of THEMES) {
    if (!th.rx.test(text)) continue;
    const named = th.namedRx ? th.namedRx.test(text) : false;
    hits.push({
      theme_id: th.id,
      theme_zh: th.theme_zh,
      theme_en: th.theme_en,
      public_refs: th.public_refs,
      evidence: evidenceAround(text, th.rx),
      level: named ? "named_instrument" : "topical",
    });
  }

  const level: CanadaPolicyLinkLevel = hits.some((h) => h.level === "named_instrument")
    ? "named_instrument"
    : hits.length
      ? "topical"
      : "none";

  const label_zh =
    level === "named_instrument"
      ? "Canada public law/policy: named-instrument cue"
      : level === "topical"
        ? "Canada public policy: topical adjacency"
        : "No Canada public-policy overlay cue";

  return {
    framing: "civilian-canada-public-policy-overlay",
    level,
    label_zh,
    hits: hits.slice(0, 6),
    disclaimer_zh:
      "Reader-interest overlay of open Canadian policy themes — not legal advice and not an investigation of any person. Links point to government public pages; verify current consolidated text.",
    rationale:
      level === "none"
        ? "No topical cue matched the Canada public-policy overlay lexicon."
        : `Matched ${hits.length} public-policy theme(s) with open URLs. Hypothesis only — verify current consolidated law/guidance before citing.`,
    tag: "hypothesis",
  };
}

/** Catalog export for portfolio / docs (no paste required). */
export function listCanadaPolicyCatalog(): {
  id: string;
  theme_zh: string;
  theme_en: string;
  public_refs: PublicRef[];
}[] {
  return THEMES.map((t) => ({
    id: t.id,
    theme_zh: t.theme_zh,
    theme_en: t.theme_en,
    public_refs: t.public_refs,
  }));
}
