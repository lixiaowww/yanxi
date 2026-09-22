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

## Next（产品）

| 项 | 说明 |
|----|------|
| 操作引导 | Partial 顶栏 → 「Use related as second source」一键合并再跑（UX 加固） |
| 金标扩样 | 为 complete/partial 增少量固定 fixtures（演示稳定） |
| F9 | 作者自定义 context card 向导（可选） |

## Later

- [ ] 听力 / PDF / SMTP  
- [ ] 多用户 / 计费（若公开产品化）  
