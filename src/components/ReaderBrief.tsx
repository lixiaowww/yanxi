import { buildVerdictLine, readerLikelihoodWord } from "../lib/score-bands";
import type { ApiResult } from "../lib/briefing-types";

/**
 * Splits generated English prose into discrete sentences for a bulleted
 * "key judgments" list — ICD 203 (Analytic Standards) rule e(6): products
 * with multiple judgments should present each distinctly rather than as
 * one dense paragraph. Naive but safe for this project's generated prose:
 * splits on sentence-ending punctuation followed by a capital/quote, which
 * avoids breaking on mid-sentence abbreviations.
 */
function splitJudgments(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Merges basis+trigger into one plain sentence — no "Basis:"/"Trigger:"
 * field labels. Per the user's spec, a reader should never see pipeline
 * vocabulary, even at the sub-field level within a scenario.
 */
function scenarioWatchLine(basis?: string, trigger?: string): string {
  if (basis && trigger) return `${basis} Next to watch for: ${trigger}`;
  if (basis) return basis;
  if (trigger) return `Next to watch for: ${trigger}`;
  return "";
}

/** Same idea for alternative+falsifier — plain hedge sentence, no field labels. */
function scenarioHedgeLine(alternative?: string, falsifier?: string): string {
  if (alternative && falsifier) return `The alternative: ${alternative} This call would be wrong if ${falsifier}`;
  if (alternative) return `The alternative: ${alternative}`;
  if (falsifier) return `This call would be wrong if ${falsifier}`;
  return "";
}

/**
 * The Reader's default detail view — deliberately narrower than
 * BriefingNote (which stays the full interactive spine for /compose).
 * Per the user's 2026-09-22 spec: no visible "What" / "Context" / "So
 * what" / "Outlook" pipeline-stage labels. Just two things, each with its
 * own confidence — Analysis and Forecast — plus the one-line verdict.
 * Everything else (source digest, watchpoints, open questions,
 * corroboration, related briefs, canada policy links, raw internals) moves
 * to ReaderMore + AnalystAppendix, both gated behind the Settings toggle
 * in Reader.tsx.
 */
export function ReaderBrief({ result }: { result: ApiResult }) {
  const b = result.briefing;
  const adopted = b.adoption?.adopted !== false;
  const deferred = b.intake?.label === "defer";
  const { tone: verdictTone, text: verdictText } = buildVerdictLine(b);

  // Confidence display is forecast-only now (user, 2026-09-23) — analysis
  // no longer shows a confidence tag, per bullet or in the masthead.
  // source_credibility stays (a different concept: source reliability, not
  // analytical confidence) unless told otherwise.
  const sourceCredibility = b.source_credibility?.level;

  const analysisText =
    b.briefing_en?.context ||
    (b.content_analysis ? `${b.content_analysis.domain_label_en} — ${b.content_analysis.background}` : "");
  const soWhatText = b.briefing_en?.so_what || b.content_analysis?.so_what || "";
  const analysisPoints = [...splitJudgments(analysisText), ...splitJudgments(soWhatText)];
  const scenarios = b.policy_outlook?.scenarios || [];

  return (
    <article className="briefing-note reader-brief">
      <header className="note-masthead">
        {adopted && b.briefing_en?.headline ? <h1 className="note-headline">{b.briefing_en.headline}</h1> : null}
        <div className="note-byline">
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
        {adopted && sourceCredibility ? (
          <div className="reader-confidence-badges">
            <span className={`confidence-badge confidence-${sourceCredibility}`}>Source credibility: {sourceCredibility}</span>
          </div>
        ) : null}
        {b.temporal?.source_as_of ? (
          <p className="note-timestamp">
            source as-of {b.temporal.source_as_of} ({b.temporal.source_as_of_precision || "?"})
          </p>
        ) : null}
      </header>

      {!adopted ? (
        <section className="note-block reject-block">
          <h2>{deferred ? "Deferred — watch queue" : "Not adopted"}</h2>
          <p className="note-body">{b.briefing_en?.what || b.adoption?.label_zh}</p>
          <p className="note-body">{b.briefing_en?.so_what || b.adoption?.reason_zh}</p>
          {b.intake?.reason_en ? <p className="note-sub">{b.intake.reason_en}</p> : null}
        </section>
      ) : (
        <>
          <section className="note-block">
            <h2>Analysis</h2>
            {analysisPoints.length ? (
              <ul className="scenario-list">
                {analysisPoints.map((point, i) => (
                  <li key={i}>
                    <p className="note-body">{point}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {scenarios.length ? (
            <section className="note-block">
              <h2>
                Forecast
                {b.brief_quality?.level === "partial"
                  ? " — provisional (single source / undated)"
                  : b.temporal?.freshness?.band === "aging" || b.temporal?.freshness?.band === "stale"
                    ? " — freshness risk"
                    : ""}
              </h2>
              <ol className="scenario-list">
                {scenarios.map((s, i) => (
                  <li key={i}>
                    <span className={`likelihood likelihood-${s.likelihood || "low"}`}>{readerLikelihoodWord(s.likelihood)}</span>
                    <div>
                      <p className="note-body">{s.label}</p>
                      {scenarioWatchLine(s.basis, s.trigger) ? <p className="note-sub">{scenarioWatchLine(s.basis, s.trigger)}</p> : null}
                      {scenarioHedgeLine(s.alternative, s.falsifier) ? (
                        <p className="note-sub">{scenarioHedgeLine(s.alternative, s.falsifier)}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}
    </article>
  );
}
