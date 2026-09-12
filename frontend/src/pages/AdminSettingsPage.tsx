import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { getSettings, updateSettings, type RagSettings } from "../api";
import { mapError } from "../lib/errorMessages";
import { Notice } from "../components/Notice";

// Mirrors backend/app/schemas/settings.py - keep these in sync.
const TOP_K_MIN = 1;
const TOP_K_MAX = 20;
const CHUNK_SIZE_MIN = 100;
const CHUNK_SIZE_MAX = 2000;
const CHUNK_OVERLAP_MIN = 0;
const CHUNK_OVERLAP_MAX = 500;

export function AdminSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<RagSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);
  const [saved, setSaved] = useState(false);

  const [topK, setTopK] = useState(TOP_K_MIN);
  const [chunkSize, setChunkSize] = useState(CHUNK_SIZE_MIN);
  const [chunkOverlap, setChunkOverlap] = useState(0);
  const [ocrEnabled, setOcrEnabled] = useState(true);

  useEffect(() => {
    if (!token) return;
    getSettings(token)
      .then((s) => {
        setSettings(s);
        setTopK(s.default_top_k);
        setChunkSize(s.chunk_size);
        setChunkOverlap(s.chunk_overlap);
        setOcrEnabled(s.ocr_enabled);
      })
      .catch((err) => setError(mapError(err, "Couldn't load settings")))
      .finally(() => setLoading(false));
  }, [token]);

  const overlapTooLarge = chunkOverlap >= chunkSize;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || overlapTooLarge) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateSettings(token, {
        default_top_k: topK,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        ocr_enabled: ocrEnabled,
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(mapError(err, "Couldn't save settings"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <span className="eyebrow">Admin</span>
          <h1 className="heading-display">RAG settings</h1>
        </div>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Admin</span>
        <h1 className="heading-display">RAG settings</h1>
        <p>Controls retrieval and ingestion for every workspace. Changes apply to the next question or upload.</p>
      </div>

      {error && (
        <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
      )}
      {saved && !error && <Notice type="success" title="Saved" message="Settings updated." onDismiss={() => setSaved(false)} />}

      <form onSubmit={handleSubmit}>
        <div className="admin-section">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label htmlFor="top-k">Default top-K</label>
              <input
                id="top-k"
                type="number"
                min={TOP_K_MIN}
                max={TOP_K_MAX}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
              />
              <p className="admin-field-hint">
                {TOP_K_MIN}–{TOP_K_MAX} sources retrieved per question
              </p>
            </div>
            <div className="admin-field">
              <label htmlFor="chunk-size">Chunk size</label>
              <input
                id="chunk-size"
                type="number"
                min={CHUNK_SIZE_MIN}
                max={CHUNK_SIZE_MAX}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
              />
              <p className="admin-field-hint">
                {CHUNK_SIZE_MIN}–{CHUNK_SIZE_MAX} characters per chunk
              </p>
            </div>
            <div className="admin-field">
              <label htmlFor="chunk-overlap">Chunk overlap</label>
              <input
                id="chunk-overlap"
                type="number"
                min={CHUNK_OVERLAP_MIN}
                max={CHUNK_OVERLAP_MAX}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
              />
              <p className="admin-field-hint">
                {overlapTooLarge ? "Must be smaller than chunk size" : `${CHUNK_OVERLAP_MIN}–${CHUNK_OVERLAP_MAX} characters`}
              </p>
            </div>
          </div>

          <div className="admin-toggle-row">
            <div>
              <div className="admin-toggle-row-label">OCR for scanned documents</div>
              <div className="admin-toggle-row-hint">Falls back to Tesseract when a PDF page has no extractable text.</div>
            </div>
            <label className="switch">
              <input type="checkbox" checked={ocrEnabled} onChange={(e) => setOcrEnabled(e.target.checked)} />
              <span className="switch-track" />
            </label>
          </div>
        </div>

        <button type="submit" disabled={saving || overlapTooLarge}>
          {saving ? <span className="spinner" /> : "Save changes"}
        </button>
      </form>

      {settings && <p className="loading-note">Last updated {new Date(settings.updated_at).toLocaleString()}</p>}
    </div>
  );
}
