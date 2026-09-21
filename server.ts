import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { runBriefingPipeline } from "./src/lib/pipeline.js";
import { loadSubscriptions } from "./src/lib/subscriptions.js";
import { runAllActiveSubscriptions } from "./src/lib/collector.js";
import { listOutboxBriefs } from "./src/lib/outbox.js";
import { loadWhitelistPublic } from "./src/lib/public-fetch.js";
import { listDomainFixtures } from "./src/lib/domains.js";
import { DESK_CATALOG, HOT_THEME_CATALOG, assignDeskSection } from "./src/lib/briefing-desk.js";
import { llmConfigured } from "./src/lib/llm.js";
import {
  clientKey,
  createFixedWindowLimiter,
  httpError,
  readFileInsideDir,
  requireApiToken,
  trustProxyHops,
  type HttpErrorLike,
} from "./src/lib/api-guard.js";

const PORT = Number(process.env.PORT || 5179);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

/** Request body cap — pastes are excerpts, not whole corpora. */
const JSON_BODY_LIMIT = process.env.BRIEF_BODY_LIMIT || "128kb";
/** Total characters accepted across sourceText + sources[] before we refuse. */
const MAX_SOURCE_CHARS = Number(process.env.BRIEF_MAX_SOURCE_CHARS || 24000);

const briefLimiter = createFixedWindowLimiter({
  windowMs: Number(process.env.BRIEF_RATE_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.BRIEF_RATE_MAX || 20),
});
const collectLimiter = createFixedWindowLimiter({
  windowMs: Number(process.env.BRIEF_RATE_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.COLLECT_RATE_MAX || 6),
});

function enforceRateLimit(
  req: express.Request,
  limiter: ReturnType<typeof createFixedWindowLimiter>,
  action: string
): void {
  const decision = limiter.check(clientKey(req));
  if (!decision.allowed) {
    throw httpError(
      429,
      `Rate limit reached for ${action}. Try again in ${decision.retryAfterSeconds}s.`,
      decision.retryAfterSeconds
    );
  }
}

function sendApiError(res: express.Response, e: unknown, fallbackStatus = 400): void {
  const err = e as Partial<HttpErrorLike>;
  const status = err?.status || fallbackStatus;
  if (err?.retryAfterSeconds) res.setHeader("Retry-After", String(err.retryAfterSeconds));
  res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
}

/** Total paste size across both request shapes, without copying the text. */
function countSourceChars(body: unknown): number {
  const b = (body || {}) as { sourceText?: unknown; sources?: unknown };
  let total = typeof b.sourceText === "string" ? b.sourceText.length : 0;
  if (Array.isArray(b.sources)) {
    for (const s of b.sources) {
      const text = (s as { text?: unknown })?.text;
      if (typeof text === "string") total += text.length;
    }
  }
  return total;
}

async function main() {
  const app = express();
  // Render puts one proxy hop in front of the app; locally there is none.
  app.set("trust proxy", trustProxyHops());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Body-parser rejections (oversized / malformed JSON) must read as clear
  // English JSON, not an HTML stack trace.
  app.use((err: Error & { type?: string; status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!err) {
      next();
      return;
    }
    if (err.type === "entity.too.large") {
      res.status(413).json({
        error: `Request body too large (limit ${JSON_BODY_LIMIT}). Paste a shorter public excerpt.`,
      });
      return;
    }
    if (err.type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body is not valid JSON." });
      return;
    }
    next(err);
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      product: "yanxi",
      framing: "civilian-open-source-research",
      llm: Boolean(process.env.LLM_API_KEY),
      cursorHarness: Boolean(process.env.CURSOR_API_KEY),
      // Booleans only — never echo credential or token values.
      llmRunsNeedToken: llmConfigured(),
      briefTokenConfigured: Boolean(process.env.BRIEF_API_TOKEN || process.env.COLLECT_API_TOKEN),
      collect: true,
      subscriptions: loadSubscriptions().subscriptions.filter((s) => s.active !== false).length,
    });
  });

  app.get("/api/domains", (_req, res) => {
    res.json({
      framing: "civilian-job-fit-domain-fixtures",
      deskSections: DESK_CATALOG.map((s) => ({ id: s.id, label_en: s.label_en })),
      hotThemeCatalog: HOT_THEME_CATALOG.map((t) => ({ id: t.id, label_en: t.label_en })),
      domains: listDomainFixtures().map((d) => {
        const desk = assignDeskSection(d.sourceText);
        return {
          id: d.id,
          domain: d.domain,
          sourceLabel: d.sourceLabel,
          preview: d.sourceText.slice(0, 80) + (d.sourceText.length > 80 ? "…" : ""),
          chars: d.sourceText.length,
          file: d.file,
          deskPrimary: desk.primary,
          deskLabel: desk.label_en,
          hotThemes: desk.hot_themes.map((h) => ({ id: h.id, label_en: h.label_en })),
        };
      }),
    });
  });

  app.get("/api/domains/:id", (req, res) => {
    const hit = listDomainFixtures().find((d) => d.id === req.params.id);
    if (!hit) {
      res.status(404).json({ error: "domain fixture not found" });
      return;
    }
    res.json(hit);
  });

  app.get("/api/portfolio", (_req, res) => {
    const full = path.join(process.cwd(), "outbox", "portfolio-data.json");
    if (!fs.existsSync(full)) {
      res.status(404).json({
        error: "portfolio-data.json missing — run npm run portfolio",
      });
      return;
    }
    res.type("application/json").send(fs.readFileSync(full, "utf8"));
  });

  app.get("/outbox/portfolio.md", (_req, res) => {
    const full = path.join(process.cwd(), "outbox", "portfolio.md");
    if (!fs.existsSync(full)) {
      res.status(404).type("text/plain").send("Run npm run portfolio first");
      return;
    }
    res.type("text/markdown; charset=utf-8").send(fs.readFileSync(full, "utf8"));
  });

  app.get("/api/subscriptions", (_req, res) => {
    const file = loadSubscriptions();
    res.json({
      framing: file.framing,
      subscriptions: file.subscriptions.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        scheduleHuman: s.scheduleHuman,
        scheduleCron: s.scheduleCron,
        keywords: s.keywords,
        sourceIds: s.sourceIds,
        delivery: s.delivery,
        active: s.active !== false,
        feedUrl: `${PUBLIC_BASE_URL}/feeds/${s.id}.xml`,
      })),
    });
  });

  app.get("/api/sources", (_req, res) => {
    const wl = loadWhitelistPublic();
    res.json({
      framing: wl.framing,
      allowedHosts: wl.allowedHosts,
      entries: wl.entries.map((e) => ({
        id: e.id,
        type: e.type,
        label: e.label,
        enabled: e.enabled !== false,
        topics: e.topics,
        url: e.type === "url" ? e.url : undefined,
        path: e.type === "local_json" ? e.path : undefined,
      })),
    });
  });

  app.get("/api/outbox", (req, res) => {
    const sub = req.query.subscriptionId ? String(req.query.subscriptionId) : undefined;
    const rows = listOutboxBriefs(sub).map((r) => ({
      id: r.id,
      subscriptionId: r.subscriptionId,
      createdAt: r.createdAt,
      sourceLabel: r.source.label,
      gatePassed: r.result.gate.passed,
      triage: r.result.briefing.info_triage,
      what: r.result.briefing.briefing_en?.what,
      jsonUrl: `/outbox/briefs/${path.basename(r.jsonPath)}`,
      mdUrl: `/outbox/briefs/${path.basename(r.markdownPath)}`,
    }));
    res.json({ briefs: rows });
  });

  app.post("/api/collect/run", async (req, res) => {
    try {
      enforceRateLimit(req, collectLimiter, "collect runs");
      requireApiToken(req, { envVar: "COLLECT_API_TOKEN", action: "collect runs" });
      const onlyId = req.body?.subscriptionId ? String(req.body.subscriptionId) : undefined;
      const results = await runAllActiveSubscriptions({
        onlyId,
        publicBaseUrl: PUBLIC_BASE_URL,
      });
      res.json({ ok: true, results });
    } catch (e) {
      sendApiError(res, e);
    }
  });

  app.post("/api/brief", async (req, res) => {
    try {
      // Every call is throttled per client IP, offline or not: the free
      // instance itself is a shared resource.
      enforceRateLimit(req, briefLimiter, "briefing runs");

      const chars = countSourceChars(req.body);
      if (chars > MAX_SOURCE_CHARS) {
        throw httpError(
          413,
          `Source text too long (${chars} characters, limit ${MAX_SOURCE_CHARS}). Paste a shorter public excerpt.`
        );
      }

      const forceOffline = Boolean(req.body?.forceOffline);
      // Only the LLM-backed path spends the operator's quota; the template
      // engine stays open so the public demo keeps working.
      if (!forceOffline && llmConfigured()) {
        try {
          requireApiToken(req, {
            envVar: "BRIEF_API_TOKEN",
            fallbackEnvVar: "COLLECT_API_TOKEN",
            action: "LLM-backed briefing runs",
          });
        } catch (e) {
          const err = e as HttpErrorLike;
          err.message = `${err.message} The offline template path stays open — resend with "forceOffline": true.`;
          throw err;
        }
      }

      const result = await runBriefingPipeline({
        sourceText: String(req.body?.sourceText || ""),
        sourceLabel: req.body?.sourceLabel ? String(req.body.sourceLabel) : undefined,
        sources: Array.isArray(req.body?.sources)
          ? req.body.sources.map((s: { label?: string; text?: string }) => ({
              label: String(s?.label || "source"),
              text: String(s?.text || ""),
            }))
          : undefined,
        forceOffline,
        sourceClass: req.body?.sourceClass
          ? (String(req.body.sourceClass) as
              | "official_or_wire"
              | "policy_instrument"
              | "press_commentary"
              | "social_commentary"
              | "unknown_public")
          : undefined,
      });
      res.json(result);
    } catch (e) {
      sendApiError(res, e);
    }
  });

  app.get("/feeds/:id.xml", (req, res) => {
    // `:id` arrives percent-decoded, so `..%2F` would otherwise escape outbox/.
    const body = readFileInsideDir(
      path.join(process.cwd(), "outbox", "feeds"),
      `${req.params.id}.xml`
    );
    if (body === null) {
      res.status(404).type("text/plain").send("Feed not found — run npm run collect first");
      return;
    }
    res.type("application/rss+xml").send(body);
  });

  app.get("/outbox/briefs/:file", (req, res) => {
    const name = path.basename(req.params.file);
    if (!/^[\w.-]+\.(json|md)$/.test(name)) {
      res.status(400).send("bad filename");
      return;
    }
    const body = readFileInsideDir(path.join(process.cwd(), "outbox", "briefs"), name);
    if (body === null) {
      res.status(404).send("not found");
      return;
    }
    if (name.endsWith(".json")) res.type("application/json");
    else res.type("text/markdown; charset=utf-8");
    res.send(body);
  });

  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist, { index: false }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/feeds/") || req.path.startsWith("/outbox/")) {
        next();
        return;
      }
      res.sendFile(path.join(dist, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  } else {
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
          fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8")
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`yanxi → http://localhost:${PORT} (${isProd ? "production" : "dev"})`);
    console.log(`portfolio → http://localhost:${PORT}/portfolio`);
    console.log(`subscriptions → http://localhost:${PORT}/api/subscriptions`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
