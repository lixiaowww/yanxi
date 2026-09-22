# Portfolio 一页

面试 / 自用叙事页：**不是**情报看板。

## 生成

```bash
npm run showcase        # 可选（较少跑）：用真实 LLM 刷新 examples/showcase/ 固化样例
npm run test:regress    # 可选：先刷绿勾数据
npm run portfolio       # 写出 outbox/portfolio-data.json + portfolio.md
npm run dev             # 打开 http://localhost:5179/portfolio
```

`npm run showcase` 打真实 Groq/DeepSeek 网络请求、消耗 API 额度，**不在** `npm run portfolio` / `build:deploy` 里自动重跑——Portfolio 页只读取 `examples/showcase/*.json` 里已固化的产出，访客浏览或每次部署都不会再触发新的 LLM 调用。

## 内容

1. 产品一句话 + 红线（非情报 / 非针对个人）  
2. 方法两支柱：潜规则启发式 + 多源印证  
3. **Showcase（P0-2）**：固化的 complete（双源+日期+LLM）与 deferred（单源无日期无具名主体）各一篇，读者可直接点开完整简报 markdown——不依赖访客现场粘贴，也不消耗当次 API 额度  
4. 五栏摘要（热点 / 经济投资 / 外交 / 国防公开 / 社会治理）— 热点含台海、电动汽车、中国 AI 等  
5. 回归绿勾（`regress-latest.json`）  
6. Civic Ontology Lite 背景卡目录（栏目优先 · 非 OWL）— 见 `docs/ONTOLOGY-LITE.md`  
7. 加国公开政策对照 **可点击 URL**（Justice Laws / GAC / CBSA…）· 非法律意见  
8. **采纳门槛**：无数字/时限/细则/资金（或主体+具名产品）→ 不生成实质简报  
9. **简报质量**：complete 需双源+日期；单源/无日期为 partial；Outlook 为情景四件套（hypothesis）  

设计见 `docs/PRD.md` v0.3 · `docs/DP-brief-quality.md`。
## 文件

| 路径 | 用途 |
|------|------|
| `scripts/build-showcase.ts` | 用真实 LLM 生成/刷新 `examples/showcase/` 固化样例（`npm run showcase`，不进 `npm test`） |
| `examples/showcase/*.{md,json}` | 固化的 complete + deferred 参照简报 |
| `scripts/build-portfolio.ts` | 生成数据（读取 `examples/showcase/`，不重新调用 LLM） |
| `src/Portfolio.tsx` | `/portfolio` UI |
| `outbox/portfolio-data.json` | API `/api/portfolio` |
| `outbox/portfolio.md` | 可分享 Markdown |
