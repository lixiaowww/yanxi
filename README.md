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
npm install && npm run demo && npm run portfolio && npm run dev
# → http://localhost:5179
# → http://localhost:5179/portfolio
```

可选 LLM（OpenAI-compatible）：复制 `.env.example` → `.env` 并填入 `LLM_API_KEY`。未配置时默认 **offline** 引擎。本地开发无需 token，直接可用。

### 公开部署的访问模型

公开演示站（Render）花的是运营者自己的 LLM 额度，因此：

- **offline / 模板路径开放**：勾选 “Force offline”（或运营者未配 `LLM_API_KEY`）时任何人都能跑，演示照常可用。
- **LLM 路径需要 token**：`POST /api/brief` 走 LLM 时需 `x-yanxi-token`（即 `BRIEF_API_TOKEN`），与 `POST /api/collect/run` 的 `COLLECT_API_TOKEN` 同一套约定。生产环境未设该变量 = LLM 运行**拒绝**（fail-safe，不是放开）。
- **限流与体积上限**：所有 `/api/brief` 调用按客户端 IP 限流（默认 10 分钟 20 次，超限 `429` + `Retry-After`）；请求体默认上限 `128kb`，`sourceText` 合计超过 24000 字符返回 `413`。
- 被拒时 UI 会给出英文提示，并说明 offline 模板路径仍可用。

变量说明见 [`.env.example`](.env.example)，部署配置见 [docs/DEPLOY.md](docs/DEPLOY.md)。

可选自动采集与订阅：

```bash
npm run collect              # 白名单源 → 英文简报 → outbox + RSS
npm run collect:daemon       # 定期运行（COLLECT_INTERVAL_MINUTES）
```

详见 [docs/COLLECT.md](docs/COLLECT.md)。订阅源示例：`http://localhost:5179/feeds/macro-public-digest.xml`。

可选 Cursor Agent harness：设置 `CURSOR_API_KEY` 后运行 `npm run harness:brief`（见 `docs/HARNESS.md`）。

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/PRD.md](docs/PRD.md) | 产品需求文档 |
| [docs/DP.md](docs/DP.md) | 设计方案 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技术架构 |
| [docs/ETHICS.md](docs/ETHICS.md) | 伦理与红线 |
| [docs/JOB-FIT.md](docs/JOB-FIT.md) | 岗位对齐范围（内部） |
| [docs/COLLECT.md](docs/COLLECT.md) | 白名单采集与 RSS 订阅 |
| [docs/HARNESS.md](docs/HARNESS.md) | Cursor harness（rules / skills / SDK） |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 路线图 |
| [docs/PORTFOLIO.md](docs/PORTFOLIO.md) | Portfolio 一页（面试/自用叙事） |
| [docs/ONTOLOGY-LITE.md](docs/ONTOLOGY-LITE.md) | Civic Ontology Lite（民用背景层 · 非 OWL） |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | 置信度 / 印证 / 加国对照 / 社交降权 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | **免费部署**（Render Free） |
| [AGENTS.md](AGENTS.md) | Agent 入口约定 |

## 命名释义

- **研**：研究、研读公开材料
- **析**：分析、拆解语境与证据
- 刻意避开 Intelligence / SIGINT / Crime 等易被误读为仿机密系统的词干
