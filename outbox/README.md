# Yanxi outbox

Generated English briefings and RSS feeds from whitelisted public collection.

- `briefs/*.json` + `*.md` — one briefing per item
- `feeds/<subscription-id>.xml` — subscribe in any RSS reader

Regenerate:

```bash
npm run collect
```

Daemon (interval via `COLLECT_INTERVAL_MINUTES`, default 60):

```bash
npm run collect:daemon
```

Or system cron:

```cron
0 9 * * 1 cd /path/to/yanxi && npm run collect >> /tmp/yanxi-collect.log 2>&1
```
