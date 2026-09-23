/**
 * Free, no-new-cost mitigation for Render's free-tier non-persistent disk
 * (docs/DEPLOY.md): archives the current live outbox to this repo's own
 * GitHub Contents API after each real collect run, and restores from it at
 * boot. GitHub is already wired into this project (the collect-cron
 * workflow) and the repo is public, so restoring needs no credential at
 * all -- only archiving (a write) needs a token. Fail-open throughout,
 * same contract as JevGate/LLM fallback: unconfigured or a failed call
 * never blocks the app, it just means no archive this round.
 *
 * This does not replace `outbox/briefs/` as the source of truth while the
 * process is running -- it is a side-channel snapshot purely so a fresh
 * instance has something to read before (or instead of) waiting on a new
 * collect run. See docs/DP-V2.md (2026-09-23, outbox persistence).
 */
import fs from "fs";
import path from "path";
import { listOutboxBriefs, type OutboxRecord } from "./outbox.js";

const GITHUB_API = "https://api.github.com";
const REPO = process.env.GITHUB_ARCHIVE_REPO || "lixiaowww/yanxi";
const BRANCH = process.env.GITHUB_ARCHIVE_BRANCH || "main";
const ARCHIVE_PATH = "outbox/archive/public-live-collect.json";
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${ARCHIVE_PATH}`;

type ArchivedRecord = Omit<OutboxRecord, "jsonPath" | "markdownPath"> & { markdown: string };
type ArchiveFile = { archivedAt: string; records: ArchivedRecord[] };

function archiveConfigured(): boolean {
  return Boolean(process.env.GITHUB_ARCHIVE_TOKEN);
}

/** Snapshot every current `provenance: "live"` outbox record to GitHub. No-op if unconfigured. */
export async function archiveLiveOutboxToGitHub(): Promise<{ archived: number } | null> {
  const token = process.env.GITHUB_ARCHIVE_TOKEN;
  if (!token) return null;

  const live = listOutboxBriefs().filter((r) => r.provenance === "live");
  if (!live.length) return { archived: 0 };

  const records: ArchivedRecord[] = live.map((r) => {
    const { jsonPath, markdownPath, ...rest } = r;
    let markdown = "";
    try {
      markdown = fs.readFileSync(markdownPath, "utf8");
    } catch {
      /* best-effort — restore will just skip the .md file for this record */
    }
    return { ...rest, markdown };
  });
  const body: ArchiveFile = { archivedAt: new Date().toISOString(), records };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  let sha: string | undefined;
  try {
    const existing = await fetch(
      `${GITHUB_API}/repos/${REPO}/contents/${ARCHIVE_PATH}?ref=${BRANCH}`,
      { headers }
    );
    if (existing.ok) {
      const j = (await existing.json()) as { sha?: string };
      sha = j.sha;
    }
  } catch {
    /* file may not exist yet, or the lookup failed — PUT below creates it */
  }

  const content = Buffer.from(JSON.stringify(body, null, 2), "utf8").toString("base64");
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${ARCHIVE_PATH}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `Archive live outbox (${records.length} record${records.length === 1 ? "" : "s"})`,
      content,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub archive PUT failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return { archived: records.length };
}

/**
 * Write the archived records back into outbox/briefs/ so listOutboxBriefs()
 * picks them up exactly as if a real collect run had just produced them.
 * Public repo — no token needed to read. Returns how many were restored.
 */
export async function restoreOutboxFromGitHub(root = process.cwd()): Promise<number> {
  let res: Response;
  try {
    res = await fetch(`${RAW_URL}?t=${Date.now()}`);
  } catch {
    return 0;
  }
  if (!res.ok) return 0;

  let file: ArchiveFile;
  try {
    file = (await res.json()) as ArchiveFile;
  } catch {
    return 0;
  }
  if (!file?.records?.length) return 0;

  const briefsDir = path.join(root, "outbox", "briefs");
  fs.mkdirSync(briefsDir, { recursive: true });

  let restored = 0;
  for (const rec of file.records) {
    try {
      const { markdown, ...base } = rec;
      const jsonPath = path.join(briefsDir, `${rec.id}.json`);
      const markdownPath = path.join(briefsDir, `${rec.id}.md`);
      if (fs.existsSync(jsonPath)) continue; // don't clobber a record already written this run
      const full: OutboxRecord = { ...base, jsonPath, markdownPath };
      fs.writeFileSync(jsonPath, JSON.stringify(full, null, 2), "utf8");
      if (markdown) fs.writeFileSync(markdownPath, markdown, "utf8");
      restored += 1;
    } catch {
      /* skip this one record, keep restoring the rest */
    }
  }
  return restored;
}

export { archiveConfigured };
