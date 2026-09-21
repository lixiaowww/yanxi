# 研析 Yanxi — 设计方案：简报质量加固（DP）

| 字段 | 内容 |
|------|------|
| 产品 | 研析 Yanxi |
| 版本 | 0.3-dp |
| 日期 | 2026-09-21 |
| 类型 | Design Proposal（修复开发计划） |
| 对应 PRD | [PRD.md](./PRD.md) F1–F10；本 DP 增补 F11–F13 |
| 伦理 | [ETHICS.md](./ETHICS.md) — 民用公开源；禁止情报机关/SIGINT 叙事 |
| Harness | [HARNESS.md](./HARNESS.md) · `AGENTS.md` · `.cursor/rules/*` |

---

## 0. 问题陈述（来自成品审阅）

当前系统在门禁与诚实标签上合格，但**交付物仍不像可传阅的研究简报**：

| ID | 问题 | 严重度 |
|----|------|--------|
| Q1 | 默认单源短粘贴 → 信息量不足以支撑完整简报 | P0 |
| Q2 | 同题互证未进入日常路径（印证只在单次 `sources[]`） | P0 |
| Q3 | 无可靠时间锚 → 无法做时效研判；Outlook 仍可能「看起来完整」 | P0 |
| Q4 | 预测段缺替代解释与可证伪条件 → 像断言不像情景包 | P0 |
| Q5 | 读者曾长期只感到 What/So what（骨架已补，需与质量门禁绑定） | P1 |
| Q6 | 置信/印证易被误读为事件概率 | P1 |

本 DP **只做 Q1–Q4**（P0）。不做：机密情报流程模仿、越权抓取、臆造第二源。

---

## 1. 设计目标

1. **完整简报有准入条件**：同题 ≥2 独立公开摘录，或明确标为 *partial*。  
2. **时效是一等公民**：无 `source_as_of` 则 Outlook 降权并顶栏明示。  
3. **预测四件套**：每个情景含 label / basis / trigger / **alternative** / **falsifier**。  
4. 保持民用 framing：`hypothesis` / `background`；禁止 will-definitely。

非目标：把 Yanxi 做成情报机关工作流；自动爬取登录墙；用 Jev 写正文。

---

## 2. 方案选型

| 方案 | 结论 | 理由 |
|------|------|------|
| A. 仅改 UI 文案「请多贴源」 | 否 | 不改变交付物结构 |
| B. 单源也硬生成「完整简报」并灌模板 | 否 | 虚假厚度，违诚实 |
| **C. 质量门禁 + 预测四件套 + 时效降权** | **是** | 与现有 adoption/intake/intake 两刀一致；可测 |

---

## 3. 信息架构（变更后）

```
paste / sources[] / collect
   ↓
facts + adoption（第一刀）+ intake（第二刀）
   ↓
temporal（source_as_of / freshness）
   ↓
brief_quality gate  ← NEW
   · complete  = adopted ∧ sourceCount≥2 ∧ (freshness≠unknown ∨ operator_dated)
   · partial   = adopted ∧ ¬complete
   · rejected  = ¬adopted（含 defer 观察队列）
   ↓
content analysis + outlook（四件套）
   ↓
UI / outbox markdown（完整脊柱）
```

### 3.1 新增 / 扩展字段

```ts
brief_quality: {
  framing: "civilian-brief-quality";
  level: "complete" | "partial" | "rejected";
  label_en: string;
  missing: string[];      // e.g. "second_public_source", "source_as_of"
  tag: "hypothesis";
}

ForecastScenario {
  // existing: label, likelihood, horizon?, basis, trigger?, tag
  alternative?: string;   // NEW — competing reading
  falsifier?: string;     // NEW — public observation that kills this path
}
```

### 3.2 读者脊柱（不变，与质量门禁绑定）

`Digest → What → Context → Key facts → So what → Outlook → Watchpoints → Open questions → Cross-source`

- `complete`：全段展示，Outlook 正常。  
- `partial`：全段展示，但顶栏 **Partial brief**；Outlook 标题加 “(provisional — single source / undated)”。  
- `rejected`：短拒收/延期卡（已有）。

---

## 4. 详细设计

### 4.1 F11 — 双源完整简报门禁

| 规则 | 行为 |
|------|------|
| `sourceCount >= 2` 且 adoption 通过 | 可标 `complete`（仍受时效约束，见 F12） |
| `sourceCount == 1` 且 adoption 通过 | 强制 `partial`；`missing` 含 `second_public_source`；infoValue 提示载入 Related / 第二框 |
| 字节相同的双贴 | 仍算 1 源（沿用 corroboration distinct 逻辑） |

**不做：** 自动发明第二源；把 unrelated multi-domain merge 算 complete。

**代码：** `src/lib/brief-quality.ts`；`pipeline.ts` 挂载；`App.tsx` 顶栏芯片；`brief-markdown.ts` 头字段。

### 4.2 F12 — 时效降权

| 条件 | 行为 |
|------|------|
| `freshness.band === "unknown"` 且无 operator `sourcePublishedAt` | `missing` 含 `source_as_of`；不可 `complete` |
| 同上且有 Outlook | 所有情景 `likelihood` 上限压到 `low`；增加 watchpoint（已有则去重） |
| `aging` / `stale` | 保持 complete 资格，但 Outlook 标题标注时效风险；likelihood 上限 `medium` |

**代码：** `temporal.ts` 导出 `outlookLikelihoodCap`；`analysis.ts` 或 pipeline 后处理情景；UI 芯片已有，加强文案。

### 4.3 F13 — 预测四件套

每个 `ForecastScenario` 必须尽量填：

| 字段 | 含义 |
|------|------|
| `label` | 可能发生的公开结果 |
| `basis` | 与本摘录事实的因果链（hypothesis） |
| `trigger` | 可观察确认信号 |
| `alternative` | 至少一条竞争解释 |
| `falsifier` | 何种公开观察使本情景失效 |

**代码：** 扩展 `analysis.ts` 各 `*Scenario` 工厂；gate 软检查（缺字段 soft warn，不 hard-fail，以免旧 LLM JSON 全挂）；UI + markdown 展示。

### 4.4 验证

| 命令 | 期望 |
|------|------|
| `npm run test:multi` | 双源 corr↑；quality=complete（若有日期或 provided date） |
| `npm run test:temporal` | unknown → cap |
| 新增 `npm run test:brief-quality` | 单源→partial；双源+日期→complete；情景含 alternative/falsifier |
| `npm test` | 全绿 |

---

## 5. 风险与伦理

| 风险 | 缓解 |
|------|------|
| 用户以为 partial「不完整」= 系统坏了 | 顶栏英文说明 + 一键「Use related as second source」 |
| 双源门禁降低演示通过率 | fixture 对 + UI 第二框；Force offline 样例用 meeting+instrument |
| 被读成情报定案 | 全程 `hypothesis`；ETHICS 不变 |
| LLM 忽略新字段 | offline 路径保证四件套；LLM 缺字段 soft |

---

## 6. 里程碑

| 步 | 交付 | 状态 |
|----|------|------|
| M0 | 本 DP 入库；ROADMAP/PRD 挂钩 | 完成 |
| M1 | `brief_quality` + UI/markdown | 完成 |
| M2 | 时效 → Outlook likelihood cap | 完成 |
| M3 | alternative + falsifier | 完成 |
| M4 | `test:brief-quality` + 回归 | 完成 |

Out of scope（Later）：持久盘、Jev 金标接线、强制 live 白名单扩源。

---

## 7. Harness 约束（执行时）

- 改领域话术前先改 `skills/briefing-writer/SKILL.md`。  
- 硬红线只加 `gate.ts` soft/hard 与本 DP 一致。  
- UI 英文；中文仅原文与摘录。  
- 验证：`npm test`（含新脚本）。

---

## 8. 决策记录

| 决策 | 选择 |
|------|------|
| 单源是否禁止 Outlook | 否 — 保留但 provisional + likelihood cap |
| complete 是否要求 cross_checked | 否 — 要求 sourceCount≥2 即可；印证分仍独立 |
| falsifier hard-gate | 否 — soft；offline 必填 |
