import fs from "fs";
import path from "path";
import type { BriefResponse } from "./pipeline.js";
import {
  HEURISTIC_BASIS_NOTE,
  corroborationLineEn,
  sourceTierLineEn,
  substanceBasisEn,
} from "./score-bands.js";
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
  const b = rec.result.briefing;
  const triage = b.info_triage;
  const en = b.briefing_en;
  const nexus = b.canada_nexus;
  const nexusLine =
    nexus && nexus.level && nexus.level !== "none"
      ? `- **Canada nexus:** ${nexus.label_zh || nexus.level} · ${(nexus.hits || [])
          .map((h) => h.cue)
          .filter(Boolean)
          .slice(0, 4)
          .join(", ")}`
      : null;
  return [
    `# ${nexus && nexus.level === "direct" ? "[CA] " : nexus && nexus.level === "possible" ? "[CA?] " : ""}${rec.subscriptionTitle}`,
    "",
    `- **id:** ${rec.id}`,
    `- **created:** ${rec.createdAt}`,
    `- **source:** ${rec.source.label}${rec.source.url ? ` · ${rec.source.url}` : ""}`,
    ...(b.temporal
      ? [
          `- **temporal:** briefed ${b.temporal.briefed_at?.slice(0, 19) || "?"} · source as-of ${b.temporal.source_as_of || "unknown"} (${b.temporal.source_as_of_precision || "none"}) · ${b.temporal.freshness?.label_en || "Freshness unknown"}`,
        ]
      : []),
    `- **mode:** ${rec.result.mode}`,
    `- **gate:** ${rec.result.gate.passed ? "PASS" : "FAIL"}`,
    `- **triage:** ${triage?.primary_kind || "?"} / ${triage?.importance?.grade || "?"}`,
    ...(b.desk_section?.label_zh
      ? [`- **desk:** ${b.desk_section.label_zh}${b.desk_section.primary ? ` (${b.desk_section.primary})` : ""}`]
      : []),
    ...(b.ontology_lite?.hits?.length
      ? [
          `- **ontology-lite:** ${b.ontology_lite.hits
            .slice(0, 6)
            .map((h) => h.id)
            .join(", ")}`,
        ]
      : []),
    ...(b.confidence_factors
      ? [
          `- **confidence:** ${b.confidence_factors.level} · ${corroborationLineEn({
            score: b.corroboration?.score_0_to_3,
            labelEn: b.corroboration?.label_en,
            drivers: b.corroboration?.drivers,
          })} · source_class=${b.source_class?.class || "?"}${
            b.confidence_factors.source_tier?.tier
              ? ` · ${sourceTierLineEn(b.confidence_factors.source_tier)}`
              : ""
          }`,
          `- **basis:** ${HEURISTIC_BASIS_NOTE}`,
        ]
      : []),
    ...(b.canada_policy_link && b.canada_policy_link.level !== "none"
      ? [
          `- **Canada policy link:** ${b.canada_policy_link.label_zh}`,
          ...(b.canada_policy_link.hits || []).flatMap((h) =>
            (h.public_refs || [])
              .filter((r): r is { title?: string; url: string; publisher?: string } =>
                Boolean(r && typeof r === "object" && typeof (r as { url?: string }).url === "string")
              )
              .map((r) => `  - [${r.title || r.url}](${r.url})`)
          ),
        ]
      : []),
    ...(nexusLine ? [nexusLine] : []),
    "",
    "## What",
    en?.what || "",
    "",
    "## Context",
    en?.context || "",
    "",
    "## So what",
    en?.so_what || "",
    "",
    "## Confidence",
    en?.confidence || "",
    "",
    ...(nexus && nexus.level !== "none"
      ? [
          "## Canada nexus (reader interest)",
          nexus.rationale || "",
          ...(nexus.hits || []).map((h) => `- **[${h.level}]** ${h.cue}: ${h.evidence}`),
          "",
        ]
      : []),
    ...(b.substance_cut
      ? [
          `## Substance cut (${b.substance_cut.band || "?"})`,
          b.substance_cut.label_zh || "",
          `Band basis: ${substanceBasisEn(b.substance_cut.nuggets, b.substance_cut.band)}.`,
          b.substance_cut.analyst_prompt_zh || "",
          "",
          "**Nuggets**",
          ...((b.substance_cut.nuggets || []).length
            ? (b.substance_cut.nuggets || []).map((n) => `- **${n.label_zh}:** ${n.evidence}`)
            : ["- (none)"]),
          "",
          "**Empty calories**",
          ...((b.substance_cut.empty_calories || []).length
            ? (b.substance_cut.empty_calories || []).map((e) => `- ${e}`)
            : ["- (none)"]),
          "",
        ]
      : []),
    "## Open questions",
    ...(b.open_questions || []).map((q) => `- ${q}`),
    "",
    "> Draft for human review · Public sources only · Not an intelligence product · Canada nexus ≠ personal targeting",
    "",
  ].join("\n");
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
