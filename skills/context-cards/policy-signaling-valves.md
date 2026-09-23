---
name: policy-signaling-valves
type: method
desk: all
match: "中央经济工作会议" "人民日报" "新华社" "头版" "社论" "评论员文章" "实施细则" "实施方案" "办法" "条例" "通知" "意见" "贯彻落实" "先后" "党中央" "国务院" "政府工作报告" "两会" "高质量发展" "新质生产力" "试点" "强调" "指出" "要求" "任仲平" "钟声" "国纪平" "金观平" "亲自" "关切" "谴责" "抗议" "个别" "极少数" "坚决维护"
description: Enumerated public PRC media heuristics with weights — civilian research calibrators (not secrets).
tag: hypothesis
updated: 2026-09-22
sources: Observable public PRC media/reporting conventions (open press patterns); China Media Project (pen-name bylines); Gao Yang / David Cowhig's Translation Blog (diplomatic jargon ladders); Asia Society Policy Institute (亲自 personal-leadership framing); see docs/DP-V3.md §4 for the full research trail
reviewed_by: Sean Li (native Mandarin speaker, author)
review_date: 2026-09-22
---

# Context card: 公开报道启发式清单（先枚举，再加权）

民用研究用语里常称「潜规则」，本卡将其定义为 **可观察的公开报道惯例**。  
流程固定为：

1. **先列举**全部启发式（下表 / 代码 `MEDIA_HEURISTICS`）  
2. **再打分**：每条 `status=hit|miss|unclear` → `raw_score` → `weight * raw_score`  
3. 汇总 `weighted_total` 与 `band=low|medium|high`，只作置信**调节阀**

**Discipline:** 非机密、非内幕；缺证据标 `unclear`；禁止编造头版页码或派系动机。

## 权重目录（与 `src/lib/media-heuristics.ts` 同步）

| id | 类别 | 权重 | 启发式（中文） |
|----|------|------|----------------|
| seq-party-before-state | sequence | 0.08 | 党的机关表述先于国务院/部委表述 |
| seq-meeting-to-document | sequence | 0.07 | 会议语言→文件语言的阶段线索 |
| seq-leader-title-order | sequence | 0.04 | 领导人/机构称谓排序可观察 |
| detail-named-instrument | implementing_detail | 0.12 | 出现意见/通知/办法/条例/细则 |
| detail-promised-later | implementing_detail | 0.05 | 承诺另行制定细则但本文未附 |
| detail-slogan-only | implementing_detail | 0.06 | 仅有强调/坚持/推动、无工具文件 |
| press-xinhua-wire | press_placement | 0.07 | 新华社电头 |
| press-peoples-daily | press_placement | 0.06 | 人民日报署名/转载线索 |
| press-front-page | press_placement | 0.08 | 头版/要闻位置明示 |
| press-editorial-genre | press_placement | 0.07 | 社论/评论员文章文体 |
| verb-hierarchy-cues | speech_verbs | 0.05 | 指出/强调/要求等话语动词 |
| attr-collective-center | attribution | 0.04 | 党中央/会议集体归因 |
| attr-ministry-issuer | attribution | 0.04 | 部委发文主体可识别 |
| conc-numeric-targets | concreteness | 0.06 | 可核验数字目标 |
| conc-timeline | concreteness | 0.04 | 明确时间表/年份节点 |
| scope-pilot-vs-national | rollout_scope | 0.04 | 试点 vs 全国推开用语 |
| tone-stability-prosperity | tone_framing | 0.03 | 稳定/安全与发展话语同现 |
| press-authoritative-byline | press_placement | 0.09 | 党媒权威笔名（任仲平/钟声/国纪平/金观平）——来源：China Media Project |
| attr-personal-leadership | attribution | 0.05 | "亲自"个人化领导信号——来源：Asia Society Policy Institute |
| tone-minimize-language | tone_framing | 0.04 | 弱化措辞（个别/极少数/不代表整体） |
| tone-resolve-language | tone_framing | 0.04 | 强化措辞（坚决维护/严厉打击/高度重视） |
| diplo-severity-ladder | diplomatic_severity | 0.05 | 外交措辞升级阶梯命中——来源：Gao Yang 外交辞令译注 |
| diplo-outcome-euphemism | diplomatic_severity | 0.04 | 会谈成果委婉语阶梯命中——同上 |

`hit=1.0` · `unclear=0.4` · `miss=0.0`；`weighted_total = Σ(weight × raw_score)`（按 `weight_sum` 动态归一化，加新规则不需要重新配平旧权重）。

**协议排序（人名先后）的范围说明**：`seq-leader-title-order` 只检测"是否有 ≥2 个协议序位称谓共同出现"，**不**检测"排序是否相对上一份通稿发生变化"——后者需要历史可比通稿做基线，本轮（无定时抓取历史）暂不实现，留给人工比对。见 `docs/DP-V3.md` §4/§7。

**Calibration status: none.** 权重与档位阈值均为手工设定的编辑先验，无标注语料、无留出验证集。
`weighted_total` 只作内部排序，**不得**写给读者；对读者只报 `band` 与「命中了哪些类别」。
See `docs/RELIABILITY.md`.

## 三类调节阀（由上表归并）

- **先后顺序** ← sequence  
- **有无细则** ← implementing_detail  
- **报刊位置** ← press_placement  

其余类别（话语动词、归因、具体性、范围、语气）同样进入总分，避免只看三阀。
