# 研析 Yanxi — 设计方案（DP / Design Proposal）

| 字段 | 内容 |
|------|------|
| 产品 | 研析 Yanxi |
| 版本 | 0.2 |
| 日期 | 2026-09-20 |
| 对应 PRD | [PRD.md](./PRD.md) |

---

## 1. 设计目标

做一个垂直、轻量、可演示的「中文公开源语境简报」系统：claim gate 落实诚实输出；context cards 承载政史文领域知识；可选白名单采集与 RSS 订阅。

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
输入: paste 或 whitelist collect
   ↓
Skills 组合 (briefing-writer / ethics / context-cards)
   ↓
LLM（可选）或 Offline
   ↓
Deterministic layers: signaling_scorecard + info_triage
   ↓
Claim Gate → optional gate.jsonl audit
   ↓
UI / outbox / RSS
```

### 3.1 输出字段

1. `source_digest_zh` — 要点 + 原文短引（UI 可高亮回链）  
2. `context_notes` — background\|hypothesis  
3. `info_triage` — 种类 + P1–P4（非密级）  
4. `signaling_scorecard` / `signaling_valves` — 先枚举再加权  
5. `briefing_en` — what / context / so_what / confidence  
6. `policy_outlook` — 场景假设  
7. `open_questions`

## 4–7

交互：左源文（高亮）/ 右结构化简报；页眉民用徽章。  
语境卡：Markdown frontmatter `match`；作者改 MD 即训练。  
门禁：ethics hard、quote 子串 hard、过度断言 soft。  
技术：Node / Express / Vite / React；默认 offline。

## 8. 目录拓扑

| 位置 | 内容 |
|------|------|
| `/mnt/external_storage/File/yanxi/` | 统一产品仓（文档+代码） |
| `/mnt/external_storage/File/grantwright/` | 私有兄弟仓（复用源；不进公开 push） |
| `github.com/lixiaowww/yanxi` | 公开仓 |

## 9. 风险

误读为情报工具 → ETHICS；幻觉 → quote gate；私有模块泄露 → 仅 vendor 安全切片。

## 10. 里程碑（阶段）

| 阶段 | 目标 | 状态 |
|------|------|------|
| A MVP | paste→skills→gate→UI | 完成 |
| B Job-fit | 记分卡、分诊、RSS、harness | 完成 |
| C0 复用 | vendor GW urlSafety/htmlToText | 完成 |
| C Provenance | quote 高亮、gate JSONL、文档 | 本轮 |
| D 知识与多源 | +cards、多源 merge、collect combined | 完成 |
| E Later | 听力/PDF/SMTP/Portfolio | 低优先 |

详见 [ROADMAP.md](./ROADMAP.md)、[COLLECT.md](./COLLECT.md)。
