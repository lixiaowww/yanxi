import "dotenv/config";
import { runAllActiveSubscriptions } from "../src/lib/collector.js";

const onlyId = process.argv.find((a) => a.startsWith("--id="))?.slice(5);

const results = await runAllActiveSubscriptions({ onlyId });
console.log(JSON.stringify(results, null, 2));

const failed = results.some((r) => r.errors.length && !r.written.length);
if (failed) process.exit(1);

const anyWritten = results.some((r) => r.written.length > 0);
if (!anyWritten) {
  console.error("No briefs written — check keywords/sources");
  process.exit(1);
}

console.log("\n✅ collect-and-brief OK");
for (const r of results) {
  console.log(
    `- ${r.subscriptionId}: collected=${r.collected} written=${r.written.length} feed=${r.feedPath || "-"}`
  );
}
