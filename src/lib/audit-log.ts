import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { BriefResponse } from "./pipeline.js";

export type AuditEntry = {
  ts: string;
  product: "yanxi";
  mode: string;
  sourceLabel?: string;
  sourceHash: string;
  gatePassed: boolean;
  findings: { id: string; severity: string; message: string }[];
  matchedCards: string[];
  triageGrade?: string;
  primaryKind?: string;
  signalingBand?: string;
};

function auditEnabled(): boolean {
  return process.env.YANXI_AUDIT !== "0";
}

function sourceHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function appendGateAudit(
  result: BriefResponse,
  opts: { sourceText: string; sourceLabel?: string },
  root = process.cwd()
): void {
  if (!auditEnabled()) return;
  const dir = path.join(root, "outbox", "audit");
  fs.mkdirSync(dir, { recursive: true });
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    product: "yanxi",
    mode: result.mode,
    sourceLabel: opts.sourceLabel,
    sourceHash: sourceHash(opts.sourceText),
    gatePassed: result.gate.passed,
    findings: result.gate.findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      message: f.message,
    })),
    matchedCards: result.matchedCards,
    triageGrade: result.briefing.info_triage?.importance?.grade,
    primaryKind: result.briefing.info_triage?.primary_kind,
    signalingBand: result.briefing.signaling_scorecard?.band,
  };
  fs.appendFileSync(path.join(dir, "gate.jsonl"), JSON.stringify(entry) + "\n", "utf8");
}
