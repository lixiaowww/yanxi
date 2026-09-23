import { useEffect, useMemo, useState } from "react";
import { BriefingNote, highlightSource } from "./components/BriefingNote";
import { AnalystAppendix } from "./components/AnalystAppendix";
import type { ApiResult } from "./lib/briefing-types";

const SAMPLE = `据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展。会议要求有关部门于2026年底前出台配套办法，安排专项资金不少于50亿元支持芯片与半导体中小企业试点。`;

type SubRow = {
  id: string;
  title: string;
  scheduleHuman?: string;
  keywords: string[];
  feedUrl: string;
  active: boolean;
};

type OutboxRow = {
  id: string;
  createdAt: string;
  sourceLabel: string;
  gatePassed: boolean;
  what?: string;
  canadaNexus?: string;
  jsonUrl: string;
  mdUrl: string;
};

type DomainRow = {
  id: string;
  domain: string;
  sourceLabel: string;
  preview: string;
  deskPrimary?: string;
  deskLabel?: string;
  hotThemes?: { id?: string; label_en?: string }[];
};

type ThemeRow = { id?: string; label_en?: string };

/** Turn server refusals into short English guidance instead of a bare status. */
function briefErrorMessage(status: number, serverError?: string): string {
  const detail = serverError || `Request failed (HTTP ${status}).`;
  if (status === 401 || status === 403) {
    return detail;
  }
  if (status === 429) {
    return `${detail} This shared demo caps briefing runs per visitor; try again after the rate-limit window resets.`;
  }
  if (status === 413) {
    return `${detail} Paste a shorter public excerpt and re-run.`;
  }
  return detail;
}

export function App() {
  const [sourceText, setSourceText] = useState(SAMPLE);
  const [label, setLabel] = useState("sample-xinhua-style-excerpt");
  const [sourceUrl, setSourceUrl] = useState("");
  const [source2Text, setSource2Text] = useState("");
  const [source2Label, setSource2Label] = useState("second-public-source");
  const [source2Url, setSource2Url] = useState("");
  const [sourcePublishedAt, setSourcePublishedAt] = useState("");
  const [markSocial, setMarkSocial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [hotThemeCatalog, setHotThemeCatalog] = useState<ThemeRow[]>([]);
  const [domainId, setDomainId] = useState("");
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [savingBrief, setSavingBrief] = useState(false);
  const [savedBriefUrl, setSavedBriefUrl] = useState<string | null>(null);
  // Human-in-the-loop: pending answers to open briefing.human_review points,
  // keyed by point id. Cleared whenever the source text/label changes so a
  // stale override never silently applies to unrelated new content.
  const [reviewChoices, setReviewChoices] = useState<Record<string, string>>({});

  const parts = useMemo(
    () => highlightSource(sourceText, activeQuote),
    [sourceText, activeQuote]
  );

  // Group the fixture picker by desk channel so Hot topics packs are findable.
  const domainGroups = useMemo(() => {
    const order = ["hot_topics", "economy_investment", "industrial_tech", "foreign_affairs", "defense_public", "social_governance"];
    const groups = new Map<string, { label: string; rows: DomainRow[] }>();
    for (const d of domains) {
      const key = d.deskPrimary || "other";
      if (!groups.has(key)) groups.set(key, { label: d.deskLabel || "Other", rows: [] });
      groups.get(key)!.rows.push(d);
    }
    return [...groups.entries()]
      .sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
      })
      .map(([id, g]) => ({ id, ...g }));
  }, [domains]);

  async function refreshSubs() {
    const [s, o, d] = await Promise.all([
      fetch("/api/subscriptions").then((r) => r.json()),
      fetch("/api/outbox").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
    ]);
    setSubs(s.subscriptions || []);
    setOutbox(o.briefs || []);
    setDomains(d.domains || []);
    setHotThemeCatalog(d.hotThemeCatalog || []);
  }

  async function loadDomain(id: string) {
    if (!id) return;
    const res = await fetch(`/api/domains/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    setDomainId(id);
    setSourceText(data.sourceText);
    setLabel(data.sourceLabel);
    setActiveQuote(null);
    setResult(null);
    setReviewChoices({});
  }

  /**
   * Guided starting points instead of a blank textarea — one input that
   * reaches brief_quality=complete, one that correctly defers. Both are the
   * product working as designed (see docs/PRD.md §2), not a coin flip on
   * whatever a first-time visitor happens to paste.
   */
  async function loadGuidedExample(kind: "complete" | "defer") {
    setDomainId("");
    setActiveQuote(null);
    setResult(null);
    setReviewChoices({});
    if (kind === "defer") {
      setSourceText(
        "有关会议强调，要统筹发展和安全，稳妥化解地方债与隐性债务风险，持续做好保交楼工作，促进房地产市场平稳健康发展，坚决守住不发生系统性金融风险的底线，同时防止资本无序扩张。"
      );
      setLabel("single-source-finance-risk");
      setSource2Text("");
      setSourcePublishedAt("");
      return;
    }
    const [meeting, notice] = await Promise.all([
      fetch("/api/domains/macro-cewc").then((r) => r.json()),
      fetch("/api/domains/macro-instrument").then((r) => r.json()),
    ]);
    setSourceText(meeting.sourceText);
    setLabel("Xinhua — Central Economic Work Conference");
    setSource2Text(notice.sourceText);
    setSource2Label("State Council General Office — implementing notice");
    setSourcePublishedAt("2026-09-15");
  }

  useEffect(() => {
    refreshSubs().catch(() => undefined);
  }, []);

  async function run(opts?: { second?: { text: string; label: string } }) {
    setLoading(true);
    setError("");
    setActiveQuote(null);
    try {
      const second = (opts?.second?.text ?? source2Text).trim();
      const secondLabel = opts?.second?.label ?? source2Label;
      // Human review overrides — only sent once the operator has actually
      // picked an answer for that point (see the "Needs your call" panel).
      const overrides = {
        sourceClass: reviewChoices.source_class || (markSocial ? "social_commentary" : undefined),
        forcedIntakeLabel: reviewChoices.intake_gray || undefined,
        forcedDomainProfile: reviewChoices.domain_profile || undefined,
      };
      const secondUrl = opts?.second ? undefined : source2Url.trim() || undefined;
      const payload =
        second.length >= 20
          ? {
              sources: [
                { label, text: sourceText, url: sourceUrl.trim() || undefined },
                { label: secondLabel || "second-public-source", text: second, url: secondUrl },
              ],
              sourcePublishedAt: sourcePublishedAt.trim() || undefined,
              ...overrides,
            }
          : {
              sourceText,
              sourceLabel: label,
              sourceUrl: sourceUrl.trim() || undefined,
              sourcePublishedAt: sourcePublishedAt.trim() || undefined,
              ...overrides,
            };
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) throw new Error(briefErrorMessage(res.status, data.error));
      setResult(data);
      setSavedBriefUrl(null);
      const first = data.briefing?.source_digest_zh?.[0]?.quote;
      if (first && sourceText.includes(first)) setActiveQuote(first);
      // Persist the deliverable brief so Generate always leaves a final .md in outbox.
      try {
        const saveRes = await fetch("/api/brief/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: data, sourceLabel: label, sourceText }),
        });
        const saved = await saveRes.json().catch(() => ({} as { mdUrl?: string }));
        if (saveRes.ok && saved.mdUrl) {
          setSavedBriefUrl(saved.mdUrl);
          await refreshSubs();
        }
      } catch {
        /* save is best-effort; the on-screen brief still stands */
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  /** Fetch a related outbox brief's source text/label; returns null on failure (sets error). */
  async function fetchRelatedSource(
    jsonFile: string
  ): Promise<{ text: string; label: string } | null> {
    try {
      const res = await fetch(`/outbox/briefs/${jsonFile}`);
      if (!res.ok) throw new Error(`Could not load ${jsonFile}`);
      const rec = await res.json();
      const text = String(rec?.source?.sourceText || "");
      const lab = String(rec?.source?.label || rec?.id || "related-source");
      if (text.length < 20) throw new Error("Related brief has no usable source text");
      return { text, label: lab };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  async function useRelatedAsSecondSource(jsonFile: string) {
    const hit = await fetchRelatedSource(jsonFile);
    if (!hit) return;
    setSource2Text(hit.text);
    setSource2Label(hit.label);
    setError("");
  }

  /** Top-banner one-click action for a Partial brief: merge the strongest
   * related outbox brief as the second source and re-run immediately,
   * instead of load-then-scroll-up-then-click-Generate. */
  async function mergeRelatedAndRun(jsonFile: string) {
    const hit = await fetchRelatedSource(jsonFile);
    if (!hit) return;
    setSource2Text(hit.text);
    setSource2Label(hit.label);
    await run({ second: hit });
  }

  async function saveBrief() {
    if (!result) return;
    setSavingBrief(true);
    setError("");
    try {
      const res = await fetch("/api/brief/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          sourceLabel: label,
          sourceText,
        }),
      });
      const data = await res.json().catch(() => ({}) as { error?: string; mdUrl?: string });
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSavedBriefUrl(data.mdUrl || null);
      await refreshSubs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingBrief(false);
    }
  }

  async function copyBriefMarkdown() {
    if (!result?.briefing) return;
    try {
      // Prefer server-saved markdown when available; else rebuild a minimal client spine.
      if (savedBriefUrl) {
        const res = await fetch(savedBriefUrl);
        const md = await res.text();
        await navigator.clipboard.writeText(md);
        return;
      }
      const res = await fetch("/api/brief/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, sourceLabel: label, sourceText }),
      });
      const data = await res.json().catch(() => ({}) as { error?: string; markdown?: string; mdUrl?: string });
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (data.mdUrl) setSavedBriefUrl(data.mdUrl);
      await navigator.clipboard.writeText(data.markdown || "");
      await refreshSubs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function runCollect(subscriptionId?: string) {
    setCollecting(true);
    setError("");
    try {
      const res = await fetch("/api/collect/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionId ? { subscriptionId } : {}),
      });
      const data = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) throw new Error(briefErrorMessage(res.status, data.error));
      await refreshSubs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCollecting(false);
    }
  }

  const b = result?.briefing;

  return (
    <div className="wrap">
      <header>
        <h1>Yanxi</h1>
        <p>
          Civilian open-source research: public Mandarin paste → English briefing with context cards,
          signaling scorecard, kinds/priority triage, claim gates, and whitelist collect/RSS.
          Draft for human review only. Chinese appears only in the source paste and quoted excerpts.
        </p>
        <span className="badge">Not an intelligence product · Public whitelist only · Human review required</span>
        <p className="meta" style={{ marginTop: "0.65rem" }}>
          <a href="/">Reader</a>
          <span> · </span>
          <a href="/portfolio">Portfolio</a>
          <span> · </span>
          <a href="/outbox/portfolio.md" target="_blank" rel="noreferrer">
            portfolio.md
          </a>
        </p>
      </header>

      <div className="grid">
        <section className="panel">
          <label htmlFor="domain">Job-fit domain fixture</label>
          <select
            id="domain"
            value={domainId}
            onChange={(e) => {
              loadDomain(e.target.value).catch((err) =>
                setError(err instanceof Error ? err.message : String(err))
              );
            }}
          >
            <option value="">— select domain pack —</option>
            {domainGroups.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.rows.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.domain} · {d.id}
                    {(d.hotThemes || []).length
                      ? ` · ${(d.hotThemes || []).map((t) => t.label_en || t.id).join(", ")}`
                      : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {hotThemeCatalog.length ? (
            <p className="meta desk-line">
              Hot topics channel tracks:{" "}
              {hotThemeCatalog.map((t) => t.label_en || t.id).join(" · ")}. Matching pastes route to the
              Hot topics desk and show theme chips on the brief.
            </p>
          ) : null}
          <div className="guided-examples">
            <p className="meta">New here? Load a guided example instead of pasting blind:</p>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => loadGuidedExample("complete").catch((err) => setError(String(err)))}
              >
                Try a complete example
              </button>
              <span className="meta">two sources, dated → reaches brief_quality=complete</span>
            </div>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => loadGuidedExample("defer").catch((err) => setError(String(err)))}
              >
                Try a deferred example
              </button>
              <span className="meta">single source, no date, no named body → correctly declined</span>
            </div>
          </div>
          <label htmlFor="src" style={{ marginTop: "0.75rem" }}>
            Public Mandarin source (paste)
          </label>
          {parts ? (
            <div className="source-view" aria-live="polite">
              <span>{parts.before}</span>
              <mark className="quote-hit">{parts.hit}</mark>
              <span>{parts.after}</span>
            </div>
          ) : null}
          <textarea
            id="src"
            value={sourceText}
            onChange={(e) => {
              setSourceText(e.target.value);
              setActiveQuote(null);
              setReviewChoices({});
            }}
          />
          <label htmlFor="label" style={{ marginTop: "0.75rem" }}>
            Source label
          </label>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <label htmlFor="url" style={{ marginTop: "0.5rem" }}>
            Source URL (optional) — makes the citation traceable instead of just a text label
          </label>
          <input
            id="url"
            type="url"
            placeholder="https://..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
          <label htmlFor="src2" style={{ marginTop: "0.75rem" }}>
            Second public source (optional) — same subject, different issuer → real corroboration
          </label>
          <textarea
            id="src2"
            value={source2Text}
            placeholder="Paste a second public excerpt (implementing notice, local restatement, wire). Leave empty for single-source."
            onChange={(e) => setSource2Text(e.target.value)}
            rows={5}
          />
          <label htmlFor="label2" style={{ marginTop: "0.5rem" }}>
            Second source label
          </label>
          <input id="label2" value={source2Label} onChange={(e) => setSource2Label(e.target.value)} />
          <label htmlFor="url2" style={{ marginTop: "0.5rem" }}>
            Second source URL (optional)
          </label>
          <input
            id="url2"
            type="url"
            placeholder="https://..."
            value={source2Url}
            onChange={(e) => setSource2Url(e.target.value)}
          />
          <label htmlFor="pubdate" style={{ marginTop: "0.75rem" }}>
            Source date (optional, YYYY-MM-DD) — used when the paste has no dateline
          </label>
          <input
            id="pubdate"
            type="date"
            value={sourcePublishedAt}
            onChange={(e) => setSourcePublishedAt(e.target.value)}
          />
          <div className="row">
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={markSocial}
                onChange={(e) => setMarkSocial(e.target.checked)}
              />
              Mark as social commentary (down-weight)
            </label>
            <button type="button" onClick={() => run()} disabled={loading}>
              {loading ? "Running…" : "Generate briefing"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSourceText(SAMPLE);
                setLabel("sample-xinhua-style-excerpt");
                setActiveQuote(null);
                setResult(null);
              }}
            >
              Reset sample
            </button>
          </div>
          {error ? <p className="bad">{error}</p> : null}
        </section>

        <section className="panel result-panel">
          {!result || !b ? (
            <p className="meta">
              Readable briefing appears here after generate. Click a source quote to highlight it on the left.
            </p>
          ) : (
            <>
              <BriefingNote
                result={result}
                sourceText={sourceText}
                activeQuote={activeQuote}
                onQuoteClick={setActiveQuote}
                reviewChoices={reviewChoices}
                onReviewChange={(id, value) => setReviewChoices((prev) => ({ ...prev, [id]: value }))}
                onApplyReview={() => run()}
                loading={loading}
                savingBrief={savingBrief}
                savedBriefUrl={savedBriefUrl}
                onSaveBrief={() => saveBrief()}
                onCopyMarkdown={() => copyBriefMarkdown()}
                onUseRelated={(jsonFile) => useRelatedAsSecondSource(jsonFile)}
                onMergeRerun={(jsonFile) => mergeRelatedAndRun(jsonFile)}
              />
              <AnalystAppendix result={result} showRaw={showRaw} onToggleRaw={() => setShowRaw((v) => !v)} />
            </>
          )}
        </section>
      </div>

      <section className="panel subs">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Subscriptions (whitelist collect → English brief → RSS)</h2>
          <button type="button" className="secondary" onClick={() => runCollect()} disabled={collecting}>
            {collecting ? "Collecting…" : "Run collect now"}
          </button>
        </div>
        <p className="meta">
          Configure <code>config/subscriptions.json</code>. Fetch SSRF via GrantWright{" "}
          <code>urlSafety</code>. See <code>docs/COLLECT.md</code>.
        </p>
        <ul className="sublist">
          {subs.map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong>
              <span className="meta"> · {s.scheduleHuman || "manual"}</span>
              <div className="row">
                <a href={s.feedUrl} target="_blank" rel="noreferrer">
                  RSS feed
                </a>
                <button type="button" className="secondary" onClick={() => runCollect(s.id)} disabled={collecting}>
                  Run
                </button>
              </div>
            </li>
          ))}
        </ul>
        {outbox.length > 0 ? (
          <>
            <h3>Recent outbox</h3>
            <p className="meta">
              Sorted Canada-relevant first (named or plausibly implicated), then newest — Canada
              nexus is a core ranking parameter here, not a tie-breaker.
            </p>
            <ul className="sublist">
              {outbox.slice(0, 6).map((row) => (
                <li key={row.id}>
                  <span className={row.gatePassed ? "ok" : "bad"}>{row.gatePassed ? "PASS" : "FAIL"}</span>{" "}
                  {row.canadaNexus === "direct" ? (
                    <span className="nexus-badge nexus-direct">CA</span>
                  ) : row.canadaNexus === "possible" ? (
                    <span className="nexus-badge nexus-possible">CA?</span>
                  ) : null}{" "}
                  <strong>{row.sourceLabel}</strong>
                  <span className="meta"> · {row.createdAt}</span>
                  <div className="row">
                    <a href={row.mdUrl} target="_blank" rel="noreferrer">
                      .md
                    </a>
                    <a href={row.jsonUrl} target="_blank" rel="noreferrer">
                      .json
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <p className="footer">
        Skills in <code>skills/</code>. Reuse notes in <code>vendor/grantwright/README.md</code>. Ethics:{" "}
        <code>docs/ETHICS.md</code>.
      </p>
    </div>
  );
}
