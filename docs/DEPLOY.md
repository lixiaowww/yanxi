# 免费部署上线（Render）

民用演示用 **Render Free Web Service**：HTTPS + `.onrender.com`，无需信用卡（以 Render 当前政策为准）。

## 限制（免费档）

- 约 15 分钟无流量后休眠；唤醒约 1 分钟  
- 磁盘**不持久**：`outbox/briefs` 重启会丢（演示以粘贴简报 + 预生成 portfolio 为主）  
- 生产环境未设 `COLLECT_API_TOKEN` 时，`POST /api/collect/run` **关闭**

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
   - `LLM_API_KEY`：可选；不填则全程 offline  
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
