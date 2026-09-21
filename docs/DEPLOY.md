# 免费部署上线（Render）

民用演示用 **Render Free Web Service**：HTTPS + `.onrender.com`，无需信用卡（以 Render 当前政策为准）。

## 限制（免费档）

- 约 15 分钟无流量后休眠；唤醒约 1 分钟  
- 磁盘**不持久**：`outbox/briefs` 重启会丢（演示以粘贴简报 + 预生成 portfolio 为主）  
- 生产环境未设 `COLLECT_API_TOKEN` 时，`POST /api/collect/run` **关闭**
- 生产环境未设 `BRIEF_API_TOKEN` 时，`POST /api/brief` 的 **LLM 路径关闭**（offline 模板路径仍开放）

## 公开演示的访问模型

公开站点花的是**运营者自己的 LLM 额度**，因此两条路径待遇不同：

| 路径 | 请求 | 是否需要 token |
|------|------|----------------|
| offline / 模板 | `POST /api/brief` 带 `"forceOffline": true`，或未配置 `LLM_API_KEY` | 否 — 公开演示照常可用 |
| LLM 路径 | `POST /api/brief` 未勾选 force offline，且已配置 `LLM_API_KEY` | 是 — `x-yanxi-token`（或 `?token=`），与 `/api/collect/run` 同一约定 |

- **速率限制**：所有 `/api/brief` 调用（含 offline）按客户端 IP 限流，默认每 10 分钟 20 次；超限返回 `429` + `Retry-After`。进程内固定窗口计数，映射有上限，无新增运行时依赖。`/api/collect/run` 默认每窗口 6 次，用于防止 token 猜测。
- **请求体上限**：`express.json` 限 `BRIEF_BODY_LIMIT`（默认 `128kb`），超出返回 `413`；`sourceText` + `sources[]` 合计超过 `BRIEF_MAX_SOURCE_CHARS`（默认 24000 字符）也返回 `413`，不会送进 LLM。
- **代理与真实 IP**：Render 前面只有一跳代理，故 `TRUST_PROXY_HOPS=1`，Express 取 `X-Forwarded-For` 的**最后一跳**，客户端自行伪造的前缀无法绕过限流。
- **本地开发无摩擦**：`npm run dev`（`NODE_ENV` 非 production）时未设 `BRIEF_API_TOKEN` 即不检查 token；只有生产环境才 fail-safe 拒绝。
- token 只比对 env 值，**不回显**；`/api/health` 仅暴露布尔位（是否配置），不含任何密钥值。

## 一键步骤

1. 将本仓推到 GitHub（已有 `origin` → `lixiaowww/yanxi`）。  
2. 打开 [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**，选本仓库；或 **Web Service** 手动填：  
   - **Build:** `npm ci && npm run build:deploy`  
   - **Start:** `npm start`  
   - **Plan:** Free  
   - **Health check:** `/api/health`  
3. 环境变量：  
   - `NODE_ENV=production`（一般自动）  
   - `PUBLIC_BASE_URL=https://<你的服务名>.onrender.com`（部署后填）  
   - `COLLECT_API_TOKEN`：随机长串（Blueprint 可自动生成）  
   - `BRIEF_API_TOKEN`：随机长串（Blueprint 可自动生成）——**LLM 路径的访问 token**；不设则生产环境拒绝 LLM 运行  
   - 可选：`BRIEF_RATE_MAX` / `BRIEF_RATE_WINDOW_MS` / `TRUST_PROXY_HOPS`（`render.yaml` 已给默认值 20 / 600000 / 1）  
   - 可选 LLM（不填则全程 offline）：  
     - `LLM_API_KEY`  
     - `LLM_BASE_URL=https://api.groq.com/openai/v1`  
     - `LLM_MODEL=openai/gpt-oss-20b`  
       （Groq：勿用已下线的 `llama-3.3-70b-versatile`；也可用 `openai/gpt-oss-120b`）  
4. 部署完成后打开：  
   - `https://<name>.onrender.com/` — 简报工作台  
   - `https://<name>.onrender.com/portfolio` — Portfolio  
   - `https://<name>.onrender.com/api/health` — 健康检查  

本地 Blueprint 文件：仓库根目录 [`render.yaml`](../render.yaml)。

## 本地验证生产模式

```bash
npm run build:deploy
npm start
# → http://localhost:5179
```

## 安全提醒

- 仓库内**不得**出现真实 token / 密钥值：`render.yaml` 只声明 `generateValue` / `sync: false`，实际值在 Render 面板。  
- LLM 运行请求带 token 时优先用 `x-yanxi-token` 请求头；`?token=` 仅为本机便利（会进访问日志）。  
- 公开站点不要放真实 `CURSOR_API_KEY`。  
- 白名单 URL 采集默认关闭；公开演示以 fixtures + 粘贴为主。  
- 文案保持民用：非情报产品。

## 其它免费备选

| 平台 | 适合 |
|------|------|
| Render Free | **推荐**：Express 一体服务 |
| Fly.io 免费额度 | 需 Dockerfile / 账号额度 |
| Railway trial | 常需绑卡，非长期免费 |

详见 Render：[Deploy for Free](https://render.com/docs/free)、[Node Express](https://render.com/docs/deploy-node-express-app)。
