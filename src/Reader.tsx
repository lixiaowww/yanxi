import { useEffect, useMemo, useState } from "react";
import { ReaderBrief } from "./components/ReaderBrief";
import { ReaderMore } from "./components/ReaderMore";
import { AnalystAppendix } from "./components/AnalystAppendix";
import { getShowAnalystDetails, setShowAnalystDetails } from "./lib/reader-settings";
import type { ApiResult, DeskCatalogRow, OutboxListRow, OutboxRecordJson } from "./lib/briefing-types";

function importanceLabel(grade?: string): string {
  if (!grade) return "—";
  return grade;
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

/**
 * The reading product: a single cross-category waterfall feed, newest
 * first, with desk category shown as a tag per item and an optional
 * filter chip row (not a mandatory pick-a-category-first navigation).
 * Detail view is ReaderBrief (Analysis + Forecast only, each with its own
 * confidence) — no visible What/Context/So what/Outlook pipeline-stage
 * labels. Everything else (source digest, watchpoints, open questions,
 * corroboration, related briefs, policy links, raw pipeline internals)
 * only shows if the reader opts in via the Settings toggle, folded into
 * ReaderMore + AnalystAppendix — never a wall of metadata a reader has to
 * scroll past first. See docs/DP-V3.md §7 (2026-09-22 revision).
 */
export function Reader() {
  const [deskCatalog, setDeskCatalog] = useState<DeskCatalogRow[]>([]);
  const [allRows, setAllRows] = useState<OutboxListRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [selectedDesk, setSelectedDesk] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ result: ApiResult; sourceText: string; mdUrl: string } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAnalyst, setShowAnalyst] = useState(getShowAnalystDetails());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((d) => {
        const desks: DeskCatalogRow[] = d.deskSections || [];
        setDeskCatalog(desks);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    fetch("/api/outbox")
      .then((r) => r.json())
      .then((d) => setAllRows(d.briefs || []))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingRows(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of allRows) {
      const id = r.desk?.id;
      if (id) c[id] = (c[id] || 0) + 1;
    }
    return c;
  }, [allRows]);

  const feed = useMemo(() => {
    return allRows
      .filter((r) => !selectedDesk || r.desk?.id === selectedDesk)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allRows, selectedDesk]);

  function openBrief(row: OutboxListRow) {
    setSelectedId(row.id);
    setDetail(null);
    setLoadingDetail(true);
    setError("");
    fetch(row.jsonUrl)
      .then((r) => r.json())
      .then((rec: OutboxRecordJson) => {
        setDetail({ result: rec.result, sourceText: rec.source.sourceText || "", mdUrl: row.mdUrl });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingDetail(false));
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
  }

  async function copyMarkdown() {
    if (!detail) return;
    try {
      const res = await fetch(detail.mdUrl);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard/network best-effort */
    }
  }

  function toggleAnalystDetails() {
    const next = !showAnalyst;
    setShowAnalyst(next);
    setShowAnalystDetails(next);
  }

  const selectedDeskMeta = deskCatalog.find((d) => d.id === selectedDesk);

  return (
    <div className="reader-wrap">
      <header className="reader-header">
        <h1>Yanxi</h1>
        <div className="reader-header-actions">
          <a className="reader-link" href="/compose">
            + New from paste
          </a>
          <a className="reader-link" href="/portfolio">
            Portfolio
          </a>
          <button type="button" className="ghost" onClick={() => setSettingsOpen((v) => !v)}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <div className="reader-settings">
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={showAnalyst} onChange={toggleAnalystDetails} />
            Show full briefing detail (source digest, watchpoints, corroboration) and analysis internals (mode, gate, triage) when reading a brief
          </label>
          <p className="meta">Off by default — the reading view shows only Analysis and Forecast.</p>
        </div>
      ) : null}

      {error ? <p className="bad">{error}</p> : null}

      <nav className="reader-nav">
        <button
          type="button"
          className={`reader-nav-item ${!selectedDesk ? "active" : ""}`}
          onClick={() => {
            setSelectedDesk("");
            backToList();
          }}
        >
          All
          <span className="reader-nav-count">{allRows.length}</span>
        </button>
        {deskCatalog.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`reader-nav-item ${d.id === selectedDesk ? "active" : ""}`}
            onClick={() => {
              setSelectedDesk(d.id === selectedDesk ? "" : d.id);
              backToList();
            }}
          >
            {d.label_en || d.id}
            <span className="reader-nav-count">{counts[d.id] || 0}</span>
          </button>
        ))}
      </nav>

      <main className="reader-main">
        {selectedId ? (
          <>
            <button type="button" className="ghost reader-back" onClick={backToList}>
              ← Back to feed
            </button>
            {loadingDetail ? <p className="meta">Loading…</p> : null}
            {detail ? (
              <>
                <ReaderBrief result={detail.result} />
                <div className="note-actions">
                  <button type="button" className="ghost" onClick={copyMarkdown}>
                    Copy brief markdown
                  </button>
                  <a href={detail.mdUrl} target="_blank" rel="noreferrer">
                    Open saved .md
                  </a>
                </div>
                {showAnalyst ? (
                  <>
                    <ReaderMore result={detail.result} />
                    <AnalystAppendix result={detail.result} showRaw={false} onToggleRaw={() => {}} />
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            {selectedDeskMeta?.blurb_zh ? <p className="meta reader-desk-blurb">{selectedDeskMeta.blurb_zh}</p> : null}
            {loadingRows ? <p className="meta">Loading…</p> : null}
            {!loadingRows && !feed.length ? (
              <p className="meta">No briefs {selectedDesk ? "in this category" : "yet"}.</p>
            ) : null}
            <ul className="reader-list">
              {feed.map((row) => (
                <li key={row.id}>
                  <button type="button" className="reader-list-item" onClick={() => openBrief(row)}>
                    <div className="reader-list-top">
                      <span className={`reader-importance reader-importance-${row.triage?.importance?.grade || "P4"}`}>
                        {importanceLabel(row.triage?.importance?.grade)}
                      </span>
                      {!selectedDesk && row.desk?.label_en ? (
                        <span className="desk-tag">{row.desk.label_en}</span>
                      ) : null}
                      <span className="reader-list-headline">
                        {row.deferred ? "Deferred — " : !row.adopted ? "Not adopted — " : ""}
                        {row.headline || row.what || row.sourceLabel}
                      </span>
                      {row.canadaNexus === "direct" ? (
                        <span className="nexus-word direct">CA</span>
                      ) : row.canadaNexus === "possible" ? (
                        <span className="nexus-word possible">CA?</span>
                      ) : null}
                    </div>
                    <div className="reader-list-sub">
                      {relativeDate(row.createdAt)}
                      {row.briefQuality ? ` · ${row.briefQuality}` : ""}
                      {row.analysisConfidence ? ` · confidence ${row.analysisConfidence}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <p className="footer">
        Draft for human review · Public sources only · Not an intelligence product
      </p>
    </div>
  );
}
