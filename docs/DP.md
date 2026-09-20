# 研析 Yanxi — 设计方案（DP / Design Proposal）

| 字段 | 内容 |
|------|------|
| 产品 | 研析 Yanxi |
| 版本 | 0.1 |
| 日期 | 2026-09-20 |
| 对应 PRD | [PRD.md](./PRD.md) |

---

## 1. 设计目标

在 **不复制 GrantWright 业务代码** 的前提下，复用其已被验证的 **runtime skills 组合** 模式，做一个垂直、轻量、可演示的「中文公开源语境简报」系统；用 **claim gate** 落实 Veragent/GrantWright 式诚实输出；用 **context cards** 承载作者对中国历史、文化、政治的领域强项。

## 2. 方案选型

| 方案 | 结论 | 理由 |
|------|------|------|
| A. 直接改 GrantWright 私有仓 | 否 | 污染拨款业务；权限/数据模型过重 |
| B. 以 Nexus_Crime 为主底座 | 否 | 犯罪情报叙事风险高；栈重（Neo4j/Celery）；缺中文语境层 |
| **C. 新建 Yanxi 轻量仓 + skills 同构** | **是** | 边界清晰、可一周内演示、文档与代码可分置 |

**Nexus 的可借鉴点（设计层，非代码迁入）：**

- 结果可回链证据（provenance 纪律）  
- 置信度 / 待合并歧义对人可见  
- 人在回路确认后再「定论」

## 3. 信息架构

```
输入: 公开中文 paste (+ label)
   ↓
Skills 组合
  ├─ briefing-writer   (方法 + 诚实规则)
  ├─ ethics-sandbox    (硬红线)
  └─ context-cards*    (关键词命中的政史文卡)
   ↓
生成器: LLM（可选）或 Offline 规则引擎
   ↓
Claim Gate (L1)
   ↓
输出: JSON 简报 + gate findings → UI
```

### 3.1 输出信息架构（Briefing Note）

1. **source_digest_zh** — 要点 + 原文短引  
2. **context_notes** — 卡名 + 说明 + `background|hypothesis`  
3. **briefing_en** — what / context / so_what / confidence / sources_used  
4. **open_questions** — 待核实清单  

## 4. 交互设计（MVP）

- 左：粘贴区、label、Force offline、Generate  
- 右：mode / matched cards / gate PASS|FAIL / JSON  
- 页眉徽章：**Not an intelligence product · Public sources only · Human review required**

原则：一屏完成一次研究闭环；不出现「Command Center / Upload Intelligence」等 Nexus 式侦办用语。

## 5. 领域设计：Context Cards

| 卡（v0.1） | 作用 |
|------------|------|
| party-state-lexicon | 党国常用制度/政策词汇表意 |
| historical-analogy-discipline | 历史类比的安全用法（默认 under-claim） |
| cultural-semantics | 舆论/稳定/正能量等话语语义 |

**扩展规则：**

- YAML/MD frontmatter：`name` + `match: "关键词" …`  
- 正文只提供 **background**；禁止写成未源断言  
- 作者增补卡片 = 「训练系统」，无需微调模型（GrantWright 同哲学）

## 6. 质量门禁设计

| 检查 | 级别 | 行为 |
|------|------|------|
| 禁用情报/间谍框架词 | hard | gate fail |
| quote ∉ 原文 | hard | gate fail |
| context tag 非法 | soft | 提示 |
| so_what 过度确定措辞 | soft | 提示 |

LLM 路径失败时降级 offline，保证演示不中断。

## 7. 技术选型（摘要）

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。要点：

- Node 20+ / Express / Vite / React 19 / TypeScript  
- Skills 运行时读本地 `skills/**/*.md`  
- 环境变量可选 LLM；默认 offline  

## 8. 目录与部署拓扑

| 位置 | 内容 |
|------|------|
| `/mnt/external_storage/File/yanxi/` | 产品文档根（外置硬盘） |
| `yanxi/code` → `~/open-mandarin-briefing` | 可运行代码（SSD，性能更好） |
| 未来 `github.com/lixiaowww/yanxi` | 建议公开仓名与产品名对齐 |

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 被误读为仿情报工具 | 命名/文案/ETHICS；UI 禁用侦办黑话 |
| 语境卡偏见或过时 | 卡片版本化；hypothesis 标签强制 |
| LLM 幻觉 | quote 子串门禁；offline 保守输出 |
| 申请材料过度承诺 | NARRATIVE 仅写民用能力，不写 clearance |

## 10. 里程碑（设计视角）

见 [ROADMAP.md](./ROADMAP.md)。DP 冻结 v0.1 范围后，功能变更走 PRD 修订。  
