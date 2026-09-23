import { buildVerdictLine, corroborationLineEn, likelihoodWord } from "../lib/score-bands";
import type { ApiResult } from "../lib/briefing-types";

function highlightSource(
  text: string,
  quote: string | null
): { before: string; hit: string; after: string } | null {
  if (!quote) return null;
  const i = text.indexOf(quote);
  if (i < 0) return null;
  return { before: text.slice(0, i), hit: text.slice(i, i + quote.length), after: text.slice(i + quote.length) };
}

export function BriefingNote({
  result,
  sourceText,
  activeQuote,
  onQuoteClick,
  reviewChoices,
  onReviewChange,
  onApplyReview,
  loading,
  savingBrief,
  savedBriefUrl,
  onSaveBrief,
  onCopyMarkdown,
  onUseRelated,
  onMergeRerun,
}: {
  result: ApiResult;
  sourceText: string;
  activeQuote: string | null;
  onQuoteClick: (quote: string) => void;
  reviewChoices: Record<string, string>;
  onReviewChange: (id: string, value: string) => void;
  onApplyReview: () => void;
  loading: boolean;
  savingBrief: boolean;
  savedBriefUrl: string | null;
  onSaveBrief: () => void;
  onCopyMarkdown: () => void;
  onUseRelated: (jsonFile: string) => void;
  onMergeRerun: (jsonFile: string) => void;
}) {
  const b = result.briefing;
  const adopted = b.adoption?.adopted !== false;
  const deferred = b.intake?.label === "defer";
  const { tone: verdictTone, text: verdictText } = buildVerdictLine(b);

  const openReview = (b.human_review || []).filter((p) => p.status === "open");
  const resolvedReview = (b.human_review || []).filter((p) => p.status === "resolved");

  return (
    <article className="briefing-note">
      <header className="note-masthead">
        {adopted && b.briefing_en?.headline ? (
          <h1 className="note-headline">{b.briefing_en.headline}</h1>
        ) : null}
        <div className="note-byline">
          <span>{result.mode === "llm" ? "LLM-assisted draft" : "Offline template draft"}</span>
          <span>·</span>
          <span>{result.sourceCount ?? 1} source{(result.sourceCount ?? 1) > 1 ? "s" : ""}</span>
          {b.desk_section?.label_en ? (
            <>
              <span>·</span>
              <span>{b.desk_section.label_en}</span>
            </>
          ) : null}
          {b.canada_nexus && b.canada_nexus.level !== "none" ? (
            <>
              <span>·</span>
              <span className={`nexus-word ${b.canada_nexus.level}`}>
                {b.canada_nexus.label_en ||
                  (b.canada_nexus.level === "direct" ? "Canada nexus (named)" : "Canada nexus (possible)")}
              </span>
            </>
          ) : null}
        </div>
        <p className={`bluf bluf-${verdictTone}`}>{verdictText}</p>
        {b.temporal ? (
          <p className="note-timestamp">
            briefed {b.temporal.briefed_at?.slice(0, 19).replace("T", " ") || "?"}
            {b.temporal.source_as_of
              ? ` · source as-of ${b.temporal.source_as_of} (${b.temporal.source_as_of_precision || "?"})`
              : " · source as-of unknown"}
            {b.temporal.freshness?.basis_en ? ` — ${b.temporal.freshness.basis_en}` : ""}
          </p>
        ) : null}
      </header>

      {!deferred && adopted && b.brief_quality?.level === "partial" && result.relatedBriefs?.[0] ? (
        <p className="merge-cta">
          <button type="button" className="ghost" onClick={() => onMergeRerun(result.relatedBriefs![0].jsonFile)} disabled={loading}>
            Merge related brief &amp; re-run
          </button>{" "}
          <span className="note-sub">
            Uses "{result.relatedBriefs[0].label}" as a second source to test for complete.
          </span>
        </p>
      ) : null}

      {openReview.length ? (
        <section className="note-block review-block">
          <h2>Needs your call</h2>
          <p className="note-sub">
            The layers below had to guess rather than detect with confidence. Pick an answer and
            re-run — nothing else about this draft changes.
          </p>
          {openReview.map((p) => (
            <div className="review-point" key={p.id}>
              <label htmlFor={`review-${p.id}`}>{p.question_en}</label>
              <select
                id={`review-${p.id}`}
                value={reviewChoices[p.id] ?? p.system_pick}
                onChange={(e) => onReviewChange(p.id, e.target.value)}
              >
                {p.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label_en}
                    {o.value === p.system_pick ? " (system guess)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button type="button" className="ghost" onClick={onApplyReview} disabled={loading}>
            Apply &amp; re-run
          </button>
        </section>
      ) : null}
      {resolvedReview.length ? (
        <p className="note-sub review-resolved-note">
          Confirmed by human review:{" "}
          {resolvedReview
            .map(
              (p) =>
                `${p.id.replace("_", " ")} → ${
                  p.options.find((o) => o.value === p.resolved_value)?.label_en || p.resolved_value
                }`
            )
            .join("; ")}
        </p>
      ) : null}

      {!adopted ? (
        <section className="note-block reject-block">
          <h2>{deferred ? "Deferred — watch queue" : "Not adopted"}</h2>
          <p className="note-body">{b.briefing_en?.what || b.adoption?.label_zh}</p>
          <p className="note-body">{b.briefing_en?.so_what || b.adoption?.reason_zh}</p>
          {b.intake?.reason_en ? <p className="note-sub">{b.intake.reason_en}</p> : null}
          {(b.policy_outlook?.watchpoints || []).length ? (
            <ul className="note-list">
              {(b.policy_outlook?.watchpoints || []).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <>
          <div className="note-actions">
            <button type="button" className="ghost" onClick={onSaveBrief} disabled={savingBrief}>
              {savingBrief ? "Saving…" : savedBriefUrl ? "Saved — open again" : "Save final brief"}
            </button>
            <button type="button" className="ghost" onClick={onCopyMarkdown}>
              Copy brief markdown
            </button>
            {savedBriefUrl ? (
              <a href={savedBriefUrl} target="_blank" rel="noreferrer">
                Open saved .md
              </a>
            ) : null}
          </div>

          {(b.source_digest_zh || []).length ? (
            <section className="note-block">
              <h2>Source digest</h2>
              <ul className="digest-list">
                {(b.source_digest_zh || []).map((row, idx) => {
                  const q = row.quote || "";
                  const ok = Boolean(q && sourceText.includes(q));
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        className={`digest-btn ${activeQuote === q ? "active" : ""} ${ok ? "" : "missing"}`}
                        onClick={() => q && onQuoteClick(q)}
                      >
                        <span className="digest-point">{row.point}</span>
                        {q ? <span className="digest-quote">「{q}」</span> : null}
                      </button>
                      <p className="note-sub digest-citation">
                        {row.source_url ? (
                          <>
                            {row.source_label} ·{" "}
                            <a href={row.source_url} target="_blank" rel="noreferrer noopener">
                              source ↗
                            </a>
                          </>
                        ) : (
                          <>{row.source_label || "unlabeled source"} · no independent URL provided — cannot verify externally</>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="note-block">
            <h2>What</h2>
            <p className="note-body">{b.briefing_en?.what || "—"}</p>
          </section>

          <section className="note-block">
            <h2>Context</h2>
            <p className="note-body">
              {b.briefing_en?.context ||
                (b.content_analysis ? `${b.content_analysis.domain_label_en} — ${b.content_analysis.background}` : "—")}
            </p>
          </section>

          {(b.substance_cut?.nuggets || []).length ? (
            <section className="note-block">
              <h2>Key facts</h2>
              <ul className="nugget-list">
                {(b.substance_cut?.nuggets || []).slice(0, 10).map((n, i) => (
                  <li key={i}>
                    <span className="nugget-kind">{n.value_en || n.label_zh}</span>
                    <span className="nugget-ev">{n.evidence}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="note-block">
            <h2>So what</h2>
            <p className="note-body">{b.briefing_en?.so_what || b.content_analysis?.so_what || "—"}</p>
          </section>

          {(b.policy_outlook?.scenarios || []).length ? (
            <section className="note-block">
              <h2>
                Outlook (hypothesis)
                {b.brief_quality?.level === "partial"
                  ? " — provisional (single source / undated)"
                  : b.temporal?.freshness?.band === "aging" || b.temporal?.freshness?.band === "stale"
                    ? " — freshness risk"
                    : ""}
              </h2>
              {b.brief_quality?.level === "partial" && (b.brief_quality.missing || []).length ? (
                <p className="note-sub">Missing for a complete brief: {(b.brief_quality.missing || []).join(", ")}</p>
              ) : null}
              <ol className="scenario-list">
                {(b.policy_outlook?.scenarios || []).map((s, i) => (
                  <li key={i}>
                    <span className={`likelihood likelihood-${s.likelihood || "low"}`}>{likelihoodWord(s.likelihood)}</span>
                    <div>
                      <p className="note-body">{s.label}</p>
                      {s.basis ? <p className="note-sub">Basis: {s.basis}</p> : null}
                      {s.trigger ? <p className="note-sub">Trigger: {s.trigger}</p> : null}
                      {s.alternative ? <p className="note-sub">Alternative: {s.alternative}</p> : null}
                      {s.falsifier ? <p className="note-sub">Falsifier: {s.falsifier}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {(b.policy_outlook?.watchpoints || []).length ? (
            <section className="note-block">
              <h2>Watchpoints</h2>
              <ul className="note-list">
                {(b.policy_outlook?.watchpoints || []).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {(b.open_questions || []).length ? (
            <section className="note-block">
              <h2>Open questions</h2>
              <ul className="note-list">
                {(b.open_questions || []).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {b.corroboration ? (
            <section className="note-block">
              <h2>Cross-source check</h2>
              <p className="note-body">
                {corroborationLineEn({
                  score: b.corroboration.score_0_to_3,
                  labelEn: b.corroboration.label_en || b.corroboration.label_zh,
                  drivers: b.corroboration.drivers,
                })}
              </p>
              {(b.corroboration.shared_subjects || []).length ? (
                <p className="note-sub">Shared subjects: {(b.corroboration.shared_subjects || []).join(", ")}</p>
              ) : null}
              {b.corroboration.channel_tier_spread ? (
                <p className="note-sub">{b.corroboration.channel_tier_spread.note_en}</p>
              ) : null}
              {(b.corroboration.missing || []).length ? (
                <ul className="note-list">
                  {(b.corroboration.missing || []).slice(0, 4).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              ) : null}
              {result.sourceCount != null ? <p className="note-sub">Sources in this run: {result.sourceCount}</p> : null}
            </section>
          ) : null}

          {(b.absence_signal?.hits || []).some((h) => h.pattern_match) ? (
            <section className="note-block">
              <h2>Absence signal (hypothesis)</h2>
              <p className="note-body">{b.absence_signal?.note_en}</p>
              <ul className="note-list">
                {(b.absence_signal?.hits || [])
                  .filter((h) => h.pattern_match)
                  .map((h, i) => (
                    <li key={i}>
                      {h.subject_label} — {h.prior_coverage_count} prior item(s), last seen{" "}
                      {h.gap_days} day(s) ago
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {(result.relatedBriefs || []).length ? (
            <section className="note-block">
              <h2>Related briefs in outbox</h2>
              <p className="note-sub">
                Same-topic candidates only — not proof. Canada-relevant matches are ranked first. Load
                one as the second source and re-run to test corroboration.
              </p>
              <ul className="note-list">
                {(result.relatedBriefs || []).map((r) => (
                  <li key={r.id}>
                    {r.canada_nexus === "direct" ? (
                      <span className="nexus-word direct">CA</span>
                    ) : r.canada_nexus === "possible" ? (
                      <span className="nexus-word possible">CA?</span>
                    ) : null}{" "}
                    <strong>{r.label}</strong>
                    {r.desk ? ` · ${r.desk}` : ""}
                    {r.shared_keys?.length ? ` · ${r.shared_keys.slice(0, 3).join(", ")}` : ""}
                    <div className="row" style={{ marginTop: "0.35rem", gap: "0.5rem" }}>
                      <button type="button" className="ghost" onClick={() => onUseRelated(r.jsonFile)}>
                        Use as second source
                      </button>
                      <a href={`/outbox/briefs/${r.jsonFile}`} target="_blank" rel="noreferrer">
                        Open JSON
                      </a>
                    </div>
                    {r.what_preview ? <p className="note-sub">{r.what_preview}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {b.canada_policy_link && b.canada_policy_link.level !== "none" ? (
            <section className="note-block policy-link-panel">
              <h2>Canada public-policy links (not legal advice)</h2>
              <ul className="note-list">
                {(b.canada_policy_link.hits || []).map((h, i) => (
                  <li key={i}>
                    <strong>{h.theme_en || h.theme_zh}</strong>
                    <ul className="ref-links">
                      {(h.public_refs || []).map((ref, j) =>
                        ref.url ? (
                          <li key={j}>
                            <a href={ref.url} target="_blank" rel="noreferrer noopener">
                              {ref.title || ref.url}
                            </a>
                          </li>
                        ) : null
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </article>
  );
}

export { highlightSource };
