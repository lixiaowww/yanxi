# 研析 Yanxi

> 公开中文材料 → 英文研究简报草稿（人在回路）
> Public Mandarin → English research briefing drafts for human review

**不是情报产品、不是监听工具、不针对加拿大人或在加人士**

## 方法两支柱

1. 潜规则 = 公开报道启发式：先枚举再加权（signaling scorecard）
2. 多源印证 = corroboration 0–3；缺源清单；栏内配对合并实测

- 因子化置信度（substance × 印证 × 出处 × 源类）；社交转述硬封顶 low
- 八股剥离 → 只留数字/时限/工具/责任主体等可核验干货
- 加拿大关联 + 公开政策/法规 URL 对照（非法律意见）
- Civic Ontology Lite：栏目优先背景卡 ≤8；非 OWL/情报本体

## 五栏摘要

### 总体目标 · Overall goals & direction

中央会议、五年规划、高质量发展等方向性公开表述 · 条目 2 · 最高印证 0/3

- `dual-circulation` · dual_circulation/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 相关文件提出，加快构建以国内大循环为主体、国内国际双循环相互促进的新发展格局，建设全国统一大市场，提升产业链供应链安全可控能力，推进国产替代，畅通国内大循环…
- `macro-cewc` · leadership_meeting/P1 · corr=0 · conf=low
  - The Mandarin source discusses: 据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展，因地制宜发展新质生产力，继续推进改革开放，在发展中保障和改善民生，维护社会和谐稳定…

### 经济投资 · Economy & investment

财政货币、产业投资、地方债/房地产、营商与专项资金等公开线索 · 条目 3 · 最高印证 3/3

- `finance-risk` · finance_risk/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 有关会议强调，要统筹发展和安全，稳妥化解地方债与隐性债务风险，持续做好保交楼工作，促进房地产市场平稳健康发展，坚决守住不发生系统性金融风险的底线，同时防止资本无序扩张…
- `industrial-tech` · industrial_tech_policy/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 工业和信息化部有关负责人指出，要加快关键核心技术攻关，提升芯片与半导体产业链供应链韧性和安全可控水平，支持专精特新企业发展，推动人工智能赋能制造业转型升级，避免在关键领域出现卡脖…

### 外交 · Foreign affairs

外交话语、双边关系、一带一路、制裁/合作等公开表述 · 条目 2 · 最高印证 0/3

- `canada-nexus` · foreign_affairs/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 商务部有关负责人就中加经贸关系答记者问时表示，中方一贯主张通过对话协商解决贸易分歧…
- `foreign-affairs` · foreign_affairs/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 外交部发言人表示，中方愿同各方一道推进高质量共建一带一路，践行人类命运共同体理念，加强国际发展合作…

### 国防（公开表述） · Defense — public discourse only

国防/军队/军工公开报道与白皮书式语言；非作战情报、非目标跟踪 · 条目 1 · 最高印证 0/3

- `defense-public` · defense_public/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 国防部例行记者会上，有关负责人表示，军队将持续推进强军目标，加强练兵备战与演训，提升战备水平，同时强调中国坚持防御性国防政策，愿在相互尊重基础上开展国际军事交流…

### 社会治理 · Social governance

民生、基层治理、舆情、共同富裕、党建教育等公开社会治理表述 · 条目 3 · 最高印证 0/3

- `ideology-party` · ideology_party/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 各地各部门深入开展主题教育，学习贯彻党的二十大精神，加强思想政治工作和党的建设，推进全面从严治党，配合巡视整改，持续净化政治生态，巩固意识形态阵地…
- `rural-food` · rural_revitalization/P3 · corr=0 · conf=low
  - The Mandarin source discusses: 农业农村部表示，全面推进乡村振兴，守牢耕地红线，夯实粮食安全根基，加快种业振兴，建设高标准农田，巩固拓展脱贫攻坚成果，健全防止返贫监测帮扶机制，做好三农重点工作…

## 回归绿勾

**PASS** · 8 cases / 11 stages · failed=0
- 会议单独 → 弱印证；会议+细则 → 印证上升
- 八股+干货 → substance 升档
- 社交转述 → confidence 硬封顶 low
- 五栏路由 + 加国 nexus/policy 稳定

## Civic Ontology Lite（背景卡目录）

栏目优先挂卡 · background/hypothesis only · 详见 `docs/ONTOLOGY-LITE.md`

- `bilateral-trade-friction-compare` · intl_compare/background · desk=foreign_affairs|economy_investment · Background intl_compare for public trade-friction vocabulary (PRC wording vs open multilateral/partner frames).
- `boilerplate-vs-substance` · method/hypothesis · desk=all · How to strip formulaic party-speak and keep verifiable substance cues (civilian).
- `china-canada-public-discourse` · intl_compare/background · desk=foreign_affairs|economy_investment · Background compare frame for public PRC wording on China–Canada ties (trade/diplomacy) — not targeting.
- `cultural-semantics` · lexicon/background · desk=all · Cultural and discourse semantics that affect tone and audience reading.
- `defense-public-discourse` · lexicon/background · desk=defense_public · Public defense/military discourse vocabulary — civilian reading only.
- `dual-circulation-lexicon` · lexicon/background · desk=overall_goals|economy_investment · Background gloss for dual circulation / supply-chain security public vocabulary.
- `finance-risk-lexicon` · lexicon/background · desk=economy_investment · Background gloss for public finance / property / systemic-risk vocabulary.
- `five-year-plan-lexicon` · institution/background · desk=overall_goals · Background gloss for five-year plan / long-horizon planning vocabulary.
- `foreign-policy-discourse` · lexicon/background · desk=foreign_affairs · Background on public PRC foreign-policy discourse terms — not classified analysis.
- `historical-analogy-discipline` · history_frame/hypothesis · desk=all · How to use historical analogies without overclaiming.
- `ideology-education-lexicon` · lexicon/background · desk=social_governance · Background gloss for ideology / Party education / discipline vocabulary in public texts.
- `industrial-tech-policy` · lexicon/background · desk=economy_investment · Background glosses for industrial and tech-policy vocabulary in public PRC sources.
- `macro-policy-cycle` · institution/background · desk=overall_goals|economy_investment · Background on PRC macro policy-cycle vocabulary and cautious outlook discipline.
- `party-state-lexicon` · lexicon/background · desk=all · Lexicon for common PRC political terms — background only.
- `policy-signaling-valves` · method/hypothesis · desk=all · Enumerated public PRC media heuristics with weights — civilian research calibrators (not secrets).
- `rural-revitalization-lexicon` · lexicon/background · desk=social_governance|economy_investment · Background gloss for rural revitalization and food-security public vocabulary.
- `social-governance-lexicon` · lexicon/background · desk=social_governance · Background glosses for social governance and livelihood policy vocabulary.

## 加国公开政策对照入口（可点击核验）

### 农产品/软木贸易与救济程序
- [CUSMA full text (table of contents)](https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/agr-acc/cusma-aceum/text-texte/toc-tdm.aspx?lang=eng) · Global Affairs Canada
- [SIMA / trade remedies (CBSA)](https://www.cbsa-asfc.gc.ca/sima-lmsi/menu-eng.html) · Canada Border Services Agency

### 关键矿产与供应链
- [Canada’s Critical Minerals Strategy](https://www.canada.ca/en/campaign/critical-minerals-in-canada/canada-critical-minerals-strategy.html) · Government of Canada / NRCan
- [Investment Canada Act (consolidated)](https://laws-lois.justice.gc.ca/eng/acts/I-21.8/) · Justice Laws Website

### 北极与北方政策
- [Canada’s Arctic foreign policy](https://www.international.gc.ca/world-monde/issues_development-enjeux_developpement/priorities-priorites/arctic-policy-politique-arctique.aspx?lang=eng) · Global Affairs Canada

### 外资审查 / Investment Canada
- [Investment Canada Act (consolidated)](https://laws-lois.justice.gc.ca/eng/acts/I-21.8/) · Justice Laws Website
- [Investment Review (ISED overview)](https://ised-isde.canada.ca/site/investment-canada-act/en) · Innovation, Science and Economic Development Canada

### 外国影响透明度（公开法）
- [Protecting democracy (public overview)](https://www.canada.ca/en/democratic-institutions/services/protecting-democracy.html) · Democratic Institutions / Canada.ca
- [Justice Laws Website (search / consolidated acts)](https://laws-lois.justice.gc.ca/eng/) · Justice Laws Website

### 制裁 / SEMA 公开清单主题
- [Special Economic Measures Act (consolidated)](https://laws-lois.justice.gc.ca/eng/acts/S-14.5/) · Justice Laws Website
- [Canadian sanctions (GAC)](https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/index.aspx?lang=eng) · Global Affairs Canada

---

Draft for human review · Portfolio narrative only · Not an intelligence product
