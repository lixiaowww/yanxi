/**
 * Reader-facing briefing markdown — the deliverable spine, not method dump.
 *
 * Digest → What → Context → Key facts → So what → Outlook → Watchpoints →
 * Open questions → Cross-source. Analyst/scorecard material stays out.
 */
import type { BriefingJson } from "./gate.js";
import type { BriefResponse } from "./pipeline.js";
import { buildVerdictLine, corroborationLineEn } from "./score-bands.js";

export type BriefMarkdownMeta = {
  title: string;
  id?: string;
  createdAt?: string;
  sourceLabel?: string;
  sourceUrl?: string;
};

/** Full English briefing note for human review / export / outbox. */
export function formatBriefMarkdown(
  briefing: BriefingJson,
  meta: BriefMarkdownMeta,
  opts?: { mode?: string; sourceCount?: number }
): string {
  const en = briefing.briefing_en;
  const ca = briefing.content_analysis;
  const outlook = briefing.policy_outlook;
  const adopted = briefing.adoption?.adopted !== false;
  const deferred = briefing.intake?.label === "defer";
  const out: string[] = [];

  // A generated headline is a specific claim about the subject (real
  // briefing samples lead with one); meta.title is often just the
  // subscription/desk label — keep both when they differ.
  const headline = adopted ? en?.headline : undefined;
  out.push(`# ${headline || meta.title}`, "");
  if (headline && headline !== meta.title) out.push(`_${meta.title}_`, "");

  // BLUF first, from the SAME builder the UI uses (score-bands.ts) — the
  // two drifted once already when only the UI got a reader/audit split and
  // this file kept growing a metadata dump instead. Don't repeat that.
  const verdict = buildVerdictLine(briefing);
  out.push(`**${verdict.text}**`, "");
  if (meta.sourceLabel) {
    out.push(`Source: ${meta.sourceLabel}${meta.sourceUrl ? ` · ${meta.sourceUrl}` : ""}  `);
  }
  if (briefing.temporal) {
    const t = briefing.temporal;
    out.push(
      `Briefed ${t.briefed_at?.slice(0, 19) || "?"} · source as-of ${t.source_as_of || "unknown"} (${t.source_as_of_precision || "none"})`
    );
  }
  out.push("");

  if (!adopted) {
    out.push(
      deferred ? "## Deferred — watch queue" : "## Not adopted",
      "",
      en?.what || briefing.adoption?.label_zh || "",
      "",
      en?.so_what || briefing.adoption?.reason_zh || "",
      ""
    );
    if (briefing.intake?.reason_en) out.push(briefing.intake.reason_en, "");
    if (outlook?.watchpoints?.length) {
      out.push("## Watchpoints", "");
      for (const w of outlook.watchpoints) out.push(`- ${w}`);
      out.push("");
    }
  } else {
    if (briefing.source_digest_zh?.length) {
      out.push("## Source digest", "");
      for (const row of briefing.source_digest_zh) {
        const point = row.point || "";
        const quote = row.quote ? ` 「${row.quote}」` : "";
        const lab = row.source_label ? ` _(${row.source_label})_` : "";
        out.push(`- ${point}${quote}${lab}`);
      }
      out.push("");
    }

    out.push("## What", "", en?.what || "—", "");
    out.push(
      "## Context",
      "",
      en?.context || (ca ? `${ca.domain_label_en} — ${ca.background}` : "—"),
      ""
    );

    const nuggets = briefing.substance_cut?.nuggets || [];
    if (nuggets.length) {
      out.push("## Key facts", "");
      for (const n of nuggets.slice(0, 10)) {
        out.push(`- **${n.value_en || n.label_zh || n.kind || "fact"}:** ${n.evidence || ""}`);
      }
      out.push("");
    }

    out.push("## So what", "", en?.so_what || ca?.so_what || "—", "");

    const scenarios = outlook?.scenarios || [];
    if (scenarios.length) {
      const provisional =
        briefing.brief_quality?.level === "partial"
          ? " (provisional — single source / undated)"
          : "";
      out.push(`## Outlook (hypothesis)${provisional}`, "");
      for (const s of scenarios) {
        out.push(`- **[${s.likelihood || "?"}]** ${s.label || ""}`);
        if (s.horizon) out.push(`  - Horizon: ${s.horizon}`);
        if (s.basis) out.push(`  - Basis: ${s.basis}`);
        if (s.trigger) out.push(`  - Trigger: ${s.trigger}`);
        if (s.alternative) out.push(`  - Alternative: ${s.alternative}`);
        if (s.falsifier) out.push(`  - Falsifier: ${s.falsifier}`);
      }
      out.push("");
    }

    if (outlook?.watchpoints?.length) {
      out.push("## Watchpoints", "");
      for (const w of outlook.watchpoints) out.push(`- ${w}`);
      out.push("");
    }

    if (briefing.open_questions?.length) {
      out.push("## Open questions", "");
      for (const q of briefing.open_questions) out.push(`- ${q}`);
      out.push("");
    }

    if (briefing.corroboration) {
      out.push(
        "## Cross-source check",
        "",
        corroborationLineEn({
          score: briefing.corroboration.score_0_to_3,
          labelEn: briefing.corroboration.label_en || briefing.corroboration.label_zh,
          drivers: briefing.corroboration.drivers,
        }),
        ""
      );
      if (briefing.corroboration.shared_subjects?.length) {
        out.push(`Shared subjects: ${briefing.corroboration.shared_subjects.join(", ")}`, "");
      }
    }
  }

  // Everything below is process metadata, not the briefing — collapsed by
  // default (GitHub-flavored markdown renders <details> as a real
  // disclosure widget). Same "reader first, audit behind a fold" split as
  // the UI's Analyst appendix.
  const auditLines: string[] = [];
  if (meta.id) auditLines.push(`- id: ${meta.id}`);
  if (meta.createdAt) auditLines.push(`- created: ${meta.createdAt}`);
  if (opts?.mode) auditLines.push(`- mode: ${opts.mode}`);
  if (opts?.sourceCount != null) auditLines.push(`- sources in run: ${opts.sourceCount}`);
  if (briefing.desk_section?.label_en || briefing.desk_section?.label_zh) {
    auditLines.push(`- desk: ${briefing.desk_section.label_en || briefing.desk_section.label_zh}`);
  }
  if (briefing.info_triage) {
    auditLines.push(
      `- triage: ${briefing.info_triage.primary_kind || "?"} / ${briefing.info_triage.importance?.grade || "?"}`
    );
  }
  if (briefing.intake?.label) auditLines.push(`- intake: ${briefing.intake.label}`);
  if (briefing.brief_quality?.level) {
    auditLines.push(
      `- brief quality: ${briefing.brief_quality.level}${
        briefing.brief_quality.missing?.length
          ? ` (missing: ${briefing.brief_quality.missing.join(", ")})`
          : ""
      }`
    );
  }
  if (briefing.analysis_confidence?.level || en?.confidence) {
    auditLines.push(`- analysis confidence: ${briefing.analysis_confidence?.level || en?.confidence}`);
  }
  if (briefing.source_credibility?.level) {
    auditLines.push(
      `- source credibility: ${briefing.source_credibility.level}${
        briefing.source_credibility.caps_applied?.includes("weak_provenance_cap_medium")
          ? " (no independent URL to verify this specific excerpt — not a comment on the issuing body's standing)"
          : ""
      }`
    );
  }
  if (briefing.temporal?.freshness?.label_en) {
    auditLines.push(`- freshness: ${briefing.temporal.freshness.label_en}`);
  }
  if (ca?.domain_label_en) auditLines.push(`- domain: ${ca.domain_label_en}`);

  if (auditLines.length) {
    out.push(
      "<details>",
      "<summary>Analysis details (id, mode, triage, confidence factors — not the briefing body)</summary>",
      "",
      ...auditLines,
      "",
      "</details>",
      ""
    );
  }

  out.push(
    "> Draft for human review · Public sources only · Not an intelligence product",
    ""
  );
  return out.join("\n");
}

export function formatBriefResponseMarkdown(
  result: BriefResponse,
  meta: BriefMarkdownMeta
): string {
  return formatBriefMarkdown(result.briefing, meta, {
    mode: result.mode,
    sourceCount: result.sourceCount,
  });
}
