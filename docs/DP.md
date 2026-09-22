# 研析 Yanxi — 设计方案（DP / Design Proposal）

| 字段 | 内容 |
|------|------|
| 产品 | 研析 Yanxi |
| 版本 | 0.3 |
| 日期 | 2026-09-22 |
| 对应 PRD | [PRD.md](./PRD.md) |
| 质量加固 DP | [DP-brief-quality.md](./DP-brief-quality.md)（F11–F13，已执行） |

---

## 1. 设计目标

做一个垂直、轻量、可演示的「中文公开源语境简报」系统：

- claim gate 落实诚实输出；  
- context cards 承载政史文领域知识；  
- intake / adoption 挡住无干货粘贴；  
- temporal + brief_quality 控制「看起来完整」的假厚度；  
- 可选白名单采集与 RSS 订阅。

## 2. 方案选型

| 方案 | 结论 | 理由 |
|------|------|------|
| A. 直接改 GrantWright 私有仓 | 否 | 污染拨款业务 |
| B. Nexus_Crime 为主底座 | 否 | 犯罪情报叙事风险；栈重 |
| **C. Yanxi 轻量仓 + 横切复用 GrantWright** | **是** | 业务隔离；复用已验证 SSRF/fetch/htmlToText |

**复用（横切，见 `vendor/grantwright/`）：** `urlSafety`（safeFetch）、`htmlToText`  
**不迁入：** `programs` / Manitoba 源表 / digest 邮件管道 / LoginGate  
**借鉴（非代码）：** Nexus provenance 纪律 → UI 引用高亮

## 3. 信息架构

```
输入: paste / sources[] / whitelist collect
   ↓
Skills 组合 (briefing-writer / ethics / context-cards)
   ↓
LLM（可选）或 Offline
   ↓
Deterministic layers
   · substance_cut → adoption（第一刀）
   · intake（第二刀：local_gray / 可选 Jev）
   · temporal（source_as_of / freshness）
   · facts + content_analysis
   · corroboration + confidence_factors
   · brief_quality（complete | partial | rejected）
   · Outlook likelihood clamp + 四件套补全
   ↓
Claim Gate → optional gate.jsonl audit
   ↓
UI 读者脊柱 / outbox markdown / RSS
```

### 3.1 读者脊柱（交付物）

`Digest → What → Context → Key facts → So what → Outlook → Watchpoints → Open questions → Cross-source`

方法论文本（记分卡数字、内部 0–1）放折叠分析面板 / Raw JSON，不进正文。

### 3.2 核心输出字段

| 字段 | 作用 |
|------|------|
| `source_digest_zh` | 要点 + 原文短引（须为粘贴子串） |
| `context_notes` / `ontology_lite` | background \| hypothesis |
| `substance_cut` / `adoption` | 干货 vs 八股；无硬细节则整篇不采纳 |
| `intake` | 灰区第二刀：admit / defer / reject_thin / social_downweight |
| `temporal` | source_as_of · briefed_at · freshness band |
| `brief_quality` | complete \| partial \| rejected（见质量 DP） |
| `info_triage` | 种类 + P1–P4（非密级） |
| `signaling_scorecard` / `signaling_valves` | 先枚举再加权 |
| `content_analysis` | 分领域背景 / so_what / 情景草稿 |
| `briefing_en` | what / context / so_what / confidence |
| `policy_outlook` | 情景四件套 + watchpoints |
| `corroboration` / `confidence_factors` | 跨源印证与草稿置信（非事件概率） |
| `open_questions` | 待核实 |

## 4. 交互

- 左：源文（引用可高亮回链）；可双框粘贴第二源。  
- 右：读者脊柱；顶栏芯片含 Adopted / Partial·Complete / Freshness / Gate。  
- Outlook 在 partial 或 undated 时标 provisional；情景展示 Alternative / Falsifier。  
- 保存：可读 markdown → outbox。

## 5. 语境卡

Markdown frontmatter（type / desk / tag / updated / sources / match）；作者改 MD 即训练。  
匹配器：`ontology-lite.ts`；栏目优先挂卡 ≤8。见 `ONTOLOGY-LITE.md`。

## 6. 门禁

| 层 | 行为 |
|----|------|
| ethics / 密级词 | hard |
| quote 子串 | hard |
| 过度断言（will definitely…） | soft |
| Outlook 缺 alternative/falsifier | soft（offline 路径应已填） |
| brief_quality | 产品门禁字段；非 gate hard-fail |

## 7. 技术

Node / Express / Vite / React。公开部署见 `DEPLOY.md`。  
验证：`npm test`。Agent 约定：`AGENTS.md` · `HARNESS.md`。

### 7.1 LLM 供应商（运行事实，F19）

本地开发与 Render 生产环境**均已配置双 OpenAI-compatible 供应商**，不是"可选未开"的状态：

| 角色 | 供应商 | 环境变量 |
|------|--------|----------|
| 主 | Groq (`gpt-oss-20b`) | `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` |
| 备（429/失败时自动切换，F16） | DeepSeek (`deepseek-chat`) | `LLM_FALLBACK_API_KEY` / `LLM_FALLBACK_BASE_URL` / `LLM_FALLBACK_MODEL` |

因此**实际默认路径是 LLM**（`BriefResponse.llmProvider` 标注 `primary`/`fallback`），offline 规则模板只在两个供应商都失败时才触发（`src/lib/llm.ts`）。文档、UI 文案、demo 脚本不应再默认假设"无 key 走 offline"——那是最终兜底，不是标准演示状态。`outbox/briefs/` 里当前留存的样例大多来自早期 `forceOffline: true` 的测试脚本（`npm run demo` 等确定性场景），不代表当前 LLM 路径的产出质量；见整改意见 P0-2（`docs/ROADMAP.md` Next）。

`npm run showcase`（`scripts/build-showcase.ts`）用真实 LLM 调用固化 `examples/showcase/` 下的 complete + deferred 两个参照样例，供 Portfolio 静态展示。**不进 `npm test`**——会打真实 Groq/DeepSeek 网络请求、消耗额度、输出非确定性，与其余确定性回归套件性质不同，同 `npm run collect` / `npm run harness:brief` 一样是可选的实况脚本。
