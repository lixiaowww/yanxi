# Yanxi

> Public Mandarin → English research briefing drafts for human review

**Not an intelligence product, not a surveillance tool, not personal targeting of Canadians**

## Method pillars

1. Unwritten rules = open-reporting heuristics: enumerate then weight (signaling scorecard)
2. Multi-source corroboration = score 0–3; missing-source list; in-column pair merge tests

- Factorized confidence (substance × corroboration × provenance × source class); social commentary hard-capped at low
- Strip formula language → keep numbers / deadlines / instruments / responsible bodies
- Canada nexus + public policy/law URL overlay (not legal advice)
- Civic Ontology Lite: desk-first context cards ≤8; not OWL / intel ontology

## Desk columns

### Hot topics

Aggregated public hot themes: Taiwan Strait, EVs, China AI, semiconductors, critical minerals — still adoption-gated on hard detail · items 4 · max corr 2/3

- `hot-china-ai` · implementing_instrument/P3 · corr=2 · conf=medium
  - The Mandarin source discusses: 科技部有关负责人就人工智能发展答记者问…
- `hot-electric-vehicles` · implementing_instrument/P3 · corr=2 · conf=medium
  - The Mandarin source discusses: 工业和信息化部有关负责人称，要巩固新能源汽车产业优势…

### Economy & investment

Fiscal/monetary, industrial investment, special funds, local debt/property, meeting→instrument detail (excl. hot-theme AI/EV/chips which route to Hot topics) · items 4 · max corr 3/3

- `dual-circulation` · dual_circulation/P3 · corr=0 · conf=low
  - Not adopted: paste lacks verifiable detail (numbers, deadlines, named instruments, or funding lines).…
- `finance-risk` · finance_risk/P3 · corr=0 · conf=low
  - Not adopted: paste lacks verifiable detail (numbers, deadlines, named instruments, or funding lines).…

### Foreign affairs

Diplomatic discourse, bilateral ties, Belt and Road, sanctions/cooperation in open text · items 2 · max corr 0/3

- `canada-nexus` · foreign_affairs/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 商务部有关负责人就中加经贸关系答记者问时表示，中方一贯主张通过对话协商解决贸易分歧…
- `foreign-affairs` · foreign_affairs/P3 · corr=0 · conf=low
  - Not adopted: paste lacks verifiable detail (numbers, deadlines, named instruments, or funding lines).…

### Defense — public discourse only

Open defense/military/industry reporting and white-paper style language; not operational intel or targeting · items 1 · max corr 0/3

- `defense-public` · defense_public/P3 · corr=0 · conf=low
  - Not adopted: paste lacks verifiable detail (numbers, deadlines, named instruments, or funding lines).…

### Social governance

Livelihood, grassroots governance, public opinion, common prosperity, party education — open social-governance language · items 3 · max corr 0/3

- `ideology-party` · ideology_party/P3 · corr=0 · conf=low
  - Not adopted: paste lacks verifiable detail (numbers, deadlines, named instruments, or funding lines).…
- `rural-food` · rural_revitalization/P3 · corr=0 · conf=low
  - Not adopted: paste lacks verifiable detail (numbers, deadlines, named instruments, or funding lines).…

## Regression

**PASS** · 8 cases / 11 stages · failed=0
- 会议单独 → 弱印证；会议+细则 → 印证上升
- 八股+干货 → substance 升档
- 社交转述 → confidence 硬封顶 low
- 五栏路由 + 加国 nexus/policy 稳定

## Civic Ontology Lite (context-card catalog)

Desk-first cards · background/hypothesis only · see `docs/ONTOLOGY-LITE.md`

- `bilateral-trade-friction-compare` · intl_compare/background · desk=foreign_affairs|economy_investment · Background intl_compare for public trade-friction vocabulary (PRC wording vs open multilateral/partner frames).
- `boilerplate-vs-substance` · method/hypothesis · desk=all · How to strip formulaic party-speak and keep verifiable substance cues (civilian).
- `china-canada-public-discourse` · intl_compare/background · desk=foreign_affairs|economy_investment · Background compare frame for public PRC wording on China–Canada ties (trade/diplomacy) — not targeting.
- `cultural-semantics` · lexicon/background · desk=all · Cultural and discourse semantics that affect tone and audience reading.
- `defense-public-discourse` · lexicon/background · desk=defense_public · Public defense/military discourse vocabulary — civilian reading only.
- `dual-circulation-lexicon` · lexicon/background · desk=economy_investment · Background gloss for dual circulation / supply-chain security public vocabulary.
- `finance-risk-lexicon` · lexicon/background · desk=economy_investment · Background gloss for public finance / property / systemic-risk vocabulary.
- `five-year-plan-lexicon` · institution/background · desk=economy_investment · Background gloss for five-year plan / long-horizon planning vocabulary.
- `foreign-policy-discourse` · lexicon/background · desk=foreign_affairs · Background on public PRC foreign-policy discourse terms — not classified analysis.
- `historical-analogy-discipline` · history_frame/hypothesis · desk=all · How to use historical analogies without overclaiming.
- `ideology-education-lexicon` · lexicon/background · desk=social_governance · Background gloss for ideology / Party education / discipline vocabulary in public texts.
- `industrial-tech-policy` · lexicon/background · desk=hot_topics|economy_investment · Background glosses for industrial and tech-policy vocabulary in public PRC sources.
- `macro-policy-cycle` · institution/background · desk=economy_investment · Background on PRC macro policy-cycle vocabulary and cautious outlook discipline.
- `party-state-lexicon` · lexicon/background · desk=all · Lexicon for common PRC political terms — background only.
- `policy-signaling-valves` · method/hypothesis · desk=all · Enumerated public PRC media heuristics with weights — civilian research calibrators (not secrets).
- `rural-revitalization-lexicon` · lexicon/background · desk=social_governance|economy_investment · Background gloss for rural revitalization and food-security public vocabulary.
- `social-governance-lexicon` · lexicon/background · desk=social_governance · Background glosses for social governance and livelihood policy vocabulary.

## Canada public-policy overlay (click to verify)

### Agri/forestry trade & remedy processes
- [CUSMA full text (table of contents)](https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/agr-acc/cusma-aceum/text-texte/toc-tdm.aspx?lang=eng) · Global Affairs Canada
- [SIMA / trade remedies (CBSA)](https://www.cbsa-asfc.gc.ca/sima-lmsi/menu-eng.html) · Canada Border Services Agency

### Critical minerals & supply chains
- [Canada’s Critical Minerals Strategy](https://www.canada.ca/en/campaign/critical-minerals-in-canada/canada-critical-minerals-strategy.html) · Government of Canada / NRCan
- [Investment Canada Act (consolidated)](https://laws-lois.justice.gc.ca/eng/acts/I-21.8/) · Justice Laws Website

### Arctic & Northern policy
- [Canada’s Arctic foreign policy](https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/priorities-priorites/arctic-policy-politique-arctique.aspx?lang=eng) · Global Affairs Canada

### Investment Canada Act screening (public)
- [Investment Canada Act (consolidated)](https://laws-lois.justice.gc.ca/eng/acts/I-21.8/) · Justice Laws Website
- [Investment Review (ISED overview)](https://ised-isde.canada.ca/site/investment-canada-act/en) · Innovation, Science and Economic Development Canada

### Foreign influence transparency (public statute themes)
- [Protecting democracy (public overview)](https://www.canada.ca/en/democratic-institutions/services/protecting-democracy.html) · Democratic Institutions / Canada.ca
- [Justice Laws Website (search / consolidated acts)](https://laws-lois.justice.gc.ca/eng/) · Justice Laws Website

### Sanctions / SEMA public listing themes
- [Special Economic Measures Act (consolidated)](https://laws-lois.justice.gc.ca/eng/acts/S-14.5/) · Justice Laws Website
- [Canadian sanctions (GAC)](https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/index.aspx?lang=eng) · Global Affairs Canada

---

Draft for human review · Portfolio narrative only · Not an intelligence product
