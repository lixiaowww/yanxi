import fs from "fs";
import path from "path";

export type Subscription = {
  id: string;
  title: string;
  description?: string;
  keywords: string[];
  sourceIds: string[];
  scheduleCron?: string;
  scheduleHuman?: string;
  delivery: Array<"outbox" | "rss" | "webhook">;
  forceOffline?: boolean;
  maxItemsPerRun?: number;
  /** per-item: one brief per source; combined: one merged brief (default). */
  mergeMode?: "per-item" | "combined";
  active?: boolean;
};

export type SubscriptionsFile = {
  version: number;
  framing: string;
  subscriptions: Subscription[];
};

export function loadSubscriptions(root = process.cwd()): SubscriptionsFile {
  const p = path.join(root, "config", "subscriptions.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as SubscriptionsFile;
}

export function getActiveSubscriptions(root = process.cwd()): Subscription[] {
  return loadSubscriptions(root).subscriptions.filter((s) => s.active !== false);
}
