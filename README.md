# 研析 Yanxi

**Open Mandarin Contextual Briefing** — 民用、公开源、可审计的中文语境研究简报助手。

| | |
|--|--|
| **产品名** | 研析（Yanxi） |
| **英文全称** | Yanxi — Open Mandarin Contextual Briefing |
| **一句话** | 公开中文材料 → 政史文语境卡 → 英文 Briefing Note（含审慎政策展望与质量门禁）+ claim 门禁 |
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

公开演示站（Render）花的是运营者自己的 LLM 额度：

- **LLM 与采集均开放**：配了 `LLM_API_KEY` 后可直接 Generate；`POST /api/collect/run` 也不再要求 token。
- **offline / 模板**：勾选 “Force offline”（或未配 `LLM_API_KEY`）走模板引擎，不消耗模型额度。
- **限流与体积上限**：`/api/brief` 按 IP 限流（默认 10 分钟 20 次）；`/api/collect/run` 默认每窗口 6 次；请求体默认上限 `128kb`，`sourceText` 合计超过 24000 字符返回 `413`。

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
| [docs/PRD.md](docs/PRD.md) | 产品需求文档（v0.3） |
| [docs/DP.md](docs/DP.md) | 设计方案（总） |
| [docs/DP-brief-quality.md](docs/DP-brief-quality.md) | 简报质量门禁 DP（F11–F13） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技术架构 |
| [docs/ETHICS.md](docs/ETHICS.md) | 伦理与红线 |
| [docs/JOB-FIT.md](docs/JOB-FIT.md) | 岗位对齐范围（内部） |
| [docs/COLLECT.md](docs/COLLECT.md) | 白名单采集与 RSS 订阅 |
| [docs/HARNESS.md](docs/HARNESS.md) | Cursor harness（rules / skills / SDK） |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 路线图 |
| [docs/PORTFOLIO.md](docs/PORTFOLIO.md) | Portfolio 一页（面试/自用叙事） |
| [docs/ONTOLOGY-LITE.md](docs/ONTOLOGY-LITE.md) | Civic Ontology Lite（民用背景层 · 非 OWL） |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | 置信度 / 印证 / 简报质量 / 加国对照 / 社交降权 |
| [docs/SUBSTANCE.md](docs/SUBSTANCE.md) | 干货剥离（substance cut） |
| [docs/DEPLOY.md](docs/DEPLOY.md) | **免费部署**（Render Free） |
| [AGENTS.md](AGENTS.md) | Agent 入口约定 |

## 命名释义

- **研**：研究、研读公开材料
- **析**：分析、拆解语境与证据
- 刻意避开 Intelligence / SIGINT / Crime 等易被误读为仿机密系统的词干
