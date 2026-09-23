/**
 * Public whitelist collect — SSRF via GrantWright urlSafety.safeFetch;
 * HTML→text via GrantWright collect.htmlToText (vendored slices).
 */
import fs from "fs";
import path from "path";
import { isUnsafeUrl, safeFetch } from "../../vendor/grantwright/urlSafety.js";
import { htmlToText } from "../../vendor/grantwright/htmlToText.js";
import type { ChannelTierId, ChannelType } from "./source-channel-tier.js";

/** Outlet/channel classification — docs/DP-V3.md §2. Optional so existing entries need no migration. */
type ChannelFields = {
  tier?: ChannelTierId;
  channel_type?: ChannelType;
  authority_weight?: number;
};

export type WhitelistEntry =
  | ({
      id: string;
      type: "local_json";
      path: string;
      label: string;
      topics?: string[];
      enabled?: boolean;
    } & ChannelFields)
  | ({
      id: string;
      type: "url";
      url: string;
      label: string;
      topics?: string[];
      enabled?: boolean;
      note?: string;
    } & ChannelFields)
  | ({
      id: string;
      type: "rss";
      url: string;
      label: string;
      topics?: string[];
      enabled?: boolean;
      note?: string;
      /** Cap on items pulled from one feed per collect run — an RSS feed can hold dozens. */
      maxItems?: number;
    } & ChannelFields);

export type WhitelistFile = {
  version: number;
  framing: string;
  allowedHosts: string[];
  entries: WhitelistEntry[];
};

export type CollectedItem = {
  sourceId: string;
  label: string;
  url?: string;
  sourceText: string;
  collectedAt: string;
} & ChannelFields;

function loadWhitelist(root = process.cwd()): WhitelistFile {
  const p = path.join(root, "config", "sources.whitelist.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as WhitelistFile;
}

function assertHostWhitelisted(raw: string, allowedHosts: string[]): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (u.username || u.password) throw new Error("URL credentials not allowed");
  const host = u.hostname.toLowerCase();
  if (!allowedHosts.map((h) => h.toLowerCase()).includes(host)) {
    throw new Error(`Host not on whitelist: ${host}`);
  }
  if (isUnsafeUrl(u.href)) {
    throw new Error(`URL failed GrantWright SSRF safety check: ${host}`);
  }
  return u;
}

async function fetchWhitelistedText(url: string, allowedHosts: string[]): Promise<string> {
  const safe = assertHostWhitelisted(url, allowedHosts);
  const result = await safeFetch(safe.href, {
    timeoutMs: 15_000,
    headers: { "User-Agent": "YanxiCivilianResearchBot/0.2 (+public-whitelist-only; gw-urlSafety)" },
  });
  if (!result.ok) {
    throw new Error(result.reason);
  }
  try {
    assertHostWhitelisted(result.finalUrl, allowedHosts);
  } catch (e) {
    throw new Error(
      `Redirect left whitelist (${result.finalUrl}): ${e instanceof Error ? e.message : e}`
    );
  }
  if (!result.response.ok) {
    throw new Error(`HTTP ${result.response.status} for ${result.finalUrl}`);
  }
  const ctype = result.response.headers.get("content-type") || "";
  if (!/text|html|xml|json/i.test(ctype) && ctype) {
    throw new Error(`Unsupported content-type: ${ctype}`);
  }
  // XML (RSS) needs its tags intact for parseRssItems below — htmlToText
  // would strip them like any other markup.
  const text = ctype.includes("json") || ctype.includes("xml") ? result.text : htmlToText(result.text);
  return text.slice(0, 20_000);
}

type RssItem = { title: string; link?: string; description: string; pubDate?: string };

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractXmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeXmlEntities(m[1]).trim() : "";
}

/** Minimal RSS 2.0 `<item>` extraction — narrow on purpose: this project only needs title/link/description/pubDate per item, not a general feed-format parser, so no new dependency for it. */
export function parseRssItems(xml: string, maxItems = 5): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks.slice(0, maxItems)) {
    const title = extractXmlTag(block, "title");
    if (!title) continue;
    items.push({
      title,
      link: extractXmlTag(block, "link") || undefined,
      description: stripHtmlTags(extractXmlTag(block, "description")),
      pubDate: extractXmlTag(block, "pubDate") || undefined,
    });
  }
  return items;
}

/**
 * One whitelist entry can yield more than one collectible unit — an RSS
 * feed is many single-topic items, not one document — so this always
 * returns an array (empty when nothing usable came back), rather than a
 * single item or null.
 */
export async function collectEntry(
  entry: WhitelistEntry,
  root = process.cwd(),
  allowedHosts: string[] = []
): Promise<CollectedItem[]> {
  if (entry.enabled === false) return [];

  if (entry.type === "local_json") {
    const full = path.join(root, entry.path);
    const raw = JSON.parse(fs.readFileSync(full, "utf8")) as {
      sourceText?: string;
      sourceLabel?: string;
    };
    const sourceText = (raw.sourceText || "").trim();
    if (sourceText.length < 20) return [];
    return [
      {
        sourceId: entry.id,
        label: raw.sourceLabel || entry.label,
        sourceText,
        collectedAt: new Date().toISOString(),
        tier: entry.tier,
        channel_type: entry.channel_type,
        authority_weight: entry.authority_weight,
      },
    ];
  }

  if (entry.type === "rss") {
    const xml = await fetchWhitelistedText(entry.url, allowedHosts);
    const feedItems = parseRssItems(xml, entry.maxItems ?? 5);
    const now = new Date().toISOString();
    const out: CollectedItem[] = [];
    feedItems.forEach((it, i) => {
      const sourceText = [it.title, it.description].filter(Boolean).join("\n").trim();
      if (sourceText.length < 20) return;
      out.push({
        sourceId: `${entry.id}:${i}`,
        label: it.title,
        url: it.link,
        sourceText,
        collectedAt: now,
        tier: entry.tier,
        channel_type: entry.channel_type,
        authority_weight: entry.authority_weight,
      });
    });
    return out;
  }

  const text = await fetchWhitelistedText(entry.url, allowedHosts);
  if (text.length < 20) return [];
  return [
    {
      sourceId: entry.id,
      label: entry.label,
      url: entry.url,
      sourceText: text,
      collectedAt: new Date().toISOString(),
      tier: entry.tier,
      channel_type: entry.channel_type,
      authority_weight: entry.authority_weight,
    },
  ];
}

export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  return keywords.some((k) => text.includes(k));
}

export async function collectForSubscription(
  sourceIds: string[],
  keywords: string[],
  maxItems: number,
  root = process.cwd()
): Promise<CollectedItem[]> {
  const wl = loadWhitelist(root);
  const byId = new Map(wl.entries.map((e) => [e.id, e]));
  const out: CollectedItem[] = [];

  for (const id of sourceIds) {
    if (out.length >= maxItems) break;
    const entry = byId.get(id);
    if (!entry) continue;
    try {
      const items = await collectEntry(entry, root, wl.allowedHosts);
      for (const item of items) {
        if (out.length >= maxItems) break;
        if (!matchesKeywords(item.sourceText, keywords)) continue;
        out.push(item);
      }
    } catch (e) {
      console.warn(`[collect] skip ${id}:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

export function loadWhitelistPublic(root = process.cwd()): WhitelistFile {
  return loadWhitelist(root);
}
