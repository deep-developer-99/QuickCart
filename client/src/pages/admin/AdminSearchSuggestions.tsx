import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  DEFAULT_DELETING_SPEED, DEFAULT_DISPLAY_DURATION, DEFAULT_TYPING_SPEED, getSearchPhrases, normalizeSearchPhrase,
} from "../../components/common/searchPlaceholder";
import RotatingSearchPlaceholder from "../../components/common/RotatingSearchPlaceholder";
import {
  createSearchSuggestion, deleteSearchSuggestion, getAdminSearchSuggestions,
  invalidatePublicSearchSuggestions, reorderSearchSuggestions,
  updateSearchSuggestion, updateSearchSuggestionSettings,
  type SearchSuggestion, type SearchSuggestionConfig,
} from "../../services/searchSuggestionService";
import "./AdminSearchSuggestions.css";

const INTERVALS = [1500, 2000, 2500, 3000, 4000, 5000];
const TYPING_SPEEDS = [90, DEFAULT_TYPING_SPEED, 35];
const BACKSPACE_SPEEDS = [65, DEFAULT_DELETING_SPEED, 25];
const SPEED_LABELS = ["Slow", "Normal", "Fast"];
const DEFAULT_SETTINGS = {
  isEnabled: true, rotationInterval: DEFAULT_DISPLAY_DURATION,
  typingSpeedMs: DEFAULT_TYPING_SPEED, deletingSpeedMs: DEFAULT_DELETING_SPEED,
};
const errorText = (error: unknown) => axios.isAxiosError(error)
  ? error.response?.data?.message || "The request could not be completed."
  : error instanceof Error ? error.message : "The request could not be completed.";

const AdminSearchSuggestions = () => {
  const [data, setData] = useState<SearchSuggestionConfig>({ ...DEFAULT_SETTINGS, suggestions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [active, setActive] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const reducedMotion = usePrefersReducedMotion();
  const [previewMotion, setPreviewMotion] = useState(false);

  const refresh = useCallback((loadSettings = false) => getAdminSearchSuggestions()
    .then((response) => {
      setData(response.data);
      if (loadSettings) {
        const { isEnabled, rotationInterval, typingSpeedMs, deletingSpeedMs } = response.data;
        setSettingsDraft({
          isEnabled, rotationInterval,
          typingSpeedMs: typingSpeedMs ?? DEFAULT_TYPING_SPEED,
          deletingSpeedMs: deletingSpeedMs ?? DEFAULT_DELETING_SPEED,
        });
      }
      setError("");
    })
    .catch((requestError) => setError(errorText(requestError)))
    .finally(() => setLoading(false)), []);

  useEffect(() => { void refresh(true); }, [refresh]);

  const reload = (loadSettings = false) => {
    setLoading(true);
    return refresh(loadSettings);
  };

  const activeSuggestions = useMemo(() => data.suggestions.filter((suggestion) => suggestion.isActive !== false), [data.suggestions]);
  const canAnimatePreview = settingsDraft.isEnabled && getSearchPhrases(activeSuggestions).length > 1;
  const persistPublic = () => invalidatePublicSearchSuggestions();
  const resetForm = () => { setPhrase(""); setActive(true); setEditingId(null); setShowForm(false); };

  const savePhrase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = normalizeSearchPhrase(phrase);
    if (!trimmed) { setError("Enter a search phrase."); return; }
    if (data.suggestions.some((item) => item._id !== editingId && normalizeSearchPhrase(item.phrase).normalize("NFC").toLowerCase() === trimmed.normalize("NFC").toLowerCase())) {
      setError("That phrase already exists."); return;
    }
    setSaving(true); setError(""); setFeedback("");
    try {
      if (editingId) await updateSearchSuggestion(editingId, { phrase: trimmed, isActive: active });
      else await createSearchSuggestion({ phrase: trimmed, isActive: active });
      resetForm(); await reload(); persistPublic(); setFeedback(editingId ? "Suggestion updated." : "Suggestion added.");
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setSaving(false); }
  };

  const beginEdit = (suggestion: SearchSuggestion) => {
    setEditingId(suggestion._id); setPhrase(suggestion.phrase); setActive(suggestion.isActive !== false); setError(""); setFeedback("");
  };

  const toggleActive = async (suggestion: SearchSuggestion) => {
    setError(""); setFeedback("");
    try { await updateSearchSuggestion(suggestion._id, { isActive: suggestion.isActive === false }); await reload(); persistPublic(); setFeedback("Suggestion status updated."); }
    catch (requestError) { setError(errorText(requestError)); }
  };

  const remove = async (suggestion: SearchSuggestion) => {
    if (!window.confirm(`Delete “${suggestion.phrase}”?`)) return;
    setError(""); setFeedback("");
    try { await deleteSearchSuggestion(suggestion._id); if (editingId === suggestion._id) resetForm(); await reload(); persistPublic(); setFeedback("Suggestion deleted."); }
    catch (requestError) { setError(errorText(requestError)); }
  };

  const saveOrder = async (ordered: SearchSuggestion[]) => {
    setData((current) => ({ ...current, suggestions: ordered }));
    try { const response = await reorderSearchSuggestions(ordered.map((item) => item._id)); setData(response.data); persistPublic(); setFeedback("Suggestion order saved."); setError(""); }
    catch (requestError) { setError(errorText(requestError)); await reload(); }
  };

  const saveSettings = async () => {
    setSaving(true); setError(""); setFeedback("");
    try { await updateSearchSuggestionSettings(settingsDraft); await reload(true); persistPublic(); setFeedback("Rotation settings saved."); }
    catch (requestError) { setError(errorText(requestError)); }
    finally { setSaving(false); }
  };

  const handleDrop = (target: SearchSuggestion) => {
    if (!draggedId || draggedId === target._id) return;
    const ordered = [...data.suggestions];
    const from = ordered.findIndex((item) => item._id === draggedId);
    const to = ordered.findIndex((item) => item._id === target._id);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1); ordered.splice(to, 0, moved);
    setDraggedId(null); void saveOrder(ordered);
  };

  const dialogFocus = useDialogFocus<HTMLElement>(showForm, () => { resetForm(); });

  return (
    <div className="admin-search-suggestions">
      <header className="ass-header"><div><span className="ass-eyebrow">QUICKCART ADMIN</span><h1>Search Suggestions</h1><p>Manage the rotating search suggestions displayed on your website.</p></div></header>
      <section className="ass-stats" aria-label="Suggestion totals">
        <article><span>Total suggestions</span><strong>{data.suggestions.length}</strong></article>
        <article><span>Active suggestions</span><strong>{activeSuggestions.length}</strong></article>
        <article><span>Inactive suggestions</span><strong>{data.suggestions.length - activeSuggestions.length}</strong></article>
      </section>
      {feedback && <div className="ass-message success" role="status">{feedback}</div>}
      {error && <div className="ass-message error" role="alert">{error}</div>}

      <div className="ass-grid">
        <section className="ass-card ass-list-card">
          <div className="ass-card-heading"><div><h2>Manage phrases</h2><p>Drag a row to change the display order.</p></div><button type="button" className="ass-secondary" onClick={() => { resetForm(); setShowForm(true); setError(""); }}>Add suggestion</button></div>
          {loading ? <p className="ass-empty">Loading suggestions…</p> : data.suggestions.length === 0 ? <p className="ass-empty">No suggestions yet. Add a phrase to begin.</p> : (
            <ol className="ass-items">
              {data.suggestions.map((item, itemIndex) => <li key={item._id} draggable onDragStart={() => setDraggedId(item._id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(item)} className={draggedId === item._id ? "dragging" : ""}>
                <span className="ass-grip" aria-label="Drag to reorder">⠿</span><span className="ass-order">{itemIndex + 1}</span><span className="ass-phrase">{item.phrase}</span><span className={`ass-status${item.isActive === false ? " inactive" : ""}`}>{item.isActive === false ? "Inactive" : "Active"}</span>
                <div className="ass-row-actions"><button type="button" onClick={() => toggleActive(item)}>{item.isActive === false ? "Enable" : "Disable"}</button><button type="button" onClick={() => { beginEdit(item); setShowForm(true); }}>Edit</button><button type="button" className="danger" onClick={() => void remove(item)}>Delete</button></div>
              </li>)}
            </ol>
          )}
        </section>

        {showForm && <div className="ass-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetForm(); }}><section {...dialogFocus} className="ass-modal" role="dialog" aria-modal="true" aria-labelledby="ass-form-title"><div className="ass-modal-heading"><div><h2 id="ass-form-title">{editingId ? "Edit search suggestion" : "Add search suggestion"}</h2><p>Enter only the search term, such as fresh fruits. Use up to 100 characters.</p></div><button type="button" className="ass-close" aria-label="Close" onClick={resetForm}>×</button></div><form className="ass-form" onSubmit={savePhrase}>
            <label htmlFor="ass-phrase">Search phrase</label>
            <input id="ass-phrase" value={phrase} maxLength={100} placeholder="e.g. fresh fruits" onChange={(event) => setPhrase(event.target.value)} required />
            <label className="ass-check"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
            <div className="ass-form-actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add suggestion"}</button><button type="button" className="ass-cancel" onClick={resetForm}>Cancel</button></div>
          </form></section></div>}

        <div className="ass-side-column">
          <section className="ass-card ass-settings">
            <h2>Rotation settings</h2><p>Set how long each complete phrase stays visible before it is erased.</p>
            <label className="ass-check"><input type="checkbox" checked={settingsDraft.isEnabled} onChange={(event) => setSettingsDraft((current) => ({ ...current, isEnabled: event.target.checked }))} /> Enable animated suggestions</label>
            <label className="ass-interval" htmlFor="ass-interval">Display duration</label>
            <select id="ass-interval" value={settingsDraft.rotationInterval} onChange={(event) => setSettingsDraft((current) => ({ ...current, rotationInterval: Number(event.target.value) }))}>
              {!INTERVALS.includes(settingsDraft.rotationInterval) && (
                <option value={settingsDraft.rotationInterval}>{settingsDraft.rotationInterval / 1000} seconds</option>
              )}
              {INTERVALS.map((interval) => <option key={interval} value={interval}>{interval / 1000} seconds</option>)}
            </select>
            {([
              ["typingSpeedMs", "Typing speed", TYPING_SPEEDS],
              ["deletingSpeedMs", "Backspace speed", BACKSPACE_SPEEDS],
            ] as const).map(([field, label, speeds]) => (
              <label className="ass-speed" key={field}>
                <span className="ass-interval">{label}</span>
                <select value={settingsDraft[field]} onChange={(event) => setSettingsDraft((current) => ({ ...current, [field]: Number(event.target.value) }))}>
                  {!speeds.includes(settingsDraft[field]) && <option value={settingsDraft[field]}>Custom</option>}
                  {speeds.map((speed, index) => <option key={speed} value={speed}>{SPEED_LABELS[index]}</option>)}
                </select>
              </label>
            ))}
            <button type="button" onClick={() => void saveSettings()} disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
          </section>
          <section className="ass-card ass-preview">
            <h2>Live preview</h2><p>Preview active phrases with your current settings before saving.</p>
            <div className="ass-preview-field">
              <span className="ass-search-icon" aria-hidden="true">⌕</span>
              <RotatingSearchPlaceholder {...settingsDraft} suggestions={activeSuggestions} paused={showForm} previewMotion={reducedMotion && previewMotion} />
            </div>
            {reducedMotion && (
              <div className="ass-preview-motion">
                <p role="status">Your browser requests reduced motion. {previewMotion && canAnimatePreview
                  ? "Full motion is playing in this preview only."
                  : "The preview uses a static phrase by default."}</p>
                {canAnimatePreview && (
                  <button type="button" className="ass-secondary" onClick={() => setPreviewMotion((playing) => !playing)}>
                    {previewMotion ? "Stop full-motion preview" : "Play full-motion preview"}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminSearchSuggestions;
