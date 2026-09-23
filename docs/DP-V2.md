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

**2026-09-23 续— Reader 置信度显示简化 + skill 深度追问清单**：同一天晚些时候，用户在实测上线后的简报时又给出两条纠正：

8. **置信度只放在预测上**："把置信度只限于预测，分析不需要了，预测置信度只需要两个：高可能；一般可能"——`ReaderBrief.tsx` 的 Analysis 区块不再显示逐条 / masthead 置信度标签（`source_credibility`保留，它是信源可靠性，不是分析置信度，两个概念不同）；Forecast 的 likelihood 用词从 ICD 203 三档（likely / roughly even odds / unlikely）收窄到两档："high likelihood" / "moderate likelihood"（`src/lib/score-bands.ts` 新增 `readerLikelihoodWord()`，仅 Reader 用；`/compose` 的 `BriefingNote.tsx` 继续用完整三档 `likelihoodWord()`，两者分工不变）。
9. **简报流水账问题 + skill 深度追问清单**：用户指出"很多简报都应该放在历史上去分析和预测，很多信息单独看是无法分析和预测的"，并用真实抓取的 5 个样本（西藏收入统计、李强会见吉尔吉斯斯坦总理、中国驻欧盟使团回应涉港澳报告、国务院办公厅新质生产力试点通知、国防部例行记者会通稿）亲自写分析和预测，由 Claude 归纳拓展进 `skills/briefing-writer/SKILL.md` 新增的"Domain-specific deep read"整节——经济数据（名义 vs 实际购买力、均值 vs 分布、真实驱动力）、外交会见/表态（回应格式即烈度、历史基线对比）、政策工具（本文件是否可执行、预测该指向后续配套文件）、国防（目标语言 vs 方法动作分开、"防御性"论述必须并列两种读法不能单一定论）。
10. **历史序列对比 vs 联网搜索，分开处理**：用户进一步指出"数字贸易博览会"那条分析实际上是自己联网搜索了历届举办地/主宾国才写出来的——暴露出两层不同能力：(a) 查本系统 outbox 内部历史（`findRelatedBriefs` 目前在 LLM 调用**之后**才跑，没喂给模型，属于真实存在但**尚未动手**的管线顺序问题，留作后续单独评估）；(b) 真实联网搜索历史背景（新增依赖、新增成本、需要独立设计，本次明确**不做**）。折中方案：SKILL.md 新增指令——当 Forecast 的 `falsifier` 或 `open_questions` 需要本系统查不到的背景事实（历史基线、既往表态、官方统计口径）时，必须给出**具体建议搜索的关键词**，而不是含糊的"需要核实"；不联网，只告诉人类审阅者该去搜什么。`src/lib/skills.ts` 的输出 schema 提示同步更新。
11. **Render 免费档磁盘不持久的缓解**（`server.ts`）：用户追问"如何让 outbox 保留内容（最好是最新的）"。真正的修复是升级到带 Persistent Disk 的付费档（未做，成本决策留给用户）；作为免费档下的折中，新增生产环境启动钩子——`app.listen()` 之前检查 outbox 里有没有 `provenance=live` 的记录，没有就后台触发一次 `public-live-collect` 采集（不阻塞启动/健康检查）。这不能让内容真正持久化（重启依然会清空），只是把"重启到下次有内容"的窗口从"等下一次 GitHub Actions 定时任务（最多一整天）"缩短到"冷启动后约一分钟内"，跟已有的 `.github/workflows/collect-cron.yml` 互补，不是替代。

全程 `npm test`（21/21）与 `tsc --noEmit` 保持干净。

**2026-09-23 再续——过滤纠正 + 免费持久化"方案B" + 联网搜索（F31–F33）+ 精品化方向（F34，规划中）**：

12. **"过滤掉"被我理解错了**：早前用户说"人事/纪检过滤掉"，出现在"要不要为这一类写 skill 深度框架"的问答语境里，我理解成"跳过给这类写框架"，没有真的去改过滤逻辑。用户后来在线上复测时发现省市级人事任免仍大量出现在 Reader 里，指出"我说过过滤掉"——这次按字面纠正：`server.ts` `/api/outbox` 新增默认排除 `info_triage.importance.drivers` 含 `subnational_personnel_low_priority` 的记录（`?includeSubnationalPersonnel=true` 可选查看），仍采纳、仍存数据，只是不进 Reader 默认视图。教训：同一句"过滤掉"在不同语境下可能指"排除出结果"或"跳过某项工作"，下次歧义大时应该当场问清楚，而不是选一个语境代入。
13. **免费持久化"方案B"**：见上文第 11 条的冷启动补采集之后，用户进一步问"render能存档吗？...用户打开系统自动读文档可否"，明确选择"方案B"（不花钱、复用已有 GitHub 集成，而非升级付费 Persistent Disk）。落地为 `src/lib/outbox-archive.ts`：每次真实采集后把当前 `live` 记录快照写入本仓库 `outbox/archive/public-live-collect.json`（GitHub Contents API，需 `GITHUB_ARCHIVE_TOKEN`，fail-open）；生产启动时先从**公开仓库无鉴权**拉取这份快照写回本地 `outbox/briefs/`，成功即可让 Reader 立即有内容，不必等一轮新采集（省 LLM 调用）。仍不是真正的"跨重启持久"，是比 F30 更快的缓解层。
14. **联网搜索——推翻了会话早前"先不做"的范围限定**：用户拿一条真实卫星发射简报去问通用 AI 搜索工具，对比出我们的输出信息量差距巨大，我最初的解释是"AI 搜索工具没守诚实纪律，不能类比"，用户直接反驳："我认为是设计的错误...本项目在缺乏上下文盲目分析是瞎忙"——这条纠正被采纳，撤回"AI 搜索犯规"的判断。落地 `src/lib/search-context.ts`：固定代码驱动（非模型自主调用搜索工具，因为便宜小模型的工具调用遵循度已知不稳定）；`buildSearchQuery` 实测过一版用 `FactSet.actor[0]` 做查询词的方案是错的（人事/外交/发射类内容常只抓到"国务院"这类泛泛机构名，返回维基百科式定义，毫无信息量），改为清洗电头/记者署名后用原文切片做查询词，实测同一条摘录从"0条有用结果"变成"5条直接命中"。用户进一步提出"应该多角度问，根据回答追问"，双方商定折中：不做完全自适应多轮（小模型可靠性+成本考量），改为**3个固定角度**并行（背景历史、批判对比"刨去宣传夸大的内容"、按 substance nugget 类型定制的第三角度），实测发射类第三角度真的搜到了同系列历史发射记录（3月13日"第20批"）。`skills/briefing-writer/SKILL.md` 新增"发射/科技成就"深度追问清单（直接引用这条对比暴露的"无来源数字断言"作为反面教材）+ 跨类别的"主动批判对比"指令。需要 `TAVILY_API_KEY`，未配置则整段跳过。已知遗留问题：LLM 有时会把搜索到的背景隐性吸收进 `so_what`，但不总按指令显式生成带 URL 的 `context_notes`——记录为已知的小模型指令遵循度问题，暂不继续调 prompt。
15. **凭证配置**：用户直接把 Tavily key 和 GitHub PAT 粘贴进对话——按项目一贯的密钥卫生原则，只写入被 gitignore 的本地 `.env` 做验证，不回显、不提交。Render 环境变量没有 MCP 工具可用，用户又给了一个 Render API key，改用 `curl` 直接调 `api.render.com` 的 REST API（`PUT /v1/services/:id/env-vars/:key`）逐个设置，设置前后都用 `GET` 核对没有误删其他已有变量；发现刚配完的 env var 没有自动触发新部署（Render 的行为：API 设置环境变量本身不算"新提交"），额外用 `POST /v1/services/:id/deploys` 手动触发过一次，随后又发现本地其实有 3 个 commit 一直忘了 `git push`（`git push` 之后 Render 的 `new_commit` 自动部署接管、自动取消了那次手动触发的旧部署）——教训：本地验证完真实功能后要记得马上 `git push`，不要因为在忙着测试凭证而漏掉这一步。
16. **精品化方向（F34，规划中，未实现）**：用户提出"本项目每天只需要1-3条简报分析即可，只要分析和预测能做到全面和深入"——即目标不是"当天采纳的都处理"，而是"当天最重要的 1-3 条给最深处理"。这需要在采集管线（`collector.ts`）里新增一道排序/筛选关卡：先对当天全部候选跑零成本的门禁+重要性打分（不调 LLM、不搜索），只有排名最高的 1-3 条才进入 F33 的全套 LLM+多角度搜索流程。未决设计问题：数量是硬上限还是重要性分数阈值；是否要按 desk 类别（外交/经济/国防...）各留至少一个名额，避免全部 1-3 条都来自同一类别。确认方向，留到下一轮单独设计实现。

全程 `npm test`（21/21）与 `tsc --noEmit` 保持干净。

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
