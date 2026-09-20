# Yanxi ↔ Job Fit（内部）

> **来源链接（解析后）：**  
> https://careers.cse-cst.gc.ca/en/careers/foreign-language-intelligence-analyst-chinese-CA-207057-en/  
> （短链 `https://t.co/GYjQvvHz1w` → 同上）  
> **用途：** 约束产品范围，使公开仓/演示只证明**可迁移的民用能力**。  
> **红线：** 遵守 `docs/ETHICS.md` — Yanxi **不是**情报产品，不模仿机关工作流，不在公开材料讨论申请细节。

## 1. 岗位摘要（公开页可见信息）

| 字段 | 内容 |
|------|------|
| 标题 | Foreign Language Intelligence Analyst (Chinese) |
| 雇主 | Communications Security Establishment (CSE) — 公开招聘页 |
| 职级/薪资（公开） | UNI-07；约 $93,510–$110,009；截止 2027-03-31 |
| 地点 | Ottawa, ON；全职现场 |
| 公民身份 | Canadian citizens；NCR 优先可能 |
| 任用条件（公开） | Enhanced Top Secret (ETS) clearance — **Yanxi 不声称、不协助 clearance** |

**岗位摘要（公开表述，意译）：** 用高级普通话语言能力与对国际事务的兴趣，在研究/分析环境中拼合多源信息、补充世界背景、产出书面材料；与技术专家协作；活动须依法不针对加拿大人/在加人士。

## 2. Essential → Yanxi 映射（可写进 portfolio，勿写成「仿 CSE」）

| 公开 Essential / 能力 | Yanxi 如何证明（民用） | 本仓落地 |
|----------------------|------------------------|----------|
| 高级普通话阅读 | 粘贴公开中文 → `source_digest_zh` + **原文 quote 子串门禁** | `gate.ts` quote check；UI paste |
| 研究与分析信息/数据 | 结构化摘录、语境卡、`open_questions`、置信度 | `pipeline` + cards + offline/LLM |
| 书面产品（报告/briefing notes） | 英文 `briefing_en`（what / context / so_what） | `briefing-writer` + UI JSON |
| Technical: Analytical thinking | Claim gate、under-claim、soft overclaim 警告 | `gate.ts` |
| Technical: Target knowledge & world context | 作者维护的政史文 **context cards**（background/hypothesis） | `skills/context-cards/*` |
| Technical: Data analysis（广义） | 关键词命中卡、可审计 JSON 输出、可选离线路径 | `skills.ts` + demo |
| Behavioural: Interactive communication | 双语 digest + 英文简报草稿（人审） | UI + skills 文案 |
| Asset: Mandarin↔English 书面转换 | 中→英简报流水线 | 核心路径 |
| Asset: IT systems / 开发或安全研究经验 | 可运行全栈 demo、skills 运行时、可选 Cursor SDK harness | `server.ts`、`docs/HARNESS.md` |

## 3. Competencies 中 Yanxi **不**覆盖（勿 drift）

| 岗位侧 | 产品策略 |
|--------|----------|
| 真实 SIGINT / 机密采集 / 机关工具链 | **永不实现**；公开文案禁止 SIGINT/espionage/spy-tool 框架 |
| Policies and procedures（机关内部规章） | 不建模；仅保留民用伦理门禁 |
| Listening（听力）高级能力证明 | v0.1 不做音频；路线图可列公开/自有音频，非本轮 |
| ETS / 申请流程本身 | 仅 `NARRATIVE-CSE.md` 内部备忘；遵守「勿社交讨论申请」 |

## 4. 本轮功能取舍（以岗位为准）

**做（服务 job fit）：**

1. Cursor harness（`AGENTS.md`、`.cursor/rules`、project skill、`docs/HARNESS.md`）— 证明 IT/工程纪律与可协作 agent 工作流  
2. 产品更名 `yanxi`（package / health / UI）— 可引用的公开资产名  
3. 语境卡与简报方法强化 **world context + 书面分析纪律**（含审慎 `policy_outlook` 场景，一律 hypothesis）  
4. `@cursor/sdk` 可选 harness 脚本 — Asset「IT / 分析工具」叙事  
5. 公开 GitHub `lixiaowww/yanxi` + `npm run demo` 可复现

**缓做 / 不做：**

- URL 爬取、多租户、情报 UI 仿制、预测「必将发生」的确定性预报  
- 任何未授权采集或针对个人的能力

## 5. 对外一句话（民用）

> Yanxi is a **civilian** open-source assistant that turns **public** Mandarin text into English briefing notes with China context cards and source-gated claims — demonstrating advanced Mandarin reading, research/analysis discipline, and written briefing craft for human review.
