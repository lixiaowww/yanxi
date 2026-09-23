# 研析 Yanxi v3 — 架构设计（讨论稿，待确认后落地）

| 字段 | 内容 |
|------|------|
| 状态 | **Design draft** — 供确认，确认后才开始写代码 |
| 触发 | 用户判定 v0.3/v2 的输出"跟之前变化不大"，要求从头设计（不是推翻能用的逻辑，是重新想清楚整体架构） |
| 前提变化 | 输入模型从"用户粘贴"改为"定时抓取"；分析方法论从"自造启发式"改为"有外部依据的潜规则规则集"；置信度从一个混合分改为信源/结论两个独立分；新增 Jev 高吞吐快筛层 |

---

## 0. 核心结论：换的是"形状"，不是全部推倒

v3 相对 v0.3/v2 是**流水线形状**的改变——从"用户粘贴一段 → 立刻跑全套分析"，变成"定时抓取一批 → 快筛 → 只对值得看的跑全套分析"。这个形状变化是真实的、值得做的。但 v0.3 里被反复验证过的分析逻辑（claim gate、substance_cut、offline/LLM 双引擎、context cards、temporal、corroboration）本身没有问题，会作为 v3 管线里的一段（Stage 3）继续用，不重写。

真正全新的是：**信源分层白名单、Jev 快筛层、潜规则方法论深化、置信度拆分**——这四块是这次讨论新增的东西，以前没有。

---

## 1. 五段管线

```
Stage 0  信源分层白名单
   ↓
Stage 1  定时抓取（cron）
   ↓
Stage 2  Jev 快筛（新增）——高吞吐、低成本、schema 约束不幻觉
   ↓
Stage 3  全套分析管线（复用 v0.3 绝大部分逻辑 + 潜规则规则集加固）
   ↓
Stage 4  双轨置信度（信源可信度 / 结论置信度，各自独立 low/medium/high）
   ↓
Stage 5  读者视图 + 审计视图（v2 已做的 BriefingNote/AnalystAppendix 继续用）
```

---

## 2. Stage 0 — 信源分层白名单

**现状**：`config/sources.whitelist.json` 是扁平列表，条目之间没有权威度差异。

**v3 改动**：给每个信源条目加分层字段，直接对应这轮研究出来的媒体权威层级：

```json
{
  "id": "peoples-daily",
  "tier": "central_party_organ",       // 见下表
  "channel_type": "official_site",     // official_site | wire | tv | wechat | weibo
  "authority_weight": 1.0,             // 0-1，供 Stage 4 信源可信度打分用
  "url_pattern": "https://www.people.com.cn/*"
}
```

| tier | 说明 | 例子 | authority_weight 参考 |
|------|------|------|----------------------|
| `central_party_organ` | 中央党报，政治排序最高 | 人民日报 | 1.0 |
| `central_wire` | 国务院直属通讯社 | 新华社 | 0.9 |
| `central_broadcast` | 总台/央视，political 权重次于前两者 | CCTV-1新闻联播 | 0.85 |
| `specialized_channel` | 央视专业频道，权威但非政治定调 | CCTV-2财经、CCTV-7国防军事 | 0.6 |
| `ministry_official` | 部委官网/官方账号 | 国务院客户端、各部委官网 | 0.8 |
| `cac_licensed_account` | 网信办许可的公众号/自媒体 | 见下 | 0.5 |
| `local_party_organ` | 地方党媒 | 省市党报 | 0.5 |
| `commercial` | 市场化媒体 | — | 0.35 |

**CAC 许可账号名单**：网信办公开维护"获得互联网新闻信息服务许可的公众账号名单"（这轮搜到 662 个账号的官方公示文件）。v3 用这份名单做"未必官方但足够权威"这条标准的**客观依据**，而不是主观判断——白名单扩容时优先从这份名单里选，而不是凭感觉挑公众号。

**边界不变**：`urlSafety.safeFetch`、SSRF 防护、逐个域名授权，这些 v0.3 已经做对的东西继续用，不因为要"扩容"就放松。`docs/ETHICS.md` 的"不做大规模无差别抓取"红线不动——扩的是白名单条目数量和刷新频率，不是变成一个发现型爬虫。

---

## 3. Stage 2 — Jev 快筛层（全新）

**为什么需要**：定时抓取意味着候选文档量会远超"用户手动粘贴"的量级。现在的做法是每条都跑全套（substance_cut + claim gate + 可选 LLM），成本和延迟都撑不住批量场景。

**Jev 的特性刚好匹配**（来自 typesafe.ai 的公开资料）：70-500ms 响应、schema 约束输出不会幻觉、input $0.042/M token、output 免费。这是"高基数决策空间下的快速分类"场景的原装设计目标。

**v3 里 Jev 的职责**——一次调用，schema 大致如下：

```ts
type JevTriage = {
  worth_full_analysis: boolean;
  primary_kind: "macro_policy" | "implementing_instrument" | "foreign_affairs" | ...; // 复用现有 info_triage 分类
  priority_hint: "P1" | "P2" | "P3" | "P4";
  hard_detail_hint: boolean;   // 粗筛是否可能有硬细节，供 Stage 3 复核
  desk_hint: DeskSectionId;
};
```

只有 `worth_full_analysis=true` 的文档进入 Stage 3。这一步**不替代**现有的 `intake`（first_cut 硬细节扫描 + local_gray 二次判断）——现有 intake 逻辑在 Stage 3 里原样保留，作为"精筛"。Jev 是"粗筛"，两层各司其职：Jev 决定"值不值得花钱跑全套"，intake 决定"跑完全套之后这篇算 admit/defer/reject"。

**现有 Jev 集成收窄的地方要放开**：`docs/DP-brief-quality.md` 现在把 Jev 限定成"只做 intake 灰区二次判断，从不写正文、不越权门禁"——这条红线（不写正文、不越权门禁）继续保留，但"只用于灰区"这条要改成"用于 Stage 2 全量粗筛"。

---

## 4. Stage 3 — 全套分析管线（复用 + 潜规则加固）

**复用不变**：`pipeline.ts` 的整体编排、`substance_cut`、claim gate、offline/LLM 双引擎、`temporal`、`corroboration`、`canada_nexus`、这轮新加的 headline 生成/情景数按料缩放/URL 引证——这些逻辑都留着，只是现在跑在"通过 Jev 粗筛的文档"上，不是"用户粘贴的任意文本"上。

**潜规则加固**（这轮两批研究的落地点）——扩充 `signaling_scorecard`（现有 17 条启发式）：

| 新增维度 | 依据 | 落地方式 |
|---|---|---|
| 笔名权威阶梯 | 任仲平/宣言/钟声/国纪平/金观平 | 新 context card + `press_placement` 类目下加一条规则 |
| 外交措辞升级阶梯 | 关切→严重关切→谴责→强烈抗议 | 新 context card（外交类稿件专用） |
| 会谈成果委婉语阶梯 | 交换意见→坦率交谈→建设性对话 | 同上 |
| 协议排序（人名先后） | Politburo 协议序位 | 新规则：同一批人名两次通稿排序变化 → 标记 hypothesis 信号 |
| 媒体层级交叉印证 | 央媒/地方党媒/商业媒体口径差异 | `corroboration` 加一个维度：不只看"是否一致"，也看"发布层级差异" |
| 弱化/强化措辞轴 | "个别/极少数" vs "坚决维护/严厉打击" | 扩充现有 `verb-hierarchy-cues` 规则，加一个新轴 |
| "亲自"三件套 | 亲自谋划/亲自部署/亲自推动 | 新规则：命中即标记"个人化领导信号"，注明来源 Asia Society 方法论 |
| 缺席即信号 | 长期沉默后简短通报 | **需要时间序列基线，Stage 1 定时抓取之后才有意义**，v0.3 粘贴模式做不了，v3 有条件做 |

每条新规则的 `sources:` 字段要写清楚这轮研究出的引用（Hoover CLM、China Media Project、Asia Society、CAC 公示文件等），不再是"作者自己的经验总结"——这也是回应"分析要有成熟方法论"这条要求。

---

## 5. Stage 4 — 双轨置信度

**现状**：`confidence_factors` 一个混合分，把信源层级、substance 厚度、印证度、provenance 全部拧成一个 low/medium/high。

**v3 拆成两个独立字段**：

```ts
type DualConfidence = {
  source_credibility: {
    level: "low" | "medium" | "high";
    basis_en: string;     // 主要由 Stage 0 的 authority_weight + provenance 决定
  };
  analysis_confidence: {
    level: "low" | "medium" | "high";
    basis_en: string;     // 主要由 substance_cut 厚度 + signaling_scorecard band + 跨源印证 决定
  };
};
```

两个独立展示，不再合并成一个数字——这样"信源很权威但细节很薄"和"信源一般但细节扎实"这两种截然不同的情况不会被一个混合分抹平。继续保持"这不是概率"的立场（`docs/RELIABILITY.md` 的既有红线不动）。

---

## 6. 数据模型变化一览

| 改动 | 破坏性 | 说明 |
|---|---|---|
| `sources.whitelist.json` 加 tier/channel_type/authority_weight | 无破坏性，新字段 | 旧条目缺省按 `commercial` 处理 |
| 新增 Jev 快筛阶段 | 新增管线步骤，不改现有 pipeline.ts 核心逻辑 | 现有 paste 单条流程可以跳过 Stage 0-2，直接进 Stage 3（保留手动粘贴能力，不是砍掉） |
| `signaling_scorecard` 新规则 | 增量新增，旧规则不删 | 权重需要重新分配，17 条变成更多条后每条权重会降 |
| `confidence_factors` → `DualConfidence` | **破坏性**——字段结构变了 | 客户端类型、markdown 导出、Portfolio 展示都要跟着改；这是 v3 里真正的 breaking change |

---

## 7. 开放问题——已确认

1. **Jev schema**：收窄到纯粹"值不值得往下送"的粗筛，不做 desk 分类（那是 `assignDeskSection` 的活，不重复）：
   ```ts
   type JevGate = {
     in_scope: boolean;                                   // 是不是中国政策/治理/经济/外交相关
     language_quality: "clean" | "garbled" | "non_chinese";
     priority_hint: "P1" | "P2" | "P3" | "P4";
   };
   ```
   `extractFacts`/`intake.first_cut`（现有免费正则硬细节扫描）不动，不用 Jev 重做。

   **2026-09-22 修订**：用户明确要求 Reader 的信息流是"瀑布流，尽可能多聚集信息源"——这改变了前提：起初"小规模验证"假设下，`intake.first_cut` 在 Stage 3 全套管线里筛掉薄稿子已经够用，因为候选量不大。现在要多源聚合、走瀑布流，薄稿子（党八股、无具体细节的通稿）会在 Stage 2 之前就该被筛掉，不该等它们都跑完全套分析、写进 outbox 之后才在 Reader 端隐藏——那样浪费全套分析的成本，且 outbox 里会堆积大量"defer 但仍可见"的空话稿子稀释真正有内容的简报。因此 `JevGate` 加回一个粗粒度的布尔字段：
   ```ts
   type JevGate = {
     in_scope: boolean;
     language_quality: "clean" | "garbled" | "non_chinese";
     priority_hint: "P1" | "P2" | "P3" | "P4";
     has_concrete_detail: boolean;   // false = 纯党八股/无新增可核实细节
   };
   ```
   与 `extractFacts`/`intake.first_cut` 的分工仍然不同——那两个做的是"抽取出哪些具体 nugget"这种结构化工作，`has_concrete_detail` 只回答一个粗粒度是非题（有没有任意一条可核实细节），成本和延迟都在 Jev 的设计场景内。命中 `false` 的条目在 `collector.ts` 的 `gateItems()` 里直接被筛掉，不进入 Stage 3，也就不会出现在 outbox / Reader 瀑布流里。见 `src/lib/jev-gate.ts`、`src/lib/collector.ts`、`npm run test:jev-gate`。

2. **起步信源规模**：先小规模验证全链路——`www.gov.cn` + `www.xinhuanet.com`/`news.cn`（已在白名单）+ 商务部/发改委官网 2 个，共 5-8 个源。**央视频道文字内容（cctv.com/news.cctv.cn 图文报道）可以直接抓，频道广播本身的语音转文字这轮搁置**。微信公众号技术上不好直接抓（反爬+URL 不规律），优先靠 gov.cn 等网页镜像间接覆盖，不直接爬 mp.weixin.qq.com。

3. **协议排序规则粒度**：先上粗规则——同一批人名两次可比通稿里排序变了就标记 hypothesis，交人审，不编造"变化多大算信号"的数值阈值。后续有真实案例积累了再细化。

4. **`analysis_confidence` 公式**：复用现有 `confidence_factors` 公式，不重新设计。只把其中 `source_class`/`source_tier` 两项输入移出去，单独喂给 `source_credibility`；剩下 signaling_band/substance_band/corroboration 三项留在 `analysis_confidence` 里，权重不变。

---

## 8. 实现任务清单（按依赖顺序）

| # | 任务 | 涉及文件 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | `sources.whitelist.json` 加 tier/channel_type/authority_weight 字段 + 5-8 个起步源 | `config/sources.whitelist.json`、新 `src/lib/source-channel-tier.ts`、`src/lib/public-fetch.ts`、`server.ts` `/api/sources` | 无 | ✅ 完成。17 条既有 fixture 全部打了 tier；新增 4 条真实域名（mofcom/ndrc/cctv财经/cctv7），`enabled: false`；`npm run collect` 验证过端到端不受影响 |
| 2 | `confidence_factors` 拆分为 `source_credibility` + `analysis_confidence` | `src/lib/confidence.ts`（核心拆分）、`src/lib/gate.ts`、`src/lib/pipeline.ts`、`src/lib/briefing-types.ts`、`src/lib/score-bands.ts`、`src/components/*.tsx`、`src/lib/brief-markdown.ts`、`scripts/build-portfolio.ts`/`desk-briefings.ts`/`test-regress.ts` | 无 | ✅ 完成。公式按约定拆桶不重设计；`source_credibility` 现在会用 #1 的 channel tier（取多源中最弱一环）；`npm test`（17 项）全绿，BLUF 行截图确认"analysis confidence high · source credibility medium"分开显示正常 |
| 3 | 潜规则新规则并入 `signaling_scorecard`（笔名阶梯/外交措辞阶梯/协议排序/弱化-强化轴/"亲自"三件套） | `src/lib/media-heuristics.ts`（6 条新规则 + 1 条加固）、`skills/context-cards/policy-signaling-valves.md` | 无 | ✅ 完成。17→23 条规则，权重靠 `weight_sum` 动态归一化，不用重配旧权重。`seq-leader-title-order` 明确标注"排序变化检测需要历史通稿，本轮不做"，不假装解决了做不到的事。新增 `npm run test:signaling-heuristics-v3` 回归测试（7 条命中 + 7 条不误报 + 权重归一化校验），已进 `npm test` |
| 4 | `corroboration` 加媒体层级交叉印证维度 | `src/lib/confidence.ts`（`channel_tier_spread` 字段 + 计算）、`src/lib/gate.ts`/`src/lib/briefing-types.ts`（类型）、`BriefingNote.tsx`（渲染） | 依赖 #1（已满足） | ✅ 完成。新增字段而非改动既有 `score_0_to_3` 公式——不动已测试通过的评分逻辑。跨层级一致（如部委官网+省级党报都报同一件事）标记为比同层级重复更强的信号；同层级一致也如实标注"还不知道换个层级会不会一样说"。没有任何一方带 tier 信息时字段保持 `undefined`，不编造。新增 `test:channel-tier-corroboration` 回归测试（跨层级/同层级/无信息三种场景），`npm test`（19 项）全绿 |
| 5 | Jev 快筛层（`JevGate` schema + 调用封装） | 新文件 `src/lib/jev-gate.ts`，复用现有 `src/lib/jev.ts` 的 `jevConfigured`/`jevBaseUrl`/`jevModel`/类型 | 无 | ✅ 完成，**2026-09-22 加第四问 `has_concrete_detail`**（见 §7 开放问题 1 修订）。`jevGateCheck()` 四问一次调用（in_scope/language_quality/priority_hint/has_concrete_detail），跟现有 `jevIntakeChoice` 同一份 fail-open 契约——未配置/HTTP 失败/答案格式不对都返回 `null`，从不半成品返回、从不抛异常。刻意不做 desk 分类（`assignDeskSection` 已解决）；`has_concrete_detail` 是粗粒度是非题，不重复 `extractFacts` 的结构化抽取。`test:jev-gate` 新增 boilerplate/no-detail 用例，`npm test`（21 项）全绿 |
| 6 | 定时抓取 Stage 0→1→2 串起来（whitelist → collect → Jev gate → 现有 pipeline） | `src/lib/collector.ts`（`gateItems()` + `briefAndStore` 接线） | 依赖 #1（已满足）、#5（已满足） | ✅ 完成。`runSubscriptionCollect` 现在：抓取→`gateItems()`（Jev 未配置=直接放行，跟今天行为完全一致）→合并/逐条跑现有 pipeline。顺手把 #1 的 channel tier、#4 的 corroboration 跨层级检测真正接通——合并多源时源的 `tier` 会带进 `sources[].channelTier`。**用真实 `npm run collect` 跑通验证**（不是隔离单测）：`macro-public-digest` 订阅合并 Xinhua（central_wire）+ 国办通知（ministry_official）两源后，产出的 outbox brief 里 `corroboration.channel_tier_spread.cross_tier=true`、`source_credibility.factors.channel_tier="ministry_official"`（正确取了较弱一环）——task #1/#2/#4/#6 四块东西现在是真的接在一起工作，不是各自单测通过而已。`npm test`（20 项）+ `npm run collect`（跟改动前输出完全一致，collected=11/2/2/4）都验证过。**2026-09-22 更新**：`gateItems()` 加 `has_concrete_detail=false` 分支，党八股/无细节稿子在 Stage 2 就被筛掉，不再进入 Stage 3、不再进 outbox |
| 7 | "缺席即信号"——时间序列基线检测 | 新文件 `src/lib/absence-signal.ts`、`src/lib/gate.ts`/`briefing-types.ts`（类型）、`pipeline.ts`（接线）、`BriefingNote.tsx`（渲染） | 依赖 #6（已满足） | ✅ 完成——推翻了之前"需要真实抓取历史积累"这个判断（用户指正：原则本身有独立文献依据，不需要用我们自己的数据校准，跟 `media-heuristics.ts` 那 23 条手设权重规则是同一套纪律，不该单独对这条设更高门槛）。`GAP_DAYS_THRESHOLD=14` 是手设编辑先验，明确标注未校准，不是等数据攒够了再定。用真实 pipeline 写入临时 outbox + 注入未来 `now` 模拟真实间隔（不用等真实时间流逝），三种场景全测：命中/无真实间隔不误报/全新主题不误报当"缺席"。真实 `npm run collect` 跑过，`absence_signal` 字段在真实 outbox 上正确计算（19/18 条历史命中，gap_days=0 未误判）。`npm test`（21 项）全绿 |

七项任务全部完成并验证。
