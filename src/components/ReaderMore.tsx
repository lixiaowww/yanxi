import { corroborationLineEn } from "../lib/score-bands";
import type { ApiResult } from "../lib/briefing-types";

/**
 * The rest of the reader spine — source digest, watchpoints, open
 * questions, cross-source check, absence signal, related briefs, Canada
 * policy links. Not pipeline/gate internals (that's AnalystAppendix); this
 * is still reader-facing content, just moved behind the Settings toggle
 * per the user's 2026-09-22 spec so the default view stays to Analysis +
 * Forecast only. Read-only — no interactive quote-highlight/merge/save
 * affordances (those stay in BriefingNote for /compose).
 */
export function ReaderMore({ result }: { result: ApiResult }) {
  const b = result.briefing;
  if (b.adoption?.adopted === false) return null;

  return (
    <section className="reader-more">
      <h2 className="appendix-title">More detail</h2>

      {(b.source_digest_zh || []).length ? (
        <div className="note-block">
          <h3>Source digest</h3>
          <ul className="digest-list">
            {(b.source_digest_zh || []).map((row, idx) => (
              <li key={idx}>
                <span className="digest-point">{row.point}</span>
                {row.quote ? <span className="digest-quote">「{row.quote}」</span> : null}
                <p className="note-sub digest-citation">
                  {row.source_url ? (
                    <>
                      {row.source_label} ·{" "}
                      <a href={row.source_url} target="_blank" rel="noreferrer noopener">
                        source ↗
                      </a>
                    </>
                  ) : (
                    <>{row.source_label || "unlabeled source"} · no independent URL provided</>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(b.policy_outlook?.watchpoints || []).length ? (
        <div className="note-block">
          <h3>Watchpoints</h3>
          <ul className="note-list">
            {(b.policy_outlook?.watchpoints || []).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(b.open_questions || []).length ? (
        <div className="note-block">
          <h3>Open questions</h3>
          <ul className="note-list">
            {(b.open_questions || []).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {b.corroboration ? (
        <div className="note-block">
          <h3>Cross-source check</h3>
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
        </div>
      ) : null}

      {(b.absence_signal?.hits || []).some((h) => h.pattern_match) ? (
        <div className="note-block">
          <h3>Absence signal (hypothesis)</h3>
          <p className="note-body">{b.absence_signal?.note_en}</p>
          <ul className="note-list">
            {(b.absence_signal?.hits || [])
              .filter((h) => h.pattern_match)
              .map((h, i) => (
                <li key={i}>
                  {h.subject_label} — {h.prior_coverage_count} prior item(s), last seen {h.gap_days} day(s) ago
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {(result.relatedBriefs || []).length ? (
        <div className="note-block">
          <h3>Related briefs in outbox</h3>
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
                <a href={`/outbox/briefs/${r.jsonFile}`} target="_blank" rel="noreferrer" style={{ marginLeft: "0.5rem" }}>
                  Open JSON
                </a>
                {r.what_preview ? <p className="note-sub">{r.what_preview}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {b.canada_policy_link && b.canada_policy_link.level !== "none" ? (
        <div className="note-block policy-link-panel">
          <h3>Canada public-policy links (not legal advice)</h3>
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
        </div>
      ) : null}
    </section>
  );
}
