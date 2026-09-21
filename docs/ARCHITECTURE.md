# 研析 Yanxi — 技术架构

## 1. 总览

```
React UI ──POST /api/brief──► Express ──► pipeline
                                      ├ skills compose
                                      ├ intake early (skip LLM if not admit)
                                      ├ llm | offline
                                      ├ deterministic layers
                                      │   substance → adoption
                                      │   intake · temporal
                                      │   facts → content_analysis
                                      │   corroboration · confidence
                                      │   brief_quality + outlook clamp
                                      ├ claim gate
                                      └ audit JSONL (optional)
Whitelist collect ──safeFetch(GW)──► briefing ──► outbox + RSS
Paste save ──► outbox markdown (reader spine)
```

## 2. 核心模块

| 模块 | 职责 |
|------|------|
| `src/lib/pipeline.ts` | 编排：源归一化、LLM/offline、确定性层、relatedBriefs |
| `src/lib/skills.ts` | Yanxi briefing compose（中国 schema） |
| `src/lib/llm.ts` | OpenAI-compatible（可选） |
| `src/lib/offline.ts` | 无 Key / Force offline 模板简报 |
| `src/lib/substance.ts` | 八股剥离 → nuggets |
| `src/lib/adoption.ts` | 无硬细节 → 整篇不采纳 |
| `src/lib/intake.ts` / `jev.ts` | 第二刀灰区；可选 TypeSafe Jev |
| `src/lib/temporal.ts` | source_as_of / freshness |
| `src/lib/brief-quality.ts` | complete \| partial \| rejected；likelihood cap |
| `src/lib/facts.ts` / `analysis.ts` | 内容事实抽取与分领域 so_what / 情景四件套（规则引擎，兜底 alternative/falsifier） |
| `src/lib/scenario-enrich.ts` | 可选：LLM 一次性重写全部情景的 alternative/falsifier（ACH 同批对比），拒绝雷同/字段缺失则整批放弃，保留规则引擎文案 |
| `src/lib/confidence.ts` | 印证分 + 因子化置信度 |
| `src/lib/gate.ts` | L1 claim/ethics |
| `src/lib/brief-markdown.ts` | 读者脊柱 → markdown |
| `src/lib/media-heuristics.ts` | 公开报道启发式加权 |
| `src/lib/info-triage.ts` | 种类 + P1–P4 |
| `src/lib/ontology-lite.ts` | 语境卡匹配 |
| `src/lib/public-fetch.ts` | 白名单 + **GW urlSafety / htmlToText** |
| `src/lib/collector.ts` / `outbox.ts` / `related-briefs.ts` | 采集、落盘、同题软链 |
| `src/lib/audit-log.ts` | `outbox/audit/gate.jsonl` |
| `vendor/grantwright/*` | 私有仓安全切片（非拨款域） |

## 3. Skills 布局

```
skills/
  briefing-writer/SKILL.md
  ethics-sandbox/SKILL.md
  context-cards/*.md
```

## 4. API（摘要）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/health` | `product: yanxi` |
| POST | `/api/brief` | 单源或 `sources[]`；可选 `sourcePublishedAt` / `collectedAt` / `forceOffline` |
| POST | `/api/brief/save` | 持久化读者 markdown 到 outbox |
| GET | `/api/subscriptions` | 订阅列表 + feedUrl |
| GET | `/api/sources` | 白名单 |
| GET | `/api/outbox` | 近期简报 |
| POST | `/api/collect/run` | 触发采集（公开站 IP 限流） |
| GET | `/feeds/:id.xml` | RSS |
| GET | `/portfolio` | Portfolio 静态页 |
| GET | `/outbox/briefs/:file` | 简报文件 |

限流与体积上限见 `DEPLOY.md` / `.env.example`。

## 5. 信任边界

- 浏览器无 LLM Key  
- 审计默认只存 sourceHash，不落全文（`YANXI_AUDIT=0` 可关）  
- 公开仓不包含 GrantWright 私有源码全文（仅 vendor 切片）  
- `brief_quality` / confidence / corroboration **不是**事件概率；Outlook 一律 `hypothesis`

## 6. 与 Nexus / GrantWright 边界

| 引入 | 不引入 |
|------|--------|
| GW SSRF/fetch、htmlToText | GW 拨款目录与 digest 邮件 |
| 证据高亮 UI | Neo4j / 侦办 UI |

## 7. 相关文档

- 产品需求：[PRD.md](./PRD.md)  
- 总设计：[DP.md](./DP.md)  
- 质量门禁：[DP-brief-quality.md](./DP-brief-quality.md)  
- 置信/印证：[RELIABILITY.md](./RELIABILITY.md)  
- 干货剥离：[SUBSTANCE.md](./SUBSTANCE.md)  
