# 免费部署上线（Render）

民用演示用 **Render Free Web Service**：HTTPS + `.onrender.com`，无需信用卡（以 Render 当前政策为准）。

## 限制（免费档）

- 约 15 分钟无流量后休眠；唤醒约 1 分钟  
- 磁盘**不持久**：`outbox/briefs` 重启会丢（演示以粘贴简报 + 预生成 portfolio 为主）  
- `POST /api/brief` 与 `POST /api/collect/run` 在公开演示上**开放**（靠 IP 限流，不要求 access token）

## 公开演示的访问模型

公开站点花的是**运营者自己的 LLM 额度**。产品选择：谁打开网址都能打 LLM / 触发白名单 collect。

| 路径 | 请求 | 是否需要 token |
|------|------|----------------|
| LLM 路径 | `POST /api/brief` 未勾选 force offline，且已配置 `LLM_API_KEY` | 否 — 公开开放 |
| offline / 模板 | `POST /api/brief` 带 `"forceOffline": true`，或未配置 `LLM_API_KEY` | 否 |
| 采集触发 | `POST /api/collect/run` | 否 — 公开开放（仍限流） |

- **速率限制**：所有 `/api/brief` 调用（含 offline）按客户端 IP 限流，默认每 10 分钟 20 次；超限返回 `429` + `Retry-After`。进程内固定窗口计数，映射有上限，无新增运行时依赖。`/api/collect/run` 默认每窗口 6 次。
- **请求体上限**：`express.json` 限 `BRIEF_BODY_LIMIT`（默认 `128kb`），超出返回 `413`；`sourceText` + `sources[]` 合计超过 `BRIEF_MAX_SOURCE_CHARS`（默认 24000 字符）也返回 `413`，不会送进 LLM。
- **代理与真实 IP**：Render 前面只有一跳代理，故 `TRUST_PROXY_HOPS=1`，Express 取 `X-Forwarded-For` 的**最后一跳**，客户端自行伪造的前缀无法绕过限流。
- `/api/health` 仅暴露布尔位（是否配置 LLM），不含任何密钥值。

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
   - 可选：`BRIEF_RATE_MAX` / `BRIEF_RATE_WINDOW_MS` / `COLLECT_RATE_MAX` / `TRUST_PROXY_HOPS`  
   - 可选 LLM（不填则全程 offline；填了则**任何人**可走 LLM，靠限流挡滥用）：  
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
