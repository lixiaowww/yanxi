/**
 * Public whitelist collect — SSRF via GrantWright urlSafety.safeFetch;
 * HTML→text via GrantWright collect.htmlToText (vendored slices).
 */
import fs from "fs";
import path from "path";
import { isUnsafeUrl, safeFetch } from "../../vendor/grantwright/urlSafety.js";
import { htmlToText } from "../../vendor/grantwright/htmlToText.js";

export type WhitelistEntry =
  | {
      id: string;
      type: "local_json";
      path: string;
      label: string;
      topics?: string[];
      enabled?: boolean;
    }
  | {
      id: string;
      type: "url";
      url: string;
      label: string;
      topics?: string[];
      enabled?: boolean;
      note?: string;
    };

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
};

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
  const text = ctype.includes("json") ? result.text : htmlToText(result.text);
  return text.slice(0, 20_000);
}

export async function collectEntry(
  entry: WhitelistEntry,
  root = process.cwd(),
  allowedHosts: string[] = []
): Promise<CollectedItem | null> {
  if (entry.enabled === false) return null;

  if (entry.type === "local_json") {
    const full = path.join(root, entry.path);
    const raw = JSON.parse(fs.readFileSync(full, "utf8")) as {
      sourceText?: string;
      sourceLabel?: string;
    };
    const sourceText = (raw.sourceText || "").trim();
    if (sourceText.length < 20) return null;
    return {
      sourceId: entry.id,
      label: raw.sourceLabel || entry.label,
      sourceText,
      collectedAt: new Date().toISOString(),
    };
  }

  const text = await fetchWhitelistedText(entry.url, allowedHosts);
  if (text.length < 20) return null;
  return {
    sourceId: entry.id,
    label: entry.label,
    url: entry.url,
    sourceText: text,
    collectedAt: new Date().toISOString(),
  };
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
      const item = await collectEntry(entry, root, wl.allowedHosts);
      if (!item) continue;
      if (!matchesKeywords(item.sourceText, keywords)) continue;
      out.push(item);
    } catch (e) {
      console.warn(`[collect] skip ${id}:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

export function loadWhitelistPublic(root = process.cwd()): WhitelistFile {
  return loadWhitelist(root);
}
