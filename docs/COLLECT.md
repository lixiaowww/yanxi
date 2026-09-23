# Yanxi — Collect & Subscribe

Fetch SSRF uses GrantWright `urlSafety.safeFetch` (vendored). HTML stripping uses GrantWright `htmlToText`.


Civilian **whitelist** collection → English briefing → outbox + **RSS subscribe**.

## Boundaries

- Only hosts in `config/sources.whitelist.json` may be fetched (SSRF checks, no redirects, no private IPs).
- Default demo source is **local** `examples/sample-input.json` (no network).
- Live URL entries ship `enabled: false` — turn on deliberately.
- Not mass social scraping; not login-wall bypass; not personal targeting. See `docs/ETHICS.md`.
- Twitter / 大 V / 网传：**不要**加入 whitelist；仅用户粘贴 + `source_class=social_commentary` 降权。见 `docs/RELIABILITY.md`。

## Configure

1. **Sources** — `config/sources.whitelist.json`  
2. **Subscriptions** — `config/subscriptions.json` (keywords, sourceIds, cron hint, delivery)

New local fixtures under `examples/domains/` show up in the UI picker automatically (the directory is
globbed by `listDomainFixtures`), but they must also be added to `config/sources.whitelist.json` to be
usable as a subscription `sourceId` or to appear in `GET /api/sources`. Hot-topic fixtures are
registered as `domain-hot-taiwan-strait`, `domain-hot-electric-vehicles`, and `domain-hot-china-ai`,
and are included in the `job-fit-domain-battery` and `desk-by-section` subscriptions.

Delivery channels:

| Channel | Behavior |
|---------|----------|
| `outbox` | Write `outbox/briefs/*.json` + `.md` |
| `rss` | Rebuild `outbox/feeds/<id>.xml` · served at `/feeds/<id>.xml` |
| `webhook` | POST summary to `SUBSCRIBE_WEBHOOK_URL` if set |

## Run

```bash
# one-shot (uses active subscriptions)
npm run collect

# interval daemon (default every 60 minutes)
COLLECT_INTERVAL_MINUTES=60 npm run collect:daemon

# system cron example (Mondays 09:00)
0 9 * * 1 cd /path/to/yanxi && npm run collect >> /tmp/yanxi-collect.log 2>&1
```

## Production trigger (Render free tier)

Render's free web service has **no scheduler and no persistent disk** (`docs/DEPLOY.md`) --
`collect-daemon.ts`/`collect:daemon` is not started by `render.yaml` (it only runs `npm start`),
so nothing calls `POST /api/collect/run` on its own. `.github/workflows/collect-cron.yml` closes
that gap: a GitHub Actions schedule (`0 12 * * 1-5` UTC, ~weekday mornings) POSTs to the deployed
site's already-open `/api/collect/run` (`subscriptionId: "public-live-collect"`, the 3 real
`chinanews.com.cn` RSS feeds). Configure the target with the repo variable `YANXI_BASE_URL`
(Settings → Secrets and variables → Actions → Variables); defaults to
`https://yanxi-dwrf.onrender.com` if unset. This does **not** make outbox content persistent --
a Render restart or sleep/wake still clears `outbox/briefs` — it only keeps the Reader populated
between those resets. Trigger manually anytime via the workflow's "Run workflow" button.

While `npm run dev` is up:

- `GET /api/subscriptions` — list + feed URLs  
- `POST /api/collect/run` — trigger (open on public demo; IP rate-limited)  
- `GET /feeds/macro-public-digest.xml` — RSS for readers  
- UI “Subscriptions” panel — Run collect / open RSS  

## Env

```bash
# PUBLIC_BASE_URL=http://localhost:5179
# COLLECT_INTERVAL_MINUTES=60
# SUBSCRIBE_WEBHOOK_URL=  # optional JSON webhook
```
