import { collectForSubscription, type CollectedItem } from "./public-fetch.js";
import { getActiveSubscriptions, type Subscription } from "./subscriptions.js";
import { runBriefingPipeline } from "./pipeline.js";
import {
  deliverWebhook,
  listOutboxBriefs,
  writeOutboxBrief,
  writeRssFeed,
  type OutboxRecord,
} from "./outbox.js";

export type CollectRunResult = {
  subscriptionId: string;
  collected: number;
  written: OutboxRecord[];
  feedPath?: string;
  errors: string[];
  mergeMode: "per-item" | "combined";
};

async function briefAndStore(
  subscription: Subscription,
  item: CollectedItem,
  sources: { label: string; text: string }[] | undefined,
  root: string,
  errors: string[],
  written: OutboxRecord[]
) {
  try {
    const result = await runBriefingPipeline(
      sources && sources.length > 1
        ? { sources, forceOffline: subscription.forceOffline !== false }
        : {
            sourceText: item.sourceText,
            sourceLabel: item.label,
            forceOffline: subscription.forceOffline !== false,
          }
    );
    const rec = writeOutboxBrief(subscription, item, result, root);
    written.push(rec);
    if (subscription.delivery.includes("webhook")) {
      try {
        await deliverWebhook(rec);
      } catch (e) {
        errors.push(`webhook: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`${item.sourceId}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function runSubscriptionCollect(
  subscription: Subscription,
  opts?: { root?: string; publicBaseUrl?: string }
): Promise<CollectRunResult> {
  const root = opts?.root || process.cwd();
  const publicBaseUrl = opts?.publicBaseUrl || process.env.PUBLIC_BASE_URL || "http://localhost:5179";
  const errors: string[] = [];
  const written: OutboxRecord[] = [];
  const mergeMode = subscription.mergeMode || "combined";

  const items = await collectForSubscription(
    subscription.sourceIds,
    subscription.keywords || [],
    subscription.maxItemsPerRun ?? 3,
    root
  );

  if (mergeMode === "combined" && items.length > 0) {
    const merged: CollectedItem = {
      sourceId: items.map((i) => i.sourceId).join("+"),
      label: items.map((i) => i.label).join(" + "),
      sourceText: items.map((i) => `【${i.label}】\n${i.sourceText}`).join("\n\n"),
      collectedAt: new Date().toISOString(),
      url: items.find((i) => i.url)?.url,
    };
    await briefAndStore(
      subscription,
      merged,
      items.map((i) => ({ label: i.label, text: i.sourceText })),
      root,
      errors,
      written
    );
  } else {
    for (const item of items) {
      await briefAndStore(subscription, item, undefined, root, errors, written);
    }
  }

  let feedPath: string | undefined;
  if (subscription.delivery.includes("rss") || subscription.delivery.includes("outbox")) {
    const all = listOutboxBriefs(subscription.id, root);
    feedPath = writeRssFeed(subscription, all, publicBaseUrl, root);
  }

  return {
    subscriptionId: subscription.id,
    collected: items.length,
    written,
    feedPath,
    errors,
    mergeMode,
  };
}

export async function runAllActiveSubscriptions(opts?: {
  root?: string;
  publicBaseUrl?: string;
  onlyId?: string;
}): Promise<CollectRunResult[]> {
  const subs = getActiveSubscriptions(opts?.root).filter((s) =>
    opts?.onlyId ? s.id === opts.onlyId : true
  );
  const results: CollectRunResult[] = [];
  for (const s of subs) {
    results.push(await runSubscriptionCollect(s, opts));
  }
  return results;
}
