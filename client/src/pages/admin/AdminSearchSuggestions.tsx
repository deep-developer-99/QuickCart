import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchSuggestions } from "../../hooks/useSearchSuggestions";
import RotatingSearchPlaceholder from "../../components/common/RotatingSearchPlaceholder";
import {
  createSearchSuggestion, deleteSearchSuggestion, getAdminSearchSuggestions,
  invalidatePublicSearchSuggestions, reorderSearchSuggestions,
  updateSearchSuggestion, updateSearchSuggestionSettings,
  type SearchSuggestion, type SearchSuggestionConfig,
} from "../../services/searchSuggestionService";
import "./AdminSearchSuggestions.css";

const INTERVALS = [1500, 2000, 2500, 3000, 4000, 5000];
const errorText = (error: unknown) => axios.isAxiosError(error)
  ? error.response?.data?.message || "The request could not be completed."
  : error instanceof Error ? error.message : "The request could not be completed.";

const AdminSearchSuggestions = () => {
  const [data, setData] = useState<SearchSuggestionConfig>({ isEnabled: true, rotationInterval: 2500, suggestions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [active, setActive] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({ isEnabled: true, rotationInterval: 2500 });
  const { index } = useSearchSuggestions();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAdminSearchSuggestions();
      setData(response.data);
      setSettingsDraft({ isEnabled: response.data.isEnabled, rotationInterval: response.data.rotationInterval });
      setError("");
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeSuggestions = useMemo(() => data.suggestions.filter((suggestion) => suggestion.isActive !== false), [data.suggestions]);
  const persistPublic = () => invalidatePublicSearchSuggestions();
  const resetForm = () => { setPhrase(""); setActive(true); setEditingId(null); setShowForm(false); };

  const savePhrase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = phrase.trim();
    if (!trimmed) { setError("Enter a search phrase."); return; }
    if (data.suggestions.some((item) => item._id !== editingId && item.phrase.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setError("That phrase already exists."); return;
    }
    setSaving(true); setError(""); setFeedback("");
    try {
      if (editingId) await updateSearchSuggestion(editingId, { phrase: trimmed, isActive: active });
      else await createSearchSuggestion({ phrase: trimmed, isActive: active });
      resetForm(); await refresh(); persistPublic(); setFeedback(editingId ? "Suggestion updated." : "Suggestion added.");
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setSaving(false); }
  };

  const beginEdit = (suggestion: SearchSuggestion) => {
    setEditingId(suggestion._id); setPhrase(suggestion.phrase); setActive(suggestion.isActive !== false); setError(""); setFeedback("");
  };

  const toggleActive = async (suggestion: SearchSuggestion) => {
    setError(""); setFeedback("");
    try { await updateSearchSuggestion(suggestion._id, { isActive: suggestion.isActive === false }); await refresh(); persistPublic(); setFeedback("Suggestion status updated."); }
    catch (requestError) { setError(errorText(requestError)); }
  };

  const remove = async (suggestion: SearchSuggestion) => {
    if (!window.confirm(`Delete “${suggestion.phrase}”?`)) return;
    setError(""); setFeedback("");
    try { await deleteSearchSuggestion(suggestion._id); if (editingId === suggestion._id) resetForm(); await refresh(); persistPublic(); setFeedback("Suggestion deleted."); }
    catch (requestError) { setError(errorText(requestError)); }
  };

  const saveOrder = async (ordered: SearchSuggestion[]) => {
    setData((current) => ({ ...current, suggestions: ordered }));
    try { const response = await reorderSearchSuggestions(ordered.map((item) => item._id)); setData(response.data); persistPublic(); setFeedback("Suggestion order saved."); setError(""); }
    catch (requestError) { setError(errorText(requestError)); await refresh(); }
  };

  const saveSettings = async () => {
    setSaving(true); setError(""); setFeedback("");
    try { await updateSearchSuggestionSettings(settingsDraft); await refresh(); persistPublic(); setFeedback("Rotation settings saved."); }
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

  return (
    <main className="admin-search-suggestions">
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

        {showForm && <div className="ass-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetForm(); }}><section className="ass-modal" role="dialog" aria-modal="true" aria-labelledby="ass-form-title"><div className="ass-modal-heading"><div><h2 id="ass-form-title">{editingId ? "Edit search suggestion" : "Add search suggestion"}</h2><p>Suggestions can contain up to 100 characters.</p></div><button type="button" className="ass-close" aria-label="Close" onClick={resetForm}>×</button></div><form className="ass-form" onSubmit={savePhrase}>
            <label htmlFor="ass-phrase">Search phrase</label>
            <input id="ass-phrase" value={phrase} maxLength={100} placeholder="e.g. Search for fresh fruits" onChange={(event) => setPhrase(event.target.value)} required />
            <label className="ass-check"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
            <div className="ass-form-actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add suggestion"}</button><button type="button" className="ass-cancel" onClick={resetForm}>Cancel</button></div>
          </form></section></div>}

        <div className="ass-side-column">
          <section className="ass-card ass-settings">
            <h2>Rotation settings</h2><p>Control whether suggestions rotate and how often they change.</p>
            <label className="ass-check"><input type="checkbox" checked={settingsDraft.isEnabled} onChange={(event) => setSettingsDraft((current) => ({ ...current, isEnabled: event.target.checked }))} /> Enable dynamic suggestions</label>
            <label className="ass-interval" htmlFor="ass-interval">Rotation interval</label>
            <select id="ass-interval" value={settingsDraft.rotationInterval} onChange={(event) => setSettingsDraft((current) => ({ ...current, rotationInterval: Number(event.target.value) }))}>
              {INTERVALS.map((interval) => <option key={interval} value={interval}>{(interval / 1000).toFixed(interval % 1000 ? 1 : 0)} seconds ({interval} ms)</option>)}
            </select>
            <button type="button" onClick={() => void saveSettings()} disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
          </section>
          <section className="ass-card ass-preview"><h2>Live preview</h2><p>Preview the active phrases configured for your storefront.</p><div className="ass-preview-field"><span className="ass-search-icon" aria-hidden="true">⌕</span><RotatingSearchPlaceholder suggestions={activeSuggestions} index={index} enabled={settingsDraft.isEnabled} fallback="Search for atta, milk and more" /></div><small>{activeSuggestions.length ? `${activeSuggestions.length} active phrases · ${settingsDraft.rotationInterval} ms interval` : "Static placeholder shown when no active phrases exist."}</small></section>
        </div>
      </div>
    </main>
  );
};

export default AdminSearchSuggestions;
