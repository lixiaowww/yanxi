import { collectForSubscription, type CollectedItem } from "./public-fetch.js";
import { getActiveSubscriptions, type Subscription } from "./subscriptions.js";
import { runBriefingPipeline } from "./pipeline.js";
import { jevGateCheck, type JevGateResult } from "./jev-gate.js";
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
  /** Items Jev gated out before the full pipeline ran — see gateItems below. */
  gatedOut?: string[];
};

/** A collected item that has passed (or skipped, if unconfigured) the Jev gate. */
type GatedItem = CollectedItem & { jevGate?: JevGateResult };

/**
 * Stage 2 of docs/DP-V3.md's five-stage pipeline: run every freshly
 * collected item through Jev's fast triage before the expensive full
 * pipeline sees it. Same fail-open contract as jevGateCheck itself — when
 * Jev is unconfigured or errors, every item is admitted (today's
 * behavior, unchanged). Only a confident "in_scope=false",
 * "language_quality=non_chinese", or "has_concrete_detail=false" (pure
 * party-boilerplate restatement — see docs/DP-V3.md §7 revision note)
 * drops an item; anything uncertain is admitted rather than silently lost.
 */
async function gateItems(
  items: CollectedItem[]
): Promise<{ admitted: GatedItem[]; gatedOut: string[] }> {
  const admitted: GatedItem[] = [];
  const gatedOut: string[] = [];
  for (const item of items) {
    const gate = await jevGateCheck({ text: item.sourceText, label: item.label, sourceUrl: item.url });
    if (!gate) {
      // Unconfigured or Jev call failed — fail open, admit to the full pipeline.
      admitted.push(item);
      continue;
    }
    if (!gate.in_scope || gate.language_quality === "non_chinese") {
      gatedOut.push(`${item.sourceId}: jev gated out (in_scope=${gate.in_scope}, language_quality=${gate.language_quality})`);
      continue;
    }
    if (!gate.has_concrete_detail) {
      gatedOut.push(`${item.sourceId}: jev gated out (has_concrete_detail=false — party boilerplate, no checkable detail)`);
      continue;
    }
    admitted.push({ ...item, jevGate: gate });
  }
  return { admitted, gatedOut };
}

async function briefAndStore(
  subscription: Subscription,
  item: GatedItem,
  sources: { label: string; text: string; channelTier?: CollectedItem["tier"] }[] | undefined,
  root: string,
  errors: string[],
  written: OutboxRecord[]
) {
  try {
    const result = await runBriefingPipeline(
      sources && sources.length > 1
        ? {
            sources,
            forceOffline: subscription.forceOffline !== false,
            collectedAt: item.collectedAt,
          }
        : {
            sourceText: item.sourceText,
            sourceLabel: item.label,
            sourceUrl: item.url,
            sourceChannelTier: item.tier,
            forceOffline: subscription.forceOffline !== false,
            collectedAt: item.collectedAt,
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

  const rawItems = await collectForSubscription(
    subscription.sourceIds,
    subscription.keywords || [],
    subscription.maxItemsPerRun ?? 3,
    root
  );

  // Stage 2 (docs/DP-V3.md): fast-triage every freshly collected item
  // before the expensive full pipeline sees it. No-op when Jev isn't
  // configured — every item is admitted, same as before this stage existed.
  const { admitted: items, gatedOut } = await gateItems(rawItems);

  if (mergeMode === "combined" && items.length > 0) {
    const merged: GatedItem = {
      sourceId: items.map((i) => i.sourceId).join("+"),
      label: items.map((i) => i.label).join(" + "),
      sourceText: items.map((i) => `【${i.label}】\n${i.sourceText}`).join("\n\n"),
      collectedAt: new Date().toISOString(),
      url: items.find((i) => i.url)?.url,
    };
    await briefAndStore(
      subscription,
      merged,
      items.map((i) => ({ label: i.label, text: i.sourceText, channelTier: i.tier })),
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
    collected: rawItems.length,
    written,
    feedPath,
    errors,
    mergeMode,
    gatedOut: gatedOut.length ? gatedOut : undefined,
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
