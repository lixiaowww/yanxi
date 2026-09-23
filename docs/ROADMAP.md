# 研析 Yanxi — 路线图

对照 [PRD.md](./PRD.md) v0.3 · 质量细则 [DP-brief-quality.md](./DP-brief-quality.md)。

## Phase A–B（完成）

- [x] MVP skills + offline + gate + UI  
- [x] Job-fit：记分卡、分诊、RSS 订阅、Cursor harness、公开仓  

## Phase C0–C（完成）

- [x] 复用 GrantWright：`vendor/grantwright`（urlSafety + htmlToText）  
- [x] UI 引用高亮回链原文 + 结构化简报  
- [x] gate JSONL 审计（`outbox/audit/gate.jsonl`）  
- [x] DP / ARCHITECTURE 刷新  

## Phase D（完成）

- [x] 再增 ≥5 张语境卡（五年规划/金融风险/意识形态教育/乡村振兴/双循环）  
- [x] 多源 merge（`sources[]` + digest `source_label`）  
- [x] collect `mergeMode: combined`（默认）  

## Phase E / testing pass（完成）

- [x] 岗位向多领域 fixtures + `npm run test:domains`  
- [x] 扩展 triage 种类；跨源 soft overlap；UI domain 选择器  
- [x] 分领域 so_what / outlook；测试报告含分析与预测；短摘录证据修复  
- [x] 简报桌面栏目（经济投资/外交/国防公开/社会治理；已删虚「总体目标」）+ `npm run test:desk`  
- [x] 因子化置信度 + 印证分 + 加国公开政策对照 + 社交转述降权  
- [x] 公开风格链条回归 `npm run test:regress`  
- [x] 栏目内印证报告；加国政策对照可点开 URL；Portfolio（`/portfolio`）  
- [x] Civic Ontology Lite + `intl_compare` 卡  
- [x] 策展源档位权重 A–D/U（`source_tier`）  
- [x] 免费部署：Render Blueprint（`render.yaml` + `docs/DEPLOY.md`）  
- [x] 简报价值：offline 原因可见 + 干货/缺什么优先 UI（`infoValue`）  
- [x] 无细节/无数据 → 整篇不采纳（`adoption`）  
- [x] UI 统一英文（中文仅原文粘贴与摘录）  
- [x] 热点频道 `hot_topics`  
- [x] 内容影响分析（`facts` + `analysis`）  
- [x] 公开站 LLM / collect 路径开放（IP 限流；无 brief/collect token）  
- [x] Intake 两刀（hard nuggets + local_gray / 可选 Jev）· `npm run test:intake`  
- [x] 时效时钟 `temporal` · `npm run test:temporal`  
- [x] 双源粘贴 + outbox `relatedBriefs` 软链接 · `npm run test:multi`  
- [x] 读者脊柱 + 粘贴简报保存 outbox  
- [x] **简报质量门禁 F11–F13**：`brief_quality` · Outlook 时效降权 · 情景四件套 · `npm run test:brief-quality`  
- [x] F13 alternative/falsifier 去模板化：可选 LLM 同批重写（ACH 对比），软失败回退规则引擎 · `npm run test:scenario-enrich`  
- [x] F14 Human-in-the-loop 明确 intake：source_class / intake 灰区 / 领域画像三点非阻塞覆盖 · `npm run test:human-review`  
- [x] F15 加拿大关联度升级为核心排序参数（importance 加权 + related-briefs/outbox 排序）；UI 移除无价值的 Force offline 开关 · `npm run test:canada-priority`  
- [x] F16 第二 LLM 供应商兜底（Groq 429 时自动切换）· `npm run test:llm-fallback-provider`  
- [x] F17 情景四件套扩展到全部 10 个领域画像，不再依赖 LLM 增强就能去模板化 · `npm run test:scenario-diversity`  
- [x] F18 Outlook 时效降权区分"相对时间词"与"完全无日期"，封顶前保留情景相对排序 · `npm run test:outlook-differentiation`  
- [x] F19 运行事实确认：本地 `.env` + Render 均配置双 LLM（Groq 主 + DeepSeek 备），offline 模板降级为最终兜底，非默认路径 — 见 `docs/DP.md` §7
- [x] F20 Reader 页（类别 → 列表 → 详情的阅读产品，`docs/DP-V3.md` 收尾）：`/` 改为 Reader（按 desk 分类浏览 outbox，默认隐藏分析细节，`⚙ Settings` 可选展开 `AnalystAppendix`），粘贴玩法移到 `/compose`；`/api/outbox?desk=` 新增按 importance/日期排序；新组件 `src/Reader.tsx`、`src/lib/reader-settings.ts`（per-viewer localStorage，不是共享状态）
- [x] F28 "细节"定义扩大 + 优先级排序纠正（`docs/DP-V2.md` §1 2026-09-23 修订）：采纳门禁新增 `official_action`/`named_campaign`，`public-live-collect` 采纳率 1/15→8-9/15；外交侨务/一带一路 > 外贸投资 > 台海 加权，省市级人事任免降权；修正"政协"误判央级会议 bug；标题生成器扩展；`/api/outbox` 默认隐藏 not-adopted
- [x] F29 Reader 置信度显示简化（Analysis 无标签，Forecast 收窄到 high/moderate likelihood 两档）+ `skills/briefing-writer/SKILL.md` 新增真实样本归纳的领域深度追问清单，避免流水账；`falsifier`/`open_questions` 要求给出具体搜索建议（不联网）
- [x] F30 Render 免费档磁盘不持久缓解：生产启动时检测 outbox 无 live 记录则后台自动补一次采集，配合既有 `.github/workflows/collect-cron.yml` 定时任务，缩短"重启到有内容"窗口（非真正持久化，真正修复需付费 Persistent Disk）
- [x] F31 省市级人事任免默认从 Reader 过滤（仍采纳、仍存数据，只是默认不展示）
- [x] F32 Outbox 免费持久化"方案B"：真实采集后快照到 GitHub，生产启动时优先从归档快照恢复，比重新采集更快更省
- [x] F33 联网搜索上下文：LLM 调用前跑 3 个固定角度（背景/批判对比/类型定制）搜索，结果作为可溯源的 `background` 上下文注入 prompt；SKILL.md 新增"发射/科技成就"清单 + "剥离宣传夸大"跨类别指令
- [ ] F34（规划中）精品化——每天只深度处理 1-3 条最重要的简报，而非把深挖预算摊到当天所有采纳条目；需要在采集管线加一道零成本排序/筛选关卡，先打分再决定谁进入 F33 的全套流程

## Next（产品）

| 项 | 优先级 | 说明 |
|----|--------|------|
| P0 · Showcase 样例 | P0（已交付） | `npm run showcase` 生成 `examples/showcase/{complete-macro-instrument,deferred-finance-risk}.{md,json}`（真实 LLM 调用，complete 用例 `llmProvider=fallback`/DeepSeek）；Portfolio 页新增 "Showcase" 板块直接展示两篇固化产出 + 完整简报链接，`build-portfolio.ts` 只读文件、不重新调用 LLM |
| P1 · 结果页拆分 | P1（已交付） | 结果页顶部新增一行 plain-English `verdict-line`（Adopted/Deferred/Not adopted + brief quality + freshness + confidence）始终可见；原有 chip 行 + gate/mode/temporal 细节折进 `<details>`「Analysis details」，默认收起 |
| P1 · 首页引导样例 | P1（已交付） | 粘贴框上方新增两个按钮：「Try a complete example」（macro-cewc + macro-instrument 双源+日期 → complete）与「Try a deferred example」（本轮对话验证过的 finance-risk 单源无日期 → defer），各配一句结果预告 |
| P2 · 冻结新门禁层 | P2 | F19 之后不再新增 pipeline 诚实机制层，精力转向呈现/叙事 |
| 操作引导 | P2（已交付） | Partial 顶栏新增「Merge related brief & re-run」一键按钮（`mergeRelatedAndRun`，`src/App.tsx`），复用既有 `relatedBriefs` 排序取第一条，拉取源文合并后立即重跑，不必再手动滚到底部三步操作 |
| ~~已知缺口~~ 已修复 | — | `findRelatedBriefs` 排序曾把早期 `job-fit-domain-battery`（14 域合并的测试产物）排在单一主题匹配之前——不仅靠关键词重叠数占便宜，还会因为混入的加拿大相关句子意外触发 `canada_nexus=direct`，拿到本不该有的加权。改为按候选自身 topic 指纹的命中占比折算 concrete/nexus 权重（`src/lib/related-briefs.ts`），干净单主题匹配现在排第一。回归测试 `npm run test:related-specificity`（已进 `npm test`），且用真实 outbox 数据验证过：同一条 SAMPLE 查询现在排第一的是 `domain-tech-chips`，不再是合并大杂烩 |
| 金标扩样 | P2（已被 Showcase 覆盖） | `examples/showcase/` 的 complete + deferred 固化样例已满足"演示稳定"的诉求，不再单独扩样 |
| F9 | P2（暂缓） | 作者自定义 context card 向导——新功能而非整改，与"冻结新门禁层"的纪律冲突，暂不做 |

## Later

- [ ] 听力 / PDF / SMTP  
- [ ] 多用户 / 计费（若公开产品化）  
