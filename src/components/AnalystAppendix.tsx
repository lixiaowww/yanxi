import {
  analysisConfidenceLineEn,
  sourceCredibilityLineEn,
  corroborationLineEn,
  signalingBasisEn,
  substanceBasisEn,
} from "../lib/score-bands";
import type { ApiResult } from "../lib/briefing-types";

/**
 * Everything a technical reviewer or the author would want to inspect, but a
 * reader of the briefing itself does not need: scorecard internals, gate
 * findings, matched cards, and the raw API response. Deliberately styled as
 * a de-emphasized appendix — never competing with the briefing for
 * attention. See docs/DP-V2.md §1 (Reader/Audit split).
 */
export function AnalystAppendix({
  result,
  showRaw,
  onToggleRaw,
}: {
  result: ApiResult;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  const b = result.briefing;
  return (
    <aside className="appendix">
      <h2 className="appendix-title">Analyst appendix</h2>
      <p className="appendix-note">
        Method, scorecard, and gate internals — not part of the briefing body. For technical
        review only.
      </p>

      {result.gate.findings.length > 0 ? (
        <pre className="findings">
          {result.gate.findings.map((f) => `[${f.severity}] ${f.message}`).join("\n")}
        </pre>
      ) : null}

      <dl className="appendix-list">
        {b.info_triage ? (
          <>
            <dt>Triage</dt>
            <dd>
              Kind {b.info_triage.primary_kind} · research priority{" "}
              {b.info_triage.importance?.grade} · signaling {b.signaling_scorecard?.band} (
              {signalingBasisEn(b.signaling_scorecard?.rules)})
            </dd>
          </>
        ) : null}
        {b.substance_cut ? (
          <>
            <dt>Substance</dt>
            <dd>
              Band {b.substance_cut.band}: {substanceBasisEn(b.substance_cut.nuggets, b.substance_cut.band)}
            </dd>
          </>
        ) : null}
        {(b.substance_cut?.empty_calories || []).length ? (
          <>
            <dt>Formula-language notes</dt>
            <dd>{(b.substance_cut?.empty_calories || []).slice(0, 3).join("; ")}</dd>
          </>
        ) : null}
        {b.corroboration ? (
          <>
            <dt>Corroboration</dt>
            <dd>
              {corroborationLineEn({
                score: b.corroboration.score_0_to_3,
                labelEn: b.corroboration.label_en || b.corroboration.label_zh,
                drivers: b.corroboration.drivers,
              })}
            </dd>
          </>
        ) : null}
        {b.analysis_confidence ? (
          <>
            <dt>Analysis confidence</dt>
            <dd>
              {analysisConfidenceLineEn(b.analysis_confidence)}
              {b.analysis_confidence.rationale ? (
                <span className="appendix-sub"> — {b.analysis_confidence.rationale}</span>
              ) : null}
            </dd>
          </>
        ) : null}
        {b.source_credibility ? (
          <>
            <dt>Source credibility</dt>
            <dd>
              {sourceCredibilityLineEn(b.source_credibility)}
              {b.source_credibility.rationale ? (
                <span className="appendix-sub"> — {b.source_credibility.rationale}</span>
              ) : null}
            </dd>
          </>
        ) : null}
        {(result.infoValue?.next_zh || []).length ? (
          <>
            <dt>Method next</dt>
            <dd>{(result.infoValue?.next_zh || []).join("; ")}</dd>
          </>
        ) : null}
        {b.ontology_lite?.hits?.length ? (
          <>
            <dt>Context cards</dt>
            <dd>{b.ontology_lite.hits.map((h) => h.id).join(", ")}</dd>
          </>
        ) : null}
        {result.offlineReason ? (
          <>
            <dt>Offline reason</dt>
            <dd>{result.offlineReason}</dd>
          </>
        ) : null}
        <dt>Matched cards</dt>
        <dd>{result.matchedCards.join(", ") || "(none)"}</dd>
      </dl>

      <button type="button" className="ghost" onClick={onToggleRaw}>
        {showRaw ? "Hide developer JSON" : "Developer JSON (raw API response)"}
      </button>
      {showRaw ? <pre className="raw-json">{JSON.stringify(result, null, 2)}</pre> : null}
    </aside>
  );
}
