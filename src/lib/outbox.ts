import fs from "fs";
import path from "path";
import type { BriefResponse } from "./pipeline.js";
import { formatBriefResponseMarkdown } from "./brief-markdown.js";
import type { CollectedItem } from "./public-fetch.js";
import type { Subscription } from "./subscriptions.js";

export type OutboxRecord = {
  id: string;
  subscriptionId: string;
  subscriptionTitle: string;
  createdAt: string;
  source: CollectedItem;
  result: BriefResponse;
  markdownPath: string;
  jsonPath: string;
};

function ensureDir(d: string) {
  fs.mkdirSync(d, { recursive: true });
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

function toMarkdown(rec: Omit<OutboxRecord, "markdownPath" | "jsonPath">): string {
  return formatBriefResponseMarkdown(rec.result, {
    title:
      (rec.result.briefing.canada_nexus?.level === "direct"
        ? "[CA] "
        : rec.result.briefing.canada_nexus?.level === "possible"
          ? "[CA?] "
          : "") + rec.subscriptionTitle,
    id: rec.id,
    createdAt: rec.createdAt,
    sourceLabel: rec.source.label,
    sourceUrl: rec.source.url,
  });
}

export function writeOutboxBrief(
  subscription: Subscription,
  source: CollectedItem,
  result: BriefResponse,
  root = process.cwd()
): OutboxRecord {
  const briefsDir = path.join(root, "outbox", "briefs");
  ensureDir(briefsDir);
  const createdAt = new Date().toISOString();
  const id = `${createdAt.slice(0, 10)}_${slug(subscription.id)}_${slug(source.sourceId)}_${Date.now()
    .toString(36)
    .slice(-4)}`;
  const base = {
    id,
    subscriptionId: subscription.id,
    subscriptionTitle: subscription.title,
    createdAt,
    source,
    result,
  };
  const jsonPath = path.join(briefsDir, `${id}.json`);
  const markdownPath = path.join(briefsDir, `${id}.md`);
  const record: OutboxRecord = { ...base, jsonPath, markdownPath };
  fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2), "utf8");
  fs.writeFileSync(markdownPath, toMarkdown(base), "utf8");
  return record;
}

/** Persist a paste-desk brief (Generate → Save) into outbox/briefs. */
export function writePasteBrief(
  result: BriefResponse,
  source: { label: string; text: string; url?: string },
  root = process.cwd()
): OutboxRecord {
  const pasteSub: Subscription = {
    id: "paste-desk",
    title:
      result.briefing.desk_section?.label_en ||
      result.briefing.content_analysis?.domain_label_en ||
      "Paste briefing",
    description: "Saved from the paste workbench",
    keywords: [],
    sourceIds: [],
    delivery: ["outbox"],
    forceOffline: result.mode === "offline",
    active: true,
  };
  const item: CollectedItem = {
    sourceId: slug(source.label || "paste"),
    label: source.label || "paste",
    sourceText: source.text,
    collectedAt: new Date().toISOString(),
    url: source.url,
  };
  return writeOutboxBrief(pasteSub, item, result, root);
}

export function listOutboxBriefs(subscriptionId?: string, root = process.cwd()): OutboxRecord[] {
  const briefsDir = path.join(root, "outbox", "briefs");
  if (!fs.existsSync(briefsDir)) return [];
  const files = fs.readdirSync(briefsDir).filter((f) => f.endsWith(".json"));
  const rows: OutboxRecord[] = [];
  for (const f of files) {
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(briefsDir, f), "utf8")) as OutboxRecord;
      if (subscriptionId && rec.subscriptionId !== subscriptionId) continue;
      rows.push(rec);
    } catch {
      /* skip */
    }
  }
  return rows.sort((a, b) => {
    const rank = (r: OutboxRecord) => {
      const lv = r.result.briefing.canada_nexus?.level;
      if (lv === "direct") return 2;
      if (lv === "possible") return 1;
      return 0;
    };
    const d = rank(b) - rank(a);
    if (d !== 0) return d;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function writeRssFeed(
  subscription: Subscription,
  records: OutboxRecord[],
  publicBaseUrl: string,
  root = process.cwd()
): string {
  const feedsDir = path.join(root, "outbox", "feeds");
  ensureDir(feedsDir);
  const feedPath = path.join(feedsDir, `${subscription.id}.xml`);
  const items = records.slice(0, 50).map((r) => {
    const nexus = r.result.briefing.canada_nexus?.level;
    const prefix = nexus === "direct" ? "[CA] " : nexus === "possible" ? "[CA?] " : "";
    const title = `${prefix}${r.subscriptionTitle}: ${r.source.label}`;
    const link = `${publicBaseUrl.replace(/\/$/, "")}/outbox/briefs/${path.basename(r.jsonPath)}`;
    const desc = r.result.briefing.briefing_en?.what || r.result.briefing.briefing_en?.so_what || "";
    return [
      "<item>",
      `<title>${xmlEscape(title)}</title>`,
      `<link>${xmlEscape(link)}</link>`,
      `<guid isPermaLink="false">${xmlEscape(r.id)}</guid>`,
      `<pubDate>${new Date(r.createdAt).toUTCString()}</pubDate>`,
      `<description>${xmlEscape(desc)}</description>`,
      "</item>",
    ].join("");
  });

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0"><channel>`,
    `<title>${xmlEscape(subscription.title)}</title>`,
    `<link>${xmlEscape(`${publicBaseUrl.replace(/\/$/, "")}/feeds/${subscription.id}.xml`)}</link>`,
    `<description>${xmlEscape(subscription.description || "Yanxi civilian public-source briefings")}</description>`,
    ...items,
    `</channel></rss>`,
    "",
  ].join("\n");

  fs.writeFileSync(feedPath, xml, "utf8");
  return feedPath;
}

export async function deliverWebhook(record: OutboxRecord): Promise<void> {
  const url = process.env.SUBSCRIBE_WEBHOOK_URL;
  if (!url) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "yanxi",
        framing: "civilian-public-source-research",
        record: {
          id: record.id,
          subscriptionId: record.subscriptionId,
          createdAt: record.createdAt,
          sourceLabel: record.source.label,
          gatePassed: record.result.gate.passed,
          triage: record.result.briefing.info_triage,
          briefing_en: record.result.briefing.briefing_en,
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}
