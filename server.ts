import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { runBriefingPipeline } from "./src/lib/pipeline.js";

const PORT = Number(process.env.PORT || 5179);

async function main() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      product: "yanxi",
      framing: "civilian-open-source-research",
      llm: Boolean(process.env.LLM_API_KEY),
      cursorHarness: Boolean(process.env.CURSOR_API_KEY),
    });
  });

  app.post("/api/brief", async (req, res) => {
    try {
      const result = await runBriefingPipeline({
        sourceText: String(req.body?.sourceText || ""),
        sourceLabel: req.body?.sourceLabel ? String(req.body.sourceLabel) : undefined,
        forceOffline: Boolean(req.body?.forceOffline),
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const url = req.originalUrl;
      let template = await vite.transformIndexHtml(
        url,
        await import("fs").then((fs) =>
          fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8")
        )
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.listen(PORT, () => {
    console.log(`yanxi → http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
