# 分栏目简报桌面（Briefing desk）

民用研究输出按固定五栏归档，便于人审与 portfolio 展示。  
**不是**机关值班台 / 情报 desk 仿制。

## 五栏

| id | 中文 | 内容 |
|----|------|------|
| `overall_goals` | 总体目标 | 中央会议、规划、高质量发展等方向语 |
| `economy_investment` | 经济投资 | 财政货币、产业投资、地方债/房地产、专项资金 |
| `foreign_affairs` | 外交 | 外交话语、双边、一带一路、中加等 |
| `defense_public` | 国防（公开表述） | 国防部例行、强军、军工公开语；非作战情报 |
| `social_governance` | 社会治理 | 民生、基层、舆情、党建教育、三农 |

## 用法

```bash
npm run test:desk            # 分栏简报 + 印证看板
npm run test:corroboration   # 同 test:desk（强调印证报告输出）
```

报告：
- `outbox/test-reports/desk-briefings-*.md` — 全量（简报正文 + 印证）
- `outbox/test-reports/corroboration-*.md` / `corroboration-latest.md` — **印证专用**

### 印证报告回答三问

1. 本栏**有什么源**（角色：方向/细则/外交…）  
2. **缺什么**才能抬 corr  
3. 若可配对，**合并后印证是否上升**（实测）

## 代码

- `src/lib/briefing-desk.ts` — taxonomy + 路由  
- `src/lib/corroboration-report.ts` — 栏内印证看板  
- `scripts/desk-briefings.ts` — 分栏 + 印证报告  
- 订阅 `desk-by-section`（`mergeMode: per-item`）按条出简报  
