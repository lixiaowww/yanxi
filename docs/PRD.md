# 研析 Yanxi — 产品需求文档（PRD）

| 字段 | 内容 |
|------|------|
| 产品 | 研析 Yanxi |
| 版本 | 0.1（MVP） |
| 日期 | 2026-09-20 |
| 作者 | Sean Li |
| 状态 | Draft → Active MVP |

---

## 1. 背景与问题

分析师（及申请人自用的研究工作流）常需把**公开中文材料**快速整理成**英文书面简报**，并补上对中国**历史 / 文化 / 政治**用语的可读解释。现有通用聊天工具容易：

- 无出处编造；
- 把「语境猜测」写成「事实」；
- 缺少可编辑的领域知识层（政史文卡片）；
- 缺少可审计的质量门禁。

研析要解决的是：**可追溯、可训练（改 Markdown）、可演示**的民用研究简报流水线。

## 2. 产品定位

| 是 | 不是 |
|----|------|
| 公开源中文 → 英文 Briefing 的研究助手 | SIGINT / 监听 / 仿 CSE 系统 |
| 政史文 **Context Card** 知识层 | 机密情报产品 |
| Skills 组合（GrantWright 同构） | 端到端替代人类分析师 |
| 人在回路草稿 | 自动上报/自动决策系统 |

**目标用户（MVP）**

1. 作者本人（portfolio / 面试演示 / 研究习惯工具）  
2. 未来：需要双语公开源简报的研究型用户（非执法部署）

## 3. 目标与成功标准

### 3.1 业务目标

- 10 分钟内：粘贴一段公开中文 → 得到结构化英文简报 + 语境说明 + 待核实问题。  
- 领域差异化：中国政史文语境卡可被作者持续增补。  
- 申请叙事：证明「语言 + 研究分析 + 书面产品 + AI/IT 门禁」闭环（见 `NARRATIVE-CSE.md`）。

### 3.2 MVP 成功标准（可测）

| ID | 标准 |
|----|------|
| S1 | 无 API Key 时 offline 引擎可完整跑通（`npm run demo`） |
| S2 | 样例「中央经济工作会议」类文本命中 ≥1 张语境卡 |
| S3 | 中文 quote 必须是原文子串，否则 gate hard-fail |
| S4 | 输出含：source_digest_zh、context_notes、briefing_en、open_questions |
| S5 | README / ETHICS 明确民用边界 |

## 4. 用户故事

1. **作为**双语分析者，**我希望**粘贴公开中文稿并得到英文 What / Context / So what，**以便**快速形成可审阅草稿。  
2. **作为**中国语境熟悉者，**我希望**系统用我维护的政史文卡片解释术语，**以便**英文读者不误解口号/制度用语。  
3. **作为**负责任的作者，**我希望**无出处的断言被挡住或降级，**以便**演示分析纪律而非话术生成。

## 5. 范围

### 5.1 In scope（v0.1）

- 粘贴输入（单源为主）  
- Skills：`briefing-writer`、`ethics-sandbox`、关键词匹配 `context-cards`  
- Offline 规则引擎 + 可选 OpenAI-compatible LLM  
- Claim gate（伦理词、quote 子串、置信度、过度预测软警告）  
- 本地 Web UI + `POST /api/brief`

### 5.2 Out of scope（v0.1）

- 自动爬取登录墙 / 社媒大规模采集  
- 多用户账号、计费、生产多租户  
- Neo4j 全量迁入 Nexus_Crime  
- 语音/听力流式转写（可列 v0.2，借鉴 EchoLife）  
- 任何「情报机关工作流」UI 仿制

## 6. 功能需求

| ID | 需求 | 优先级 |
|----|------|--------|
| F1 | 用户粘贴 Mandarin 源文本 + source label | P0 |
| F2 | 运行时组合 skills → system prompt | P0 |
| F3 | 按关键词匹配 context cards | P0 |
| F4 | 产出 JSON 简报结构 | P0 |
| F5 | Claim gate 并返回 findings | P0 |
| F6 | Force offline 开关 | P0 |
| F7 | 样例文本一键填充 | P1 |
| F8 | 多源 URL 白名单抓取 | P2 |
| F9 | 作者自定义 context card 向导 | P2 |
| F10 | Intake 两刀：第一刀白名单+hard nuggets；第二刀 local_gray / 可选 Jev（仅 defer↔reject_thin；不写正文、不覆盖 gate） | P0 |
| F11 | 双源完整简报门禁：`brief_quality` complete 需 ≥2 独立公开摘录；单源强制 partial（见 [DP-brief-quality.md](./DP-brief-quality.md)） | P0 |
| F12 | 时效降权：无 `source_as_of` 不可 complete；Outlook likelihood 按 freshness 封顶 | P0 |
| F13 | 预测四件套：每个情景含 label / basis / trigger / alternative / falsifier（缺字段 soft） | P0 |

## 7. 非功能需求

- **可审计**：skills 与 cards 为 Markdown，git 可 diff  
- **隐私**：默认本地；LLM 仅在配置 Key 后发送用户粘贴内容  
- **安全叙事**：禁止产品文案使用间谍/机密能力声称  
- **性能**：offline 路径 < 2s（本地）

## 8. 指标（后期）

- Gate pass rate（人工抽检）  
- 「语境卡有帮助」主观分（作者自评）  
- 从粘贴到可分享草稿的中位时间

## 9. 依赖与约束

- 代码：Node / Express / Vite / React（`~/open-mandarin-briefing`）  
- 设计血缘：GrantWright `skills.ts` 模式  
- 可选借鉴：Nexus_Crime 的 provenance / 置信表达（不迁犯罪域）  
- 外置文档根：`/mnt/external_storage/File/yanxi/`

## 10. 开放问题

1. 是否将产品公开 GitHub（建议 public，强化民用定位）？  
2. 语境卡是否需要中英双语正式审定流程？  
3. 与 portfolio 站（sean-portfolio-plum）的挂载时间点？  
