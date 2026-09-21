# 干货剥离（substance cut）

公开中文党政稿常有大量**可预期套话**。Yanxi 用 `substance_cut` 做民用阅读辅助：

> 先划八股 → 再列可核验线索 → 干货薄则降置信度。

不是「识破洗脑」，也不是揣测秘密意图。

## 阅读口诀

1. **划掉**：两个维护、深入贯彻、凝心聚力、强调/坚持/推动…
2. **留下**：数字、时限、文件名、谁负责、试点范围、禁止/红线、钱从哪来、点名行业、缓急变化
3. **没有留下的** → `band=thin`，简报只当宣传骨架，等细则

## 输出字段

`briefing.substance_cut`：

- `band`: `thin` | `mixed` | `dense`
- `nuggets[]`: 干货证据句
- `boilerplate_hits[]`: 命中的套话
- `empty_calories[]`: 给分析员的提醒
- `analyst_prompt_zh`: 固定口诀

UI 面板标题：**Verifiable detail**（八股 vs 可核验）。`so_what` 会前置 nugget 或 thin 警告。

## Calibration status: none

The band is a **rule-based count of detected cue types**, with thresholds set by eye. It has never
been checked against labelled data:

- The cue detectors are hand-written regexes over public policy vocabulary.
- `substance_score_0_to_1` and `boilerplate_ratio_0_to_1` are internal ordering numbers. The weights
  behind the score (per cue type, per nugget) and the `thin` / `mixed` / `dense` cut-points were
  chosen by hand, not fitted. The three decimal places are an artifact of the division, not
  precision.
- No labelled corpus, no train/test split, no validation report exists in this repo.

So the band **orders and flags**; it does not measure how substantive a document is. A `dense` band
means "several kinds of verifiable cue were found in the text" — nothing more. A `thin` band means
"the detectors found little to check", which can also mean the detectors simply missed something.

Because of that, human-facing surfaces show the **band plus a basis clause naming the cue types
found** ("numbers, deadlines and named instruments detected"), never the score. The internal numbers
stay in the JSON and in the Raw JSON inspection view. Rendering helpers:
`substanceBasisEn()` in `src/lib/score-bands.ts`.

`docs/RELIABILITY.md` lists what a genuine calibration would require (labelled corpus, written label
definition, held-out evaluation). Until that exists, treat the band as triage, and read the nuggets.

## 代码

`src/lib/substance.ts` · 语境卡 `skills/context-cards/boilerplate-vs-substance.md`
