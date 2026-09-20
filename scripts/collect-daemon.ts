import "dotenv/config";
import { runAllActiveSubscriptions } from "../src/lib/collector.js";

const intervalMin = Number(process.env.COLLECT_INTERVAL_MINUTES || 60);
const ms = Math.max(5, intervalMin) * 60_000;

console.log(
  `yanxi collect daemon — every ${Math.max(5, intervalMin)} min · public whitelist only · Ctrl+C to stop`
);

async function tick() {
  const started = new Date().toISOString();
  console.log(`[${started}] collect run…`);
  try {
    const results = await runAllActiveSubscriptions();
    for (const r of results) {
      console.log(
        `  ${r.subscriptionId}: collected=${r.collected} written=${r.written.length}` +
          (r.errors.length ? ` errors=${r.errors.join("; ")}` : "")
      );
    }
  } catch (e) {
    console.error("collect failed:", e);
  }
}

await tick();
setInterval(tick, ms);
