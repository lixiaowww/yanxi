# 研析 Yanxi v2 — 架构/产品重设计方案（推演，非承诺路线图）

| 字段 | 内容 |
|------|------|
| 状态 | **Discussion draft** — 复盘产物，不是已排期的 roadmap；不改变 v0.3 的实际交付 |
| 对应 | [PRD.md](./PRD.md) v0.3 · [DP.md](./DP.md) v0.3（本文只提出"如果重来"会不一样的四点，其余全部沿用） |
| 前提 | 本文所有结论都反推自这一轮复盘实际踩到的坑（chip 爆炸、`findRelatedBriefs` 排序 bug、offline 样例质量参差、Raw JSON 让人看不懂），不是抽象假设 |

---

## 0. 结论先行

v0.3 的**分析逻辑没有问题**——claim gate、defer 纪律、离线/LLM 双引擎这些核心判断一直是对的。有问题的是**分析结果怎么分层暴露**：18+ 层注解全部挤在一个 JSON 里、一个页面里、一个数据目录里，靠事后加 `<details>` 折叠和打分公式打补丁来管理复杂度。v2 要解决的不是"分析对不对"，是"分层设计从第一天就该怎么做"。

四个改动点，外加明确"不改什么"。

---

## 1. API 契约拆成 Reader / Audit 两层

**现状**：`POST /api/brief` 返回一个 `BriefResponse`，把 `briefing_en`（读者要看的）和 `substance_cut`/`signaling_scorecard`/`confidence_factors`/`corroboration`/`intake`/`temporal`/`ontology_lite`/`human_review`（分析师/调试要看的）全部塞进同一个对象。前端只能靠 UI 折叠（这轮加的 `<details>「Analysis details」`）来装作分层——本质上数据还是一份，装不干净，所以才会出现"点了个 Raw JSON 按钮，看到一坨不知道是什么的东西"这种体验。

**v2**：pipeline 内部计算不变（分析的丰富度是产品的核心价值，不能削），只在序列化边界拆两个视图：

```
POST /api/brief              → ReaderBrief（小、稳定 schema）
POST /api/brief?view=audit   → AuditBrief（现在的全量 BriefingJson，供调试/技术评审用）
```

```ts
type ReaderBrief = {
  verdict: { status: "adopted" | "deferred" | "not_adopted"; summary_en: string };
  digest: DigestRow[];
  what: string; context: string; key_facts: Nugget[]; so_what: string;
  outlook: { scenarios: Scenario[]; watchpoints: string[] };
  open_questions: string[];
  meta: { mode: "llm" | "offline"; brief_quality: string; freshness_label: string;
          confidence: string; desk: string; canada_nexus?: string };
};
```

`AuditBrief` = 现在完整的 `BriefingJson`，不变、不删——只是默认不随 `ReaderBrief` 一起下发。UI 的"Analysis details"折叠区改成按需请求 `?view=audit`，而不是一次性把全量数据发给浏览器再靠 CSS/JS 藏起来。

**为什么值得做**：这不是纯前端整理，是把"读者优先"这个产品原则真正下沉到 API 层——任何未来消费这个 API 的客户端（CLI、另一个 UI、招聘官自己写的脚本）都自动得到干净的默认视图，不用重新发明一次"该显示哪几个字段"。

**2026-09-22 修订——Reader 默认视图进一步收紧，并接入成熟方法论**：用户复盘 Reader 页实际使用效果后指出两条：(1) 默认视图仍然暴露 What/Context/So what/Outlook 这类管线阶段标签，即使折叠了 AuditBrief 也不够——读者不该看到"这是哪个处理阶段产出的"，只该看到分析本身；(2) Analysis 区块只是原文摘录+提取的 nugget 罗列，不是真正的分析。落地为 `src/components/ReaderBrief.tsx`（新组件，仅供 Reader 用，`BriefingNote.tsx` 不动，`/compose` 继续用完整交互版）：

- 默认视图收窄到两块，都不带管线词汇标签：**Analysis**（`context`+`so_what` 按句拆成条目式"关键判断"列表，去掉 nugget 罗列）+ **Forecast**（`policy_outlook.scenarios`，`basis`/`trigger`/`alternative`/`falsifier` 合并成自然语言句子，不再是打了标签的字段）。
- 用户明确要求格式是"bullet：分析1,2,3（置信度） 预测1,2,3（置信度）"——即每条判断都跟着置信度，与既有的每条情景带 likelihood 标签的格式一致。
- 该格式不是临时拍的，是接入了 **ICD 203《Analytic Standards》**（美国 ODNI 情报共同体分析标准，2015-01-02 生效）：
  - 规则 e(2) 要求区分"事件发生的可能性（likelihood）"与"分析员对判断依据的信心（confidence）"——两者本项目里已经是独立字段（`policy_outlook.scenarios[].likelihood` vs. `analysis_confidence`/`source_credibility`），这次只是确认既有拆分方向是对的。
  - 规则 e(2)(a) 给出标准可能性用词表（"almost no chance / very unlikely / unlikely / roughly even chance / likely / very likely / almost certain(ly)"，或对应的 "remote/highly improbable/.../nearly certain" 一行，不可混用两行）——本项目只有三档（high/medium/low），改用该表"probable"一行里的对应词：`likely` / `roughly even odds` / `unlikely`（`src/lib/score-bands.ts` `likelihoodWord()`），不再用之前自造的"more likely/plausible/less likely"。
  - 规则 e(2)(b)："产品用置信度等级（如 high confidence）表达信心时，同一句话里不得再混入可能性用词"——因此 Forecast 的 likelihood 标签与 Analysis 的 confidence 标签保持视觉/语法分离，从不合并成一句。
  - 规则 e(6)"多条判断应有清晰论证"支持了"Analysis 拆成独立条目而非一段密文"的格式选择。
  - 出处：`docs/ETHICS.md` 红线不变——引用的是**美国政府公开发布的分析写作标准**（民用文本写作方法论），不涉及情报采集/密级操作规程，符合"不做 SIGINT/密级分类框架"的边界。
- `skills/briefing-writer/SKILL.md` 已同步补充这条可能性用词规则的引用来源。

**2026-09-23 修订——"细节"定义扩大，采纳门禁不再只认政策工具**：实测线上 RSS 自动采集（`public-live-collect` 订阅）发现 `intake_reject_thin` 拒绝率极高（15 条里仅 1 条采纳）。用户复盘后给出明确纠正：

1. **产品方向纠正**：自动搜集+分析+预测是主线，人工审核是最后一道关卡，不是退回人工粘贴为主（此前一版分析误判为应缩小自动化范围，已撤回）。
2. **"细节"的精确定义**："官方公布的任免等客观信息，不需要证伪，主观性的评论，我们不需要采纳，所以不需要证伪。重点在于分析和预测。"——即：细节不限于政策工具类词汇（文件/资金/期限/量化目标），任何具名主体+具体可核查动作/数字/日期（人事任免、纪检通报、外交会见、发射/颁奖、具名宣教活动）都算细节；唯一真正该拒的是"党八股"式无具名主体的泛泛号召语言。用户原话确认三个样本判断正确后签字："这个定义正确"。
3. **落地**（`src/lib/substance.ts` + `src/lib/adoption.ts`）：新增 `official_action`（人事/纪检/外交/发射/颁奖等具体官方动作）与 `named_campaign`（具名宣教/宣传活动，如"网络安全周"）两类 `SubstanceKind`，计入 `HARD_SUBSTANCE_KINDS`，`isActionableCore` 对二者的匹配无条件视为可采纳（动词表本身已是精选清单，构造上即具体可核查）。`named_sector_or_place` 从硬编码地名列表改为通用行政区划正则（`省/自治区/市/自治州/地区/县/区`），不再遗漏"广西"这类未入列的省份。效果：`public-live-collect` 实测采纳率从 1/15 升到 8-9/15。
4. **优先级排序纠正**（`src/lib/info-triage.ts`）：用户指出"国家级以下（省市级别）人事任免意义不大；外交（包括华人，一带一路），经济（尤其是外贸和投资），国防（台海）可能更重要"——新增 `diaspora_or_bri_priority`/`trade_investment_priority`/`taiwan_strait_priority` 加权，以及 `subnational_personnel_low_priority` 降权。过程中顺带修了一个真实分类 bug：`leadership_meeting` 的正则里裸 `政协`/`人大` 会命中任何地方官员的头衔（如"...政协副主席..."），误判成中央级会议拿到 P2 高优先级；改为要求 `全国政协`/`全国人大` 才算数。
5. **标题生成器同步扩展**（`src/lib/facts.ts` `composeHeadlineEn`）：新增 `ACTION_GLOSS` 词表 + `officialAction` 分支，让离线兜底路径也认识新细节类型，避免像此前那样把"2026年...食品安全宣传周"里的基准年误判成 deadline（"Deadline Set in 2026"）或退化成通用占位符标题。
6. **Reader/`/compose` 呈现层**（`server.ts` `/api/outbox`）：新增默认过滤 `adopted === false` 的记录（与既有 `fixture_demo` 过滤同一模式），`?includeNotAdopted=true` 可选查看被拒内容用于调试/调优信源。用户明确要求："简报不应该是 rss 的罗列，而是有个过滤机制，符合我们这种分析预测能力和范围的才列出来"。
7. 全程 `npm test`（21/21）与 `tsc --noEmit` 保持干净，未破坏既有 fixture 校准。

---

## 2. Outbox 记录标 provenance，把测试数据和真实数据分开

**现状**：`outbox/briefs/` 一个目录，`domain-macro-cewc` 这种正经 fixture、`job-fit-domain-battery`（14 域强行拼一起的测试产物）、你真实粘贴生成的记录全部混在一起，靠 `findRelatedBriefs` 的打分公式去猜"哪个更像真的相关"。今天修的排序 bug（合并大杂烩测试产物排第一）根因就在这——不是打分公式不够聪明，是数据层从一开始没有"这条是不是测试数据"这个字段。

**v2**：`OutboxRecord` 加一个 `provenance: "live_paste" | "fixture_demo" | "showcase"`，写入时由调用方决定（`writePasteBrief` → `live_paste`；跑 fixture 批量测试的脚本 → `fixture_demo`；`build-showcase.ts` → `showcase`）。`findRelatedBriefs` 默认只在 `live_paste` + `showcase` 里找候选，`fixture_demo` 默认排除（除非显式传 `includeSynthetic: true` 给内部测试用）。

**为什么值得做**：今天的修法（按候选自身 topic 指纹稀释度打折）是对的、该保留，但那是"堵住已经发生的具体案例"；provenance 字段是"从源头不让这类数据有资格参与排名"，两者不冲突，v2 建议两个都要——数据层的干净胜过打分公式的精巧。

---

## 3. 显式复杂度预算：新增分析层要么合并旧层，要么写理由

**现状**：F1→F19，每个新功能默认新开一个顶层字段（`substance_cut` → `adoption` → `intake` → `temporal` → `corroboration` → `confidence_factors` → `canada_nexus` → `canada_policy_link` → `ontology_lite` → `desk_section` → `human_review`……），从未合并或下线过旧层。这是顶部 chip 数量失控、结果页信息过载的直接原因，我这轮是靠"折叠+一行结论"治标，没治本。

**v2**：维护一份 `docs/LAYER-REGISTRY.md`，列出 `BriefingJson` 每个顶层字段：负责回答什么问题、面向谁（reader/audit）、谁在用它做排序或门禁判断。新增一层前必须先看能不能塞进已有层里回答；确实需要新开的，登记进这份文件并写一句"为什么不能合并"。轻量强制手段：一个 lint 脚本比对 `BriefingJson` 的 key 集合和 registry 文件，key 数对不上就 CI 失败——不需要很重，几十行脚本即可。

**为什么值得做**：这条本质是流程约束，不是代码，但没有它，1、2 两条做完之后系统还是会在 F20、F25 慢慢长回今天的样子。

---

## 4. Showcase 是一等公民，不是 F19 才想起来的补丁

**现状**：v0.3 的产品设计顺序是"先建通用 pipeline → 攒了 33 篇离线模式的 outbox 记录 → 复盘时才发现没一篇能直接给招聘官看"。`examples/showcase/` 是这轮才加的救火动作。

**v2**：产品设计反过来做——先定 3-5 篇"理想成品"该长什么样（每个核心 desk 一篇：经济投资、外交、国防公开、社会治理、热点各挑一个真实感强的场景），先写 fixture、先跑通 LLM 模式、先人工过一遍质量，再回头搭支撑它们的 pipeline。`npm run showcase` 从"事后补的脚本"升级成 CI 的一个常规步骤（每次语境卡库或 prompt 有实质变更就重跑一次，而不是手动记得跑）。Portfolio 页默认展示的就是这几篇 showcase，live paste playground 明确标"试玩，结果不保证"，不是主线叙事。

**为什么值得做**：这条直接对齐"这个项目是求职作品集"这个真实目标——作品集的第一要务是"最好的样子被看见"，不是"通用能力被验证"。v0.3 把顺序搞反了。

---

## 不改什么（明确边界，避免"v2"被理解成推倒重来）

| 保留 | 理由 |
|------|------|
| Context card = 纯 Markdown + 关键词子串匹配 | 刻意的简单性是优点；换 embedding/向量库是过度工程，服务的受众（作者自己）用不上这个复杂度 |
| 离线规则引擎 + 可选 LLM 双路径、主备供应商兜底 | F16/F19 已经打磨好，且这套"LLM 不可用也能跑"的纪律本身是叙事亮点 |
| Claim gate（quote 子串门禁、禁用词、四件套 soft 校验） | 项目对「诚实简报」最有说服力的部分，架构怎么改都不该碰 |
| Defer / 拒绝采纳的纪律 | 今天两次验证过是对的，不是 bug，是卖点 |
| 现有 16 个确定性回归测试 | 这套测试覆盖率本身就是"IT / 分析工具资产"叙事的证据，保留并随 v2 扩展，不重写 |
| 民用红线（不做 SIGINT / 密级分类 / 机关工作流仿制） | `docs/ETHICS.md` / `JOB-FIT.md` 已经定好，v2 不动 |

---

## 迁移路径：v2 不需要重写，是增量演进

| 改动 | 破坏性 | 涉及文件 | 量级估计 |
|------|--------|----------|----------|
| §1 Reader/Audit 拆分 | 无破坏性——新增 `?view=audit` 参数，默认响应先保持现状，客户端可选择性切换 | 新增 `src/lib/brief-view.ts`（纯投影函数，无新逻辑）；`server.ts` 加 query 分支 | 约 100-150 行新代码 + 2 处小改动 |
| §2 provenance 字段 | 无破坏性——新字段，旧记录留空按 `live_paste` 处理即可 | `src/lib/outbox.ts`（`OutboxRecord` 类型 + 3 处写入调用点）、`src/lib/related-briefs.ts`（过滤条件） | 约 30-40 行改动 |
| §3 复杂度预算 | 纯流程，不涉及代码破坏 | 新增 `docs/LAYER-REGISTRY.md`；可选 `scripts/check-layer-registry.ts` | 一份文档 + 可选 30-40 行 lint 脚本，零生产代码改动 |
| §4 Showcase 优先 | 不涉及代码破坏，是内容制作顺序调整 | 无新文件——`build-showcase.ts`/`build-portfolio.ts` 这轮已经就位 | 零代码，纯流程 |

四条加起来大约 **150-250 行改动，分布在 4-5 个文件**——相对于项目现有约 11,000 行 TypeScript，占比在 2% 以内，而且**全部是增量新增或局部改动，没有一处要求删除或重写现有逻辑**。`docs/DP.md` v0.3 的信息架构图基本不用改，只是在"UI 读者脊柱"和"Deterministic layers"之间明确切一刀 API 边界，并给 outbox 数据加一个标签字段。如果你决定要做，最值得先动的是 §2（今天 bug 的真正根治，改动最小）和 §1（体验问题的根治），§3/§4 是流程/内容层面，随时可以补，不构成阻塞。
