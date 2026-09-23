# 研析 Yanxi — 产品需求文档（PRD）

| 字段 | 内容 |
|------|------|
| 产品 | 研析 Yanxi |
| 版本 | 0.3 |
| 日期 | 2026-09-22 |
| 作者 | Sean Li |
| 状态 | Active |
| 伦理 | [ETHICS.md](./ETHICS.md) |
| 质量 DP | [DP-brief-quality.md](./DP-brief-quality.md)（F11–F13） |
| 总 DP | [DP.md](./DP.md) |
| v3 DP | [DP-V3.md](./DP-V3.md)（F20–F27：Reader 页 + 定时抓取管线雏形） |

---

## 1. 背景与问题

分析师（及申请人自用的研究工作流）常需把**公开中文材料**快速整理成**英文书面简报**，并补上对中国**历史 / 文化 / 政治**用语的可读解释。现有通用聊天工具容易：

- 无出处编造；
- 把「语境猜测」写成「事实」；
- 缺少可编辑的领域知识层（政史文卡片）；
- 缺少可审计的质量门禁；
- 单源短粘贴仍被当成「完整简报」，Outlook 看起来比证据厚。

研析要解决的是：**可追溯、可训练（改 Markdown）、可演示**的民用研究简报流水线——交付物是人审草稿，不是定案。

## 2. 产品定位

| 是 | 不是 |
|----|------|
| 公开源中文 → 英文 Briefing 的研究助手 | SIGINT / 监听 / 仿 CSE 系统 |
| 政史文 **Context Card**（Civic Ontology Lite） | 机密情报产品 / OWL 知识图谱 |
| Skills 组合（GrantWright 同构） | 端到端替代人类分析师 |
| 人在回路草稿（complete / partial / rejected） | 自动上报 / 自动决策系统 |
| 情景包 Outlook（四件套 + 时效降权） | 「必将发生」式预测 |

**目标用户**

1. 作者本人（portfolio / 面试演示 / 研究习惯工具）  
2. 需要双语公开源简报的研究型用户（非执法部署）

## 3. 目标与成功标准

### 3.1 业务目标

- 粘贴公开中文（可双源）→ 得到可读英文研究简报脊柱 + 语境说明 + 待核实问题。  
- 领域差异化：中国政史文语境卡可被作者持续增补。  
- 诚实厚度：完整简报有准入条件；薄源标 partial，不灌模板。  
- 申请叙事：证明「语言 + 研究分析 + 书面产品 + AI/IT 门禁」闭环（见 `NARRATIVE-CSE.md`）。

### 3.2 成功标准（可测）

| ID | 标准 |
|----|------|
| S1 | 无 API Key 时 offline 引擎可完整跑通（`npm run demo`） |
| S2 | 样例「中央经济工作会议」类文本命中 ≥1 张语境卡 |
| S3 | 中文 quote 必须是原文子串，否则 gate hard-fail |
| S4 | 采纳稿含读者脊柱：Digest → What → Context → Key facts → So what → Outlook → Watchpoints → Open questions |
| S5 | README / ETHICS 明确民用边界 |
| S6 | 单源采纳稿 `brief_quality=partial`；双源+日期可 `complete`（`npm run test:brief-quality`） |
| S7 | 无 `source_as_of` 时 Outlook likelihood 封顶为 low |
| S8 | 每个 Outlook 情景含 alternative + falsifier（offline 必填；LLM 缺字段 soft） |
| S9 | Intake 金标与回归：`npm run test:intake` · `npm test` |

## 4. 用户故事

1. **作为**双语分析者，**我希望**粘贴公开中文稿并得到英文 What / Context / So what / Outlook，**以便**快速形成可审阅草稿。  
2. **作为**中国语境熟悉者，**我希望**系统用我维护的政史文卡片解释术语，**以便**英文读者不误解口号/制度用语。  
3. **作为**负责任的作者，**我希望**无出处的断言被挡住或降级，**以便**演示分析纪律而非话术生成。  
4. **作为**读者，**我希望**单源或无日期的稿被标成 Partial，**以便**不会把草稿当成可外传定论。  
5. **作为**操作者，**我希望**能贴第二公开摘录或载入 related brief，**以便**把 partial 提升为 complete。

## 5. 范围

### 5.1 In scope（v0.3）

- 粘贴输入：单源 + **双源 `sources[]`**；可选 `sourcePublishedAt` / `collectedAt`  
- Skills：`briefing-writer`、`ethics-sandbox`、关键词匹配 `context-cards`  
- Offline 规则引擎 + 可选 OpenAI-compatible LLM（公开站可开；IP 限流）  
- Deterministic layers：substance / adoption / intake / temporal / analysis / corroboration / confidence / brief_quality  
- Claim gate（伦理词、quote 子串、密级禁词、过度预测 soft、四件套 soft）  
- 读者脊柱 UI + 保存 outbox markdown；Portfolio 页  
- 白名单 collect / RSS（见 `COLLECT.md`）  
- Cursor harness（rules / skills / optional SDK）

### 5.2 Out of scope

- 自动爬取登录墙 / 社媒大规模采集 / 针对个人  
- 多用户账号、计费、生产多租户  
- Neo4j / 侦办 UI / 情报机关工作流仿制  
- 臆造第二源或无关多域大合并冒充 complete  
- 听力 / PDF / SMTP（Later）

## 6. 功能需求

| ID | 需求 | 优先级 | 状态 |
|----|------|--------|------|
| F1 | 用户粘贴 Mandarin 源文本 + source label | P0 | 已交付 |
| F2 | 运行时组合 skills → system prompt | P0 | 已交付 |
| F3 | 按关键词匹配 context cards（Ontology Lite） | P0 | 已交付 |
| F4 | 产出 JSON 简报结构 + 读者脊柱 | P0 | 已交付 |
| F5 | Claim gate 并返回 findings | P0 | 已交付 |
| F6 | Force offline 开关（API/采集脚本用于确定性；2026-09-21 起从 UI 移除，无实际使用价值） | P0 | 已交付 |
| F7 | 样例文本一键填充 | P1 | 已交付 |
| F8 | 多源 URL 白名单抓取 + 订阅 RSS | P1 | 已交付 |
| F9 | 作者自定义 context card 向导 | P2 | 未做 |
| F10 | Intake 两刀：第一刀 hard nuggets；第二刀 local_gray / 可选 Jev（仅 defer↔reject_thin；不写正文、不覆盖 gate） | P0 | 已交付 |
| F11 | 双源完整简报门禁：`brief_quality` complete 需 ≥2 独立公开摘录；单源强制 partial | P0 | 已交付 |
| F12 | 时效降权：无 `source_as_of` 不可 complete；Outlook likelihood 按 freshness 封顶 | P0 | 已交付 |
| F13 | 预测四件套：label / basis / trigger / alternative / falsifier（缺字段 soft） | P0 | 已交付 |
| F14 | Human-in-the-loop 明确 intake：`human_review[]` 列出 source_class / intake 灰区 / 领域画像三处仍是猜测的点，非阻塞，操作者选完覆盖字段重跑即解决 | P1 | 已交付 |
| F15 | 加拿大关联度作为核心排序参数：importance 加权、outbox/related-briefs 排序均以 canada_nexus 为一等信号（非装饰徽章） | P1 | 已交付 |
| F16 | 第二 LLM 供应商兜底：主供应商（Groq）失败/限流时自动切换到可选的 `LLM_FALLBACK_*`，两者皆败才落回离线模板 | P0 | 已交付 |
| F19 | 运行事实：本地 `.env` 与 Render 生产环境均已配置双 LLM 供应商（主 Groq + 备 DeepSeek），offline 模板不再是常态默认路径，而是双供应商皆失败时的最终兜底 | P0 | 已交付（配置确认） |
| F17 | 情景四件套（alternative/falsifier）扩展到全部 10 个领域画像的手写场景，离线模式下也不再共享同一句兜底文案 | P0 | 已交付 |
| F18 | Outlook 时效降权拆分"相对时间词"（weak→medium）与"完全无日期"（unknown→low）；封顶前保留情景相对排序，避免全部情景显示同一个 likelihood | P1 | 已交付 |
| F20 | Reader 页：`/` 改为按 desk 分类浏览的读者产品（类别→列表→详情），默认隐藏分析细节，`⚙ Settings` 可选展开 `AnalystAppendix`；粘贴玩法移到 `/compose` | P1 | 已交付 |
| F21 | 信源分层白名单：`sources.whitelist.json` 加 `tier`/`channel_type`/`authority_weight`，供 F22 的 source_credibility 与 F24 的跨层级印证使用 | P1 | 已交付 |
| F22 | 双轨置信度：`confidence_factors` 拆分为 `source_credibility`（信源可信度）与 `analysis_confidence`（分析置信度），各自独立 low/medium/high，不再合并成一个混合分（breaking change，客户端类型/markdown 导出/Portfolio 同步更新） | P0 | 已交付 |
| F23 | 潜规则规则集加固：`signaling_scorecard` 新增笔名权威阶梯、外交措辞升级阶梯、弱化/强化措辞轴、"亲自"三件套等规则（17→23 条），每条新规则标注外部方法论出处（Hoover CLM / China Media Project / Asia Society 等） | P1 | 已交付 |
| F24 | 跨信源层级印证：`corroboration` 新增 `channel_tier_spread` 维度，区分"跨层级一致"（如部委官网+省级党报同报一事）与"同层级重复" | P1 | 已交付 |
| F25 | Jev 快筛层：定时抓取候选先经 `JevGate`（in_scope / language_quality / priority_hint / `has_concrete_detail`）粗筛，值得的才进入全套分析；`has_concrete_detail=false`（纯党八股/无可核实细节）在 Stage 2 即被筛掉，不进 outbox；fail-open——未配置或调用失败一律直接放行，从不阻塞、从不越权门禁 | P1 | 已交付 |
| F26 | 定时抓取管线串联：白名单分层 → 抓取 → Jev 粗筛 → 既有全套分析管线（`runSubscriptionCollect`/`collector.ts`），真实 `npm run collect` 验证过端到端行为不受影响 | P1 | 已交付 |
| F27 | 缺席即信号：`absence_signal` 检测"长期沉默后简短通报"模式，基于历史 outbox 时间序列基线（`GAP_DAYS_THRESHOLD=14`，明确标注为未校准的手设编辑先验） | P2 | 已交付 |
| F28 | "细节"定义扩大：采纳门禁不再只认政策工具（文件/资金/期限/量化目标），新增 `official_action`（人事/纪检/外交/发射/颁奖）与 `named_campaign`（具名宣教活动）两类硬细节；`public-live-collect` 实测采纳率从 1/15 升到 8-9/15。同步修正优先级排序（外交侨务/一带一路 > 外贸投资 > 台海 加权；省市级人事任免降权；`政协`/`人大` 误判中央会议的分类 bug）与标题生成器（认识新细节类型）；`/api/outbox` 默认不再展示 not-adopted 记录 | P0 | 已交付 |
| F29 | Reader 置信度显示简化 + skill 深度追问清单：Analysis 区块不再显示置信度标签（预测保留，收窄到 high/moderate likelihood 两档，`/compose` 完整三档不变）；`skills/briefing-writer/SKILL.md` 新增"Domain-specific deep read"——用真实样本（经济数据/外交会见/外交表态/政策工具/国防）归纳出各类别的标准追问清单，避免简报沦为翻译流水账；`falsifier`/`open_questions` 新增要求：需要背景知识核实时必须给出具体搜索关键词建议（不联网，只告诉人类去搜什么） | P0 | 已交付 |
| F30 | Render 免费档磁盘不持久缓解：生产环境启动时检查 outbox 有无 `provenance=live` 记录，没有则后台自动触发一次采集（不阻塞启动），把"重启到有内容"的窗口从"等下次定时任务"缩短到"冷启动后约一分钟"；配合 `.github/workflows/collect-cron.yml` 的工作日定时采集使用，均不能让内容真正持久化（真正的修复是付费 Persistent Disk，未做） | P1 | 已交付 |

详细设计见 [DP-brief-quality.md](./DP-brief-quality.md)、[DP-V2.md](./DP-V2.md)（§1 2026-09-23 修订）。读者交付物字段与流水线见 [DP.md](./DP.md)、[ARCHITECTURE.md](./ARCHITECTURE.md)。

## 7. 非功能需求

- **可审计**：skills 与 cards 为 Markdown，git 可 diff；gate 可选 JSONL 审计  
- **隐私**：默认本地；LLM 仅在配置 Key 后发送用户粘贴内容  
- **安全叙事**：禁止产品文案使用间谍/机密能力声称  
- **诚实标签**：`brief_quality` / `source_credibility` / `analysis_confidence` / corroboration **不是**事件概率  
- **性能**：offline 路径 < 2s（本地）  
- **UI 语言**：界面与分析员标签英文；中文仅出现在粘贴原文与摘录

## 8. 指标（后期）

- Gate pass rate（人工抽检）  
- complete vs partial 比例（是否引导用户加第二源）  
- 「语境卡有帮助」主观分（作者自评）  
- 从粘贴到可分享草稿的中位时间

## 9. 依赖与约束

- 代码：Node / Express / Vite / React  
- 设计血缘：GrantWright `skills.ts` 模式；横切复用 `vendor/grantwright`（urlSafety / htmlToText）  
- 可选借鉴：Nexus_Crime 的 provenance / 置信表达（不迁犯罪域）  
- 文档根：`docs/`；范围受 `JOB-FIT.md` 民用映射约束  
- 验证：`npm test`（含 `test:brief-quality` / `test:temporal` / `test:intake` 等）
- **LLM 供应商（运行事实，F19）**：本地与 Render 均已配置 `LLM_API_KEY`（Groq，主）+ `LLM_FALLBACK_API_KEY`（DeepSeek，备），见 `docs/DP.md` §7。UI/文案不得暗示"默认离线"——离线模板是双供应商失败后的最终兜底，不是常态路径

## 10. 开放问题

1. ~~语境卡是否需要中英双语正式审定流程？~~ **已定**：不设第三方审定，作者自审（`reviewed_by`/`review_date` frontmatter，17 张卡已完成一轮）。见 `docs/ONTOLOGY-LITE.md` §审定。
2. Portfolio 对外页与本仓 `/portfolio` 的长期挂载关系？**已定**：`sean-portfolio-plum.vercel.app` 的 Projects 卡片外链到本仓 Render 部署的 `/portfolio`；不重复建站，本仓 `/portfolio` 是外部卡片指向的「详情页」。
3. ~~Later：听力 / PDF / SMTP 是否进入下一 DP？~~ **已定：不做**。作者母语普通话，听力不构成能力缺口；PDF/SMTP 无当前需求驱动。  
