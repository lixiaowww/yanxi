# 研析 Yanxi — 技术架构

## 1. 总览

```
React UI ──POST /api/brief──► Express ──► pipeline
                                      ├ skills compose
                                      ├ llm | offline
                                      ├ scorecard + triage
                                      ├ claim gate
                                      └ audit JSONL (optional)
Whitelist collect ──safeFetch(GW)──► briefing ──► outbox + RSS
```

## 2. 核心模块

| 模块 | 职责 |
|------|------|
| `src/lib/skills.ts` | Yanxi briefing compose（中国 schema） |
| `src/lib/llm.ts` | OpenAI-compatible（env 与 GW 同名） |
| `src/lib/offline.ts` | 无 Key 演示 |
| `src/lib/gate.ts` | L1 claim/ethics（Finding 形态对齐 GW briefGate） |
| `src/lib/media-heuristics.ts` | 公开报道启发式加权 |
| `src/lib/info-triage.ts` | 种类 + P1–P4 |
| `src/lib/public-fetch.ts` | 白名单 + **GW urlSafety / htmlToText** |
| `src/lib/collector.ts` / `outbox.ts` | 订阅采集与 RSS |
| `src/lib/audit-log.ts` | `outbox/audit/gate.jsonl` |
| `vendor/grantwright/*` | 私有仓安全切片（非拨款域） |

## 3. Skills 布局

```
skills/
  briefing-writer/SKILL.md
  ethics-sandbox/SKILL.md
  context-cards/*.md
```

## 4. API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/health` | `product: yanxi` |
| POST | `/api/brief` | 单源简报 |
| GET | `/api/subscriptions` | 订阅列表 + feedUrl |
| GET | `/api/sources` | 白名单 |
| GET | `/api/outbox` | 近期简报 |
| POST | `/api/collect/run` | 触发采集（可选 token） |
| GET | `/feeds/:id.xml` | RSS |
| GET | `/outbox/briefs/:file` | 简报文件 |

## 5. 信任边界

- 浏览器无 LLM Key  
- 审计默认只存 sourceHash，不落全文（`YANXI_AUDIT=0` 可关）  
- 公开仓不包含 `/mnt/.../grantwright` 私有源码全文（仅 vendor 切片）  

## 6. 与 Nexus / GrantWright 边界

| 引入 | 不引入 |
|------|--------|
| GW SSRF/fetch、htmlToText | GW 拨款目录与 digest 邮件 |
| 证据高亮 UI | Neo4j / 侦办 UI |
