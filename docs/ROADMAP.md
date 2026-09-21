# 研析 Yanxi — 路线图

## Phase A–B（完成）

- [x] MVP skills + offline + gate + UI  
- [x] Job-fit：记分卡、分诊、RSS 订阅、Cursor harness、公开仓  

## Phase C0–C（本轮）

- [x] 复用 GrantWright：`vendor/grantwright`（urlSafety + htmlToText）  
- [x] UI 引用高亮回链原文 + 结构化简报  
- [x] gate JSONL 审计（`outbox/audit/gate.jsonl`）  
- [x] DP / ARCHITECTURE 刷新  

## Phase D（本轮）

- [x] 再增 ≥5 张语境卡（五年规划/金融风险/意识形态教育/乡村振兴/双循环）  
- [x] 多源 merge（`sources[]` + digest `source_label`）  
- [x] collect `mergeMode: combined`（默认）  

## Phase E / testing pass

- [x] 岗位向多领域 fixtures + `npm run test:domains`  
- [x] 扩展 triage 种类；跨源 soft overlap；UI domain 选择器  
- [x] 分领域 so_what / outlook；测试报告含分析与预测；短摘录阈值修复  
- [x] 五栏简报桌面（总体目标/经济投资/外交/国防公开/社会治理）+ `npm run test:desk`  
- [x] 因子化置信度 + 印证分 + 加国公开政策对照 + 社交转述降权  
- [x] 公开风格链条回归 `npm run test:regress`（会议→细则、八股→干货、社交封顶）  
- [x] 栏目内印证报告（有什么/缺什么/配对合并是否上升）  
- [x] 加国政策对照可点开 URL + Portfolio 一页（`/portfolio`）  
- [x] Civic Ontology Lite：语境卡 frontmatter（type/desk/tag/updated/sources）+ 栏目优先挂卡 ≤8（`docs/ONTOLOGY-LITE.md`）  
- [x] 补 `intl_compare` 卡：中加公开话语 + 双边贸易摩擦对照  
- [x] 策展源档位权重 A–D/U（`source_tier` → confidence caps；非 ML）  
- [x] 免费部署：Render Blueprint（`render.yaml` + `docs/DEPLOY.md`）  
- [x] 简报价值：offline 原因可见 + 干货/缺什么优先 UI（`infoValue`）  
- [x] 删除虚「总体目标」栏；无细节/无数据 → 整篇不采纳（`adoption`）  
- [x] UI 统一英文（中文仅保留原文粘贴与摘录）  
- [x] 热点频道 `hot_topics`（台海 / 电动汽车 / 中国 AI / 芯片 / 关键矿产）  
- [x] 内容影响分析（`facts` + `analysis`；读者正文非方法论）  
- [x] 公开站 LLM 路径开放（无 brief token；靠 IP 限流）  
- [x] Intake 两刀（hard nuggets + local_gray / 可选 Jev）  
- [x] **时效时钟**：`temporal`（source_as_of / briefed_at / collected_at + freshness band）  
- [x] **信息量 / 互证**：UI 双源粘贴；outbox 同主题 `relatedBriefs` 软链接；同主题成对订阅（非无关大合并）  

## Next — P0（最高优先级）

- [x] **Jev / 第二刀 intake（灰区）**：`admit | defer | reject_thin | social_downweight`  
  - **第一刀不变**：白名单 + hard nuggets / `adoption`（本地、必跑）  
  - **第二刀**：`local_gray` 启发式默认开启；配置 `TYPESAFE_API_KEY` 时改走 TypeSafe Jev Choice（仅 defer↔reject_thin）  
  - **不**写简报正文；**不**覆盖 ethics/quote gate；**不**升级为 admit  
  - 非 admit 时跳过 LLM（省额度）  
  - 金标：`examples/intake-gold.json` · `npm run test:intake`  

## Later

- [ ] 听力 / PDF / SMTP  

