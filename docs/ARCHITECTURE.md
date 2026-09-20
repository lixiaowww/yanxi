# 研析 Yanxi — 技术架构

## 1. 总览

```
┌─────────────────────────────────────────────┐
│  React UI (Vite)                            │
│  paste → POST /api/brief → render JSON/gate │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Express (server.ts)                        │
│  /api/health  /api/brief                    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  pipeline.ts                                │
│  skills.compose → llm|offline → gate        │
└─────────────────────────────────────────────┘
         │                │              │
    skills/*.md      llm.ts / offline   gate.ts
```

## 2. 核心模块

| 模块 | 职责 |
|------|------|
| `src/lib/skills.ts` | 读 MD、剥 frontmatter、关键词匹配 cards、组装 system prompt |
| `src/lib/llm.ts` | OpenAI-compatible chat/completions + `json_object` |
| `src/lib/offline.ts` | 无 Key 演示：切句、引用子串、模板英文简报 |
| `src/lib/gate.ts` | L1 claim/ethics 检查 |
| `src/lib/pipeline.ts` | 编排与降级 |

## 3. Skills 布局

```
skills/
  briefing-writer/SKILL.md
  ethics-sandbox/SKILL.md
  context-cards/
    party-state-lexicon.md
    historical-analogy-discipline.md
    cultural-semantics.md
```

与 GrantWright 同构思想：`compose*SystemPrompt()` 在服务端拼装；业务专家改 MD 即改行为。

## 4. API

### `GET /api/health`

```json
{ "ok": true, "product": "open-mandarin-briefing", "framing": "civilian-open-source-research", "llm": false }
```

`product` 字段为 `yanxi`。

### `POST /api/brief`

请求：`{ sourceText, sourceLabel?, forceOffline? }`  
响应：`{ mode, matchedCards, briefing, gate, systemPromptChars }`

## 5. 数据流与信任边界

- 浏览器永不持有 LLM Key  
- 默认不持久化用户粘贴（MVP 无 DB）  
- 外置盘仅存文档；代码在家目录 SSD，经 `yanxi/code` 符号链接

## 6. 与 Nexus_Crime 的边界

| 引入 | 不引入 |
|------|--------|
| 「证据可回链」产品原则 | Neo4j 全栈、犯罪案件 UI、Bayesian 场景模板 |
| 置信/待核实列表 | 「Upload Intelligence」文案与侦办工作流 |

## 7. 演进点

- v0.2：白名单公开 URL fetch + 多源 merge  
- v0.2：gate 报告写入本地 JSONL（可选）  
- v0.3：将 health/API product id 全面更名为 `yanxi`  
- 可选：把 provenance UI 做成「引用高亮」而非图谱  
