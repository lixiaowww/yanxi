# 研析 Yanxi

**Open Mandarin Contextual Briefing** — 民用、公开源、可审计的中文语境研究简报助手。

| | |
|--|--|
| **产品名** | 研析（Yanxi） |
| **英文全称** | Yanxi — Open Mandarin Contextual Briefing |
| **一句话** | 公开中文材料 → 政史文语境卡 → 英文 Briefing Note（含审慎政策展望）+ claim 门禁 |
| **仓** | [github.com/lixiaowww/yanxi](https://github.com/lixiaowww/yanxi) |
| **架构血缘** | GrantWright runtime skills 组合；Nexus_Crime 仅借鉴溯源/置信纪律（非主底座） |

## 本地运行

```bash
npm install && npm run demo && npm run dev
# → http://localhost:5179
```

可选 LLM（OpenAI-compatible）：复制 `.env.example` → `.env` 并填入 `LLM_API_KEY`。未配置时默认 **offline** 引擎。

可选 Cursor Agent harness：设置 `CURSOR_API_KEY` 后运行 `npm run harness:brief`（见 `docs/HARNESS.md`）。

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/PRD.md](docs/PRD.md) | 产品需求文档 |
| [docs/DP.md](docs/DP.md) | 设计方案 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技术架构 |
| [docs/ETHICS.md](docs/ETHICS.md) | 伦理与红线 |
| [docs/JOB-FIT.md](docs/JOB-FIT.md) | 岗位对齐范围（内部） |
| [docs/HARNESS.md](docs/HARNESS.md) | Cursor harness（rules / skills / SDK） |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 路线图 |
| [AGENTS.md](AGENTS.md) | Agent 入口约定 |

## 命名释义

- **研**：研究、研读公开材料
- **析**：分析、拆解语境与证据
- 刻意避开 Intelligence / SIGINT / Crime 等易被误读为仿机密系统的词干
