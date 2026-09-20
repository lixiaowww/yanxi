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

UI 面板标题：**干货剥离（八股 vs 可核验）**。`so_what` 会前置 nugget 或 thin 警告。

## 代码

`src/lib/substance.ts` · 语境卡 `skills/context-cards/boilerplate-vs-substance.md`
