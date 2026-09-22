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

详细设计见 [DP-brief-quality.md](./DP-brief-quality.md)。读者交付物字段与流水线见 [DP.md](./DP.md)、[ARCHITECTURE.md](./ARCHITECTURE.md)。

## 7. 非功能需求

- **可审计**：skills 与 cards 为 Markdown，git 可 diff；gate 可选 JSONL 审计  
- **隐私**：默认本地；LLM 仅在配置 Key 后发送用户粘贴内容  
- **安全叙事**：禁止产品文案使用间谍/机密能力声称  
- **诚实标签**：`brief_quality` / confidence / corroboration **不是**事件概率  
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
