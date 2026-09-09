import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../workspace/WorkspaceContext";
import {
  askQuestion,
  getExploration,
  renameExploration,
  deleteExploration,
  viewDocument,
  type ExplorationDetail,
  type MessageRead,
  type SourceChunk,
} from "../api";
import { formatRelativeTime, useExplorations } from "../explorations/ExplorationsContext";
import { useAppStatus } from "../status/AppStatusContext";
import { mapError } from "../lib/errorMessages";
import { ChevronRightIcon, ExternalLinkIcon, PencilIcon, SendIcon, TrashIcon } from "../components/icons";
import { Notice } from "../components/Notice";
import { ConfirmDialog } from "../components/ConfirmDialog";

const SUGGESTIONS = [
  "How does authentication work?",
  "How is the deployment pipeline structured?",
  "Where are user permissions managed?",
];

const LOADING_STEPS = [
  { key: "searching", label: "Searching knowledge base" },
  { key: "preparing", label: "Preparing evidence" },
  { key: "synthesizing", label: "Synthesizing response" },
] as const;

type LoadingStage = (typeof LOADING_STEPS)[number]["key"] | null;

interface PendingFailure {
  question: string;
  sources: SourceChunk[];
}

function fileType(source: string): string {
  const idx = source.lastIndexOf(".");
  if (idx < 0) return "FILE";
  const ext = source.slice(idx + 1).toUpperCase();
  if (ext === "MD") return "Markdown";
  if (ext === "PDF") return "PDF";
  if (ext === "TXT") return "Text";
  if (ext === "DOCX" || ext === "DOC") return "Word";
  return ext;
}

function relevanceForIndex(index: number): { className: string; label: string } {
  if (index === 0) return { className: "high", label: "High relevance" };
  if (index === 1) return { className: "medium", label: "Relevant" };
  return { className: "supporting", label: "Supporting" };
}

function renderAnswer(text: string, sourceCount: number, onCite: (index: number) => void): ReactNode {
  const paragraphs = text.trim().split(/\n{2,}/).filter(Boolean);
  const list = paragraphs.length > 0 ? paragraphs : [text];

  return list.map((paragraph, pIndex) => (
    <p key={pIndex}>
      {paragraph.split(/(\[\d+\])/g).map((part, i) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (match) {
          const num = Number(match[1]);
          if (num >= 1 && num <= sourceCount) {
            return (
              <button key={i} type="button" className="citation-ref" onClick={() => onCite(num - 1)}>
                [{num}]
              </button>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  ));
}

function RetrievalTrail({ question, sourceCount }: { question: string; sourceCount: number }) {
  return (
    <div className="retrieval-trail">
      <div className="retrieval-step">
        <span className="retrieval-step-index">01</span>
        Your question — <strong>{question}</strong>
      </div>
      <div className="retrieval-step-connector" />
      <div className="retrieval-step">
        <span className="retrieval-step-index">02</span>
        Searched knowledge base
      </div>
      <div className="retrieval-step-connector" />
      <div className="retrieval-step">
        <span className="retrieval-step-index">03</span>
        <strong>{sourceCount}</strong>&nbsp;source{sourceCount === 1 ? "" : "s"} retrieved as evidence
      </div>
      <div className="retrieval-step-connector" />
      <div className="retrieval-step">
        <span className="retrieval-step-index">04</span>
        Answer synthesized
      </div>
    </div>
  );
}

export function ChatPage() {
  const { token } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { summaries, refresh } = useExplorations();
  const { setStatus } = useAppStatus();
  const navigate = useNavigate();
  const { explorationId: explorationIdParam } = useParams<{ explorationId?: string }>();
  const activeId = explorationIdParam ? Number(explorationIdParam) : null;

  const [queryInput, setQueryInput] = useState("");
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);
  const [pendingFailure, setPendingFailure] = useState<PendingFailure | null>(null);

  const [detail, setDetail] = useState<ExplorationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [openTrails, setOpenTrails] = useState<Set<number>>(new Set());
  const [expandedEvidence, setExpandedEvidence] = useState<Record<number, Set<number>>>({});
  const [focusedMessageId, setFocusedMessageId] = useState<number | null>(null);
  const [pendingScroll, setPendingScroll] = useState<number | null>(null);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const evidenceRefs = useRef<(HTMLDivElement | null)[]>([]);

  const isLoading = loadingStage !== null;
  const showingDetail = detail && detail.id === activeId ? detail : null;
  const recent = useMemo(() => summaries.slice(0, 6), [summaries]);

  // The header's status pill reflects real retrieval activity, not a fake indicator.
  useEffect(() => {
    setStatus(isLoading ? "searching" : "ready");
  }, [isLoading, setStatus]);

  // Load the full exploration whenever the active id points somewhere we
  // don't already have loaded (switched via the sidebar, or a fresh visit).
  useEffect(() => {
    if (!token || activeId === null) return;
    if (detail && detail.id === activeId) return;
    let cancelled = false;
    setDetailLoading(true);
    setError(null);
    getExploration(token, activeId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setFocusedMessageId(d.messages.at(-1)?.id ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(mapError(err, "Couldn't load exploration"));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, activeId, detail]);

  useEffect(() => {
    setPendingFailure(null);
    setRenamingTitle(false);
  }, [activeId]);

  // If the user switches workspaces while viewing an exploration that
  // belongs to a different one, it's no longer in scope for this workspace -
  // return to the landing search rather than leave a stale view up.
  useEffect(() => {
    if (detail && activeWorkspaceId !== null && detail.workspace_id !== activeWorkspaceId) {
      navigate("/chat");
    }
  }, [detail, activeWorkspaceId, navigate]);

  useEffect(() => {
    if (pendingScroll === null) return;
    const index = pendingScroll;
    const el = evidenceRefs.current[index];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashIndex(index);
    const timer = setTimeout(() => setFlashIndex((current) => (current === index ? null : current)), 1200);
    setPendingScroll(null);
    return () => clearTimeout(timer);
  }, [pendingScroll, focusedMessageId]);

  async function runQuery(rawQuery: string) {
    const q = rawQuery.trim();
    if (!token || !q || loadingStage) return;
    if (activeId === null && activeWorkspaceId === null) return;
    setError(null);
    setPendingFailure(null);
    setLoadingStage("searching");
    const toPreparing = setTimeout(() => setLoadingStage("preparing"), 500);
    const toSynthesizing = setTimeout(() => setLoadingStage("synthesizing"), 1100);
    try {
      const response = await askQuestion(token, q, activeId, activeId === null ? activeWorkspaceId : null);

      if (response.generation_failed || response.answer === null || response.exploration_id === null) {
        setPendingFailure({ question: q, sources: response.sources });
        return;
      }

      const newMessage: MessageRead = {
        id: response.message_id ?? -Date.now(),
        question: q,
        answer: response.answer,
        sources: response.sources,
        follow_up_questions: response.follow_up_questions,
        created_at: new Date().toISOString(),
      };

      setDetail((prev) =>
        prev && prev.id === response.exploration_id
          ? { ...prev, messages: [...prev.messages, newMessage], updated_at: newMessage.created_at }
          : {
              id: response.exploration_id!,
              title: response.exploration_title ?? q,
              // This branch only runs for a brand-new exploration (prev is
              // null/stale) - it was just created in whatever workspace was
              // active when the request went out. The `?? 0` never actually
              // triggers: runQuery already bails out earlier when both
              // activeId and activeWorkspaceId are null.
              workspace_id: activeWorkspaceId ?? detail?.workspace_id ?? 0,
              created_at: newMessage.created_at,
              updated_at: newMessage.created_at,
              messages: [newMessage],
            }
      );
      if (activeId !== response.exploration_id) {
        // Brand-new exploration - move the URL onto it without leaving the
        // transient empty-landing state in back-history.
        navigate(`/chat/${response.exploration_id}`, { replace: true });
      }
      setFocusedMessageId(newMessage.id);
      setQueryInput("");
      refresh();
    } catch (err) {
      setError(mapError(err, "Couldn't complete that search"));
    } finally {
      clearTimeout(toPreparing);
      clearTimeout(toSynthesizing);
      setLoadingStage(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    runQuery(queryInput);
  }

  function toggleTrail(messageId: number) {
    setOpenTrails((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  async function handleOpenSource(source: SourceChunk) {
    if (!token || source.document_id === null) return;
    try {
      await viewDocument(token, source.document_id, source.page);
    } catch (err) {
      setError(mapError(err, "Couldn't open document"));
    }
  }

  function toggleEvidence(messageId: number, index: number) {
    setExpandedEvidence((prev) => {
      const set = new Set(prev[messageId] ?? []);
      if (set.has(index)) set.delete(index);
      else set.add(index);
      return { ...prev, [messageId]: set };
    });
  }

  function focusCitation(messageId: number, index: number) {
    setExpandedEvidence((prev) => {
      const set = new Set(prev[messageId] ?? []);
      set.add(index);
      return { ...prev, [messageId]: set };
    });
    setFocusedMessageId(messageId);
    setPendingScroll(index);
  }

  function startRenameTitle() {
    if (!showingDetail) return;
    setTitleDraft(showingDetail.title);
    setRenamingTitle(true);
  }

  async function commitRenameTitle() {
    const title = titleDraft.trim();
    setRenamingTitle(false);
    if (!token || !showingDetail || !title || title === showingDetail.title) return;
    try {
      await renameExploration(token, showingDetail.id, title);
      setDetail((prev) => (prev ? { ...prev, title } : prev));
      refresh();
    } catch (err) {
      setError(mapError(err, "Couldn't rename exploration"));
    }
  }

  function handleTitleRenameSubmit(event: FormEvent) {
    event.preventDefault();
    commitRenameTitle();
  }

  function handleTitleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setRenamingTitle(false);
  }

  async function confirmDeleteExploration() {
    if (!token || !showingDetail) return;
    setDeleting(true);
    try {
      await deleteExploration(token, showingDetail.id);
      refresh();
      setConfirmingDelete(false);
      setDetail(null);
      navigate("/chat");
    } catch (err) {
      setError(mapError(err, "Couldn't delete exploration"));
    } finally {
      setDeleting(false);
    }
  }

  const focusedMessage = showingDetail
    ? (showingDetail.messages.find((m) => m.id === focusedMessageId) ?? showingDetail.messages.at(-1) ?? null)
    : null;

  const showLanding = activeId === null && !isLoading && !pendingFailure && !detailLoading;

  return (
    <div className={showLanding ? "page" : "explore-page"}>
      {showLanding && (
        <>
          <div className="search-hero">
            <span className="eyebrow">Knowledge explorer</span>
            <h1 className="heading-display">Trace information across your organization's knowledge.</h1>

            <form onSubmit={handleSubmit}>
              <div className="search-input-wrap">
                <input
                  id="knowledge-search-input"
                  type="text"
                  placeholder="Search internal knowledge"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="search-input-submit" disabled={!queryInput.trim() || isLoading || (activeId === null && activeWorkspaceId === null)}>
                  <SendIcon width={17} height={17} />
                </button>
              </div>
            </form>

            <div className="search-suggestions">
              <p className="search-suggestions-label">Try exploring</p>
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className="suggestion-item" onClick={() => runQuery(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
          )}

          {recent.length > 0 && (
            <div className="recent-explorations-section">
              <span className="eyebrow">Recent explorations</span>
              <div className="recent-list">
                {recent.map((item) => (
                  <button key={item.id} type="button" className="recent-row" onClick={() => navigate(`/chat/${item.id}`)}>
                    <span>{item.title}</span>
                    <span className="recent-row-time">Last explored {formatRelativeTime(item.updated_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!showLanding && (
        <>
          <div className="explore-search-bar">
            <form onSubmit={handleSubmit}>
              <div className="search-input-wrap compact">
                <input
                  type="text"
                  placeholder={showingDetail ? "Ask a follow-up question..." : "Ask a question..."}
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="search-input-submit" disabled={!queryInput.trim() || isLoading || (activeId === null && activeWorkspaceId === null)}>
                  {isLoading ? <span className="spinner" /> : <SendIcon width={16} height={16} />}
                </button>
              </div>
            </form>
          </div>

          {error && (
            <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
          )}
          {detailLoading && !showingDetail && <p className="loading-note">Loading exploration…</p>}

          <div className="explore-workspace">
            <div className="explore-main">
              {showingDetail && (
                <>
                  <div className="exploration-header">
                    {renamingTitle ? (
                      <form className="rename-form" onSubmit={handleTitleRenameSubmit}>
                        <input
                          className="rename-input"
                          value={titleDraft}
                          autoFocus
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onBlur={commitRenameTitle}
                          onKeyDown={handleTitleRenameKeyDown}
                        />
                      </form>
                    ) : (
                      <span className="eyebrow exploration-header-title">
                        {showingDetail.title}
                        <span className="row-actions">
                          <button type="button" className="icon-button" aria-label="Rename exploration" onClick={startRenameTitle}>
                            <PencilIcon width={13} height={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-button row-action-danger"
                            aria-label="Delete exploration"
                            onClick={() => setConfirmingDelete(true)}
                          >
                            <TrashIcon width={13} height={13} />
                          </button>
                        </span>
                      </span>
                    )}
                    <span className="exploration-header-meta">
                      {showingDetail.messages.length} question{showingDetail.messages.length === 1 ? "" : "s"} ·{" "}
                      {showingDetail.messages.reduce((sum, m) => sum + m.sources.length, 0)} sources
                    </span>
                  </div>

                  {showingDetail.messages.map((m, mi) => (
                    <div className="qa-block" key={m.id}>
                      <div className="question-block">
                        <span className="qa-question-index">{String(mi + 1).padStart(2, "0")} / Question</span>
                        <h2 className="qa-question-text">{m.question}</h2>
                      </div>

                      <div className="answer-block-header">
                        <span className="eyebrow">Answer</span>
                        {m.sources.length > 0 && (
                          <button type="button" className="retrieval-trail-toggle" onClick={() => toggleTrail(m.id)}>
                            {openTrails.has(m.id) ? "Hide retrieval trail" : "View retrieval trail"}
                          </button>
                        )}
                      </div>

                      {openTrails.has(m.id) && <RetrievalTrail question={m.question} sourceCount={m.sources.length} />}

                      <div className="answer-text">
                        {renderAnswer(m.answer, m.sources.length, (i) => focusCitation(m.id, i))}
                      </div>

                      {m.sources.length > 0 && (
                        <button
                          type="button"
                          className="evidence-summary-link"
                          onClick={() => setFocusedMessageId(m.id)}
                        >
                          Evidence — {m.sources.length} source{m.sources.length === 1 ? "" : "s"}
                        </button>
                      )}

                      {m.follow_up_questions.length > 0 && (
                        <div className="continue-exploring">
                          <span className="continue-exploring-label">Continue exploring</span>
                          <div className="continue-exploring-chips">
                            {m.follow_up_questions.map((q) => (
                              <button key={q} type="button" className="continue-chip" onClick={() => runQuery(q)}>
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {mi < showingDetail.messages.length - 1 && <div className="qa-divider" />}
                    </div>
                  ))}
                </>
              )}

              {isLoading && (
                <div className="loading-sequence">
                  {LOADING_STEPS.map((step, i) => {
                    const currentIndex = LOADING_STEPS.findIndex((s) => s.key === loadingStage);
                    return (
                      <div key={step.key} className={i <= currentIndex ? "loading-step active" : "loading-step"}>
                        <span className="loading-step-dot" />
                        {step.label}
                      </div>
                    );
                  })}
                </div>
              )}

              {pendingFailure && (
                <div className="qa-block">
                  <div className="question-block">
                    <span className="eyebrow">Question</span>
                    <h2 className="qa-question-text">{pendingFailure.question}</h2>
                  </div>
                  <Notice
                    type="warning"
                    title="Answer generation failed"
                    message="Relevant sources were found, but generating an answer failed. You can try again."
                  >
                    {pendingFailure.sources.length > 0 && (
                      <ul className="notice-source-list">
                        {pendingFailure.sources.map((s, i) => (
                          <li key={i}>
                            {s.source} · page {s.page}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="btn-ghost notice-retry"
                      onClick={() => runQuery(pendingFailure.question)}
                    >
                      Try again
                    </button>
                  </Notice>
                </div>
              )}
            </div>

            {focusedMessage && (
              <aside className="evidence-panel">
                <div className="evidence-header">
                  <span className="eyebrow">Evidence</span>
                  <span className="evidence-count">
                    {focusedMessage.sources.length} source{focusedMessage.sources.length === 1 ? "" : "s"}
                  </span>
                </div>

                {focusedMessage.sources.length === 0 ? (
                  <p className="evidence-empty">Nothing was retrieved to support this answer.</p>
                ) : (
                  <div className="evidence-list">
                    {focusedMessage.sources.map((source, index) => {
                      const relevance = relevanceForIndex(index);
                      const expanded = expandedEvidence[focusedMessage.id]?.has(index) ?? false;
                      return (
                        <div
                          key={index}
                          ref={(el) => {
                            evidenceRefs.current[index] = el;
                          }}
                          className={
                            "evidence-item" + (expanded ? " expanded" : "") + (flashIndex === index ? " flash" : "")
                          }
                        >
                          <div className="evidence-item-header-row">
                            <button
                              type="button"
                              className="evidence-item-header"
                              onClick={() => toggleEvidence(focusedMessage.id, index)}
                            >
                              <span className="evidence-number">{String(index + 1).padStart(2, "0")}</span>
                              <span className="evidence-item-body-col">
                                <span className="evidence-title">{source.source}</span>
                                <span className="evidence-meta">
                                  <span>{fileType(source.source)}</span>
                                  <span>· Page {source.page}</span>
                                </span>
                                <span className="evidence-relevance">
                                  <span className={`evidence-relevance-dot ${relevance.className}`} />
                                  {relevance.label}
                                </span>
                              </span>
                              <ChevronRightIcon className="evidence-chevron" width={15} height={15} />
                            </button>
                            {source.document_id !== null && source.file_available && (
                              <button
                                type="button"
                                className="icon-button evidence-open-link"
                                aria-label={`Open ${source.source} at page ${source.page}`}
                                title="Open source document at this page"
                                onClick={() => handleOpenSource(source)}
                              >
                                <ExternalLinkIcon width={14} height={14} />
                              </button>
                            )}
                          </div>
                          {expanded && <div className="evidence-body">{source.text}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </aside>
            )}
          </div>
        </>
      )}

      {confirmingDelete && showingDetail && (
        <ConfirmDialog
          title="Delete this exploration?"
          message={`"${showingDetail.title}" and its ${showingDetail.messages.length} question${showingDetail.messages.length === 1 ? "" : "s"} will be permanently deleted. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={confirmDeleteExploration}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
