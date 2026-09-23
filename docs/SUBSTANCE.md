# 干货剥离（substance cut）

公开中文党政稿常有大量**可预期套话**。Yanxi 用 `substance_cut` 做民用阅读辅助：

> 先划八股 → 再列可核验线索 → 干货薄则降置信度。

不是「识破洗脑」，也不是揣测秘密意图。

## 阅读口诀

1. **划掉**：两个维护、深入贯彻、凝心聚力、强调/坚持/推动…
2. **留下**：数字、时限、文件名、谁负责、试点范围、禁止/红线、钱从哪来、点名行业、缓急变化，**以及**具名官方动作（人事任免、纪律处分、外交会见、发射/竣工、颁奖）与具名宣教活动（如"网络安全周"）
3. **没有留下的** → `band=thin`，简报只当宣传骨架，等细则

**2026-09-23 修订——"细节"不再等于"政策工具"**：早期版本只把数字/时限/文件名/资金/试点这类政策工具词汇算作"干货"，导致人事任免、纪律通报、外交会见、发射/颁奖这类客观、具名、可核查的公开事实被当成"无细节"整体拒收。用户纠正：官方公布的客观信息（谁、做了什么具体动作、哪里、哪天）本身就是细节，不需要额外证伪；真正该划掉的只有"党八股"式无具名主体的泛泛号召语言。新增两类 `SubstanceKind`（`src/lib/substance.ts`）：
- `official_action`：人事任免/纪律处分/外交会见会晤/发射/竣工/颁奖等具体官方动作
- `named_campaign`：具名的宣传/教育活动（如"网络安全周""主题教育活动"）

两者都计入 `HARD_SUBSTANCE_KINDS`（`src/lib/adoption.ts`），命中即可采纳（动词/活动名清单本身已是精选，构造上即具体可核查，不需要像资金/数字线索那样再加一层"是否够格"的判定）。同时 `named_sector_or_place` 从硬编码地名列表改成通用行政区划正则，不再遗漏未入列的省份。实测 `public-live-collect`（真实 chinanews.com.cn RSS）采纳率从 1/15 升到 8-10/15。详见 `docs/DP-V2.md` §1 2026-09-23 修订、`docs/PRD.md` F28。

## 输出字段

`briefing.substance_cut`：

- `band`: `thin` | `mixed` | `dense`
- `nuggets[]`: 干货证据句
- `boilerplate_hits[]`: 命中的套话
- `empty_calories[]`: 给分析员的提醒
- `analyst_prompt_zh`: 固定口诀

UI 面板标题：**Verifiable detail**（八股 vs 可核验）。`so_what` 会前置 nugget 或 thin 警告。

## 与 adoption / intake / brief_quality

| 层 | 作用 |
|----|------|
| `substance_cut` | 检出硬线索（数字、时限、文件名…） |
| `adoption` | 无线索 → 整篇不采纳（rejected） |
| `intake` | 灰区第二刀：defer 进观察队列，仍不写完整简报正文 |
| `brief_quality` | 已采纳稿再分 complete / partial（双源+日期） |

详见 `docs/DP-brief-quality.md` · `docs/RELIABILITY.md`。

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
