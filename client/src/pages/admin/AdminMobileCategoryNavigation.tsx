import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteUnusedMobileNavigationIcon, getAdminMobileNavigation, saveAdminMobileNavigation, uploadMobileNavigationIcon, type NavigationCategory, type NavigationItem } from "../../services/mobileCategoryNavigationService";
import "./AdminMobileCategoryNavigation.css";

const comparable = (items: NavigationItem[]) => JSON.stringify(items.map(({ categoryId, displayName, icon, iconPublicId, isActive }) => ({ categoryId, displayName, icon, iconPublicId, isActive })));
const errorText = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || "Request failed." : error instanceof Error ? error.message : "Request failed.";

export default function AdminMobileCategoryNavigation() {
  const [revision, setRevision] = useState(0);
  const [categories, setCategories] = useState<NavigationCategory[]>([]);
  const [saved, setSaved] = useState<NavigationItem[]>([]);
  const [draft, setDraft] = useState<NavigationItem[]>([]);
  const [search, setSearch] = useState("");
  const [activePreview, setActivePreview] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pendingIcons = useRef(new Set<string>());
  const clearPendingIcons = useCallback((retained = new Set<string>()) => {
    const unused = [...pendingIcons.current].filter(id => !retained.has(id));
    pendingIcons.current.clear();
    void Promise.allSettled(unused.map(id => deleteUnusedMobileNavigationIcon(id)));
  }, []);
  useEffect(() => () => clearPendingIcons(), [clearPendingIcons]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminMobileNavigation();
      setRevision(data.revision);
      setCategories(data.categories);
      setSaved(data.items);
      setDraft(data.items);
      setError("");
    } catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const dirty = comparable(saved) !== comparable(draft);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const selected = useMemo(() => new Set(draft.map(item => item.categoryId)), [draft]);
  const available = categories.filter(category => category.name.toLowerCase().includes(search.trim().toLowerCase()));
  const update = (id: string, patch: Partial<NavigationItem>) => { setDraft(items => items.map(item => item.categoryId === id ? { ...item, ...patch } : item)); setMessage(""); };
  const reorder = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft]; [next[index], next[target]] = [next[target], next[index]];
    setDraft(next.map((item, displayOrder) => ({ ...item, displayOrder })));
    setMessage("");
  };
  const save = async () => {
    if (draft.some(item => item.displayName.trim().length > 40)) { setError("Display names must be 40 characters or less."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const data = await saveAdminMobileNavigation(revision, draft);
      setRevision(data.revision); setSaved(data.items); setDraft(data.items); setCategories(data.categories);
      clearPendingIcons(new Set(data.items.map(item => item.iconPublicId).filter((id): id is string => Boolean(id))));
      setMessage("Mobile navigation saved.");
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  };
  const uploadIcon = async (categoryId: string, file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Icon must be JPG, PNG or WEBP and 5 MB or smaller."); return; }
    setUploading(true); setError("");
    try { const uploaded = await uploadMobileNavigationIcon(file); pendingIcons.current.add(uploaded.iconPublicId); update(categoryId, uploaded); }
    catch (cause) { setError(errorText(cause)); }
    finally { setUploading(false); }
  };

  return <main className="mcn-page">
    <header className="mcn-header"><div><h1>Mobile Category Navigation</h1><p>Choose existing main categories and their order on the mobile homepage.</p></div><div className="mcn-actions"><button type="button" disabled={!dirty || saving || uploading} onClick={() => { clearPendingIcons(); setDraft(saved); }}>Discard</button><button type="button" disabled={!dirty || saving || uploading} onClick={() => void save()}>{saving ? "Saving…" : "Save configuration"}</button></div></header>
    {dirty && <p className="mcn-notice">Unsaved changes. The preview shows your draft.</p>}
    {error && <p role="alert" className="mcn-error">{error} <button type="button" onClick={() => void load()}>Reload</button></p>}
    {message && <p role="status" className="mcn-success">{message}</p>}
    {loading ? <p>Loading navigation…</p> : <>
      <section className="mcn-panel"><h2>Mobile preview</h2><div className="mcn-preview"><button type="button" className={activePreview === "all" ? "active" : ""} onClick={() => setActivePreview("all")}><span>🛒</span>All</button>{draft.filter(item => item.isActive && item.category?.isActive).map(item => <button type="button" key={item.categoryId} className={activePreview === item.categoryId ? "active" : ""} onClick={() => setActivePreview(item.categoryId)}>{item.icon || item.category?.image ? <img src={item.icon || item.category?.image} alt="" /> : <span>🛍️</span>}{item.displayName || item.category?.name}</button>)}</div></section>
      <div className="mcn-columns"><section className="mcn-panel"><h2>Available categories</h2><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search categories" aria-label="Search categories" />{available.length ? <ul>{available.map(category => <li key={category._id}><span>{category.image ? <img src={category.image} alt="" /> : "🛍️"}{category.name}</span><button type="button" disabled={selected.has(category._id)} onClick={() => { setDraft(items => [...items, { categoryId: category._id, category, displayName: "", icon: "", isActive: true, displayOrder: items.length }]); setMessage(""); }}>Add</button></li>)}</ul> : <p>No matching categories.</p>}</section>
      <section className="mcn-panel"><h2>Configured order</h2>{draft.length ? <ol>{draft.map((item, index) => <li key={item.categoryId}><div className="mcn-item-head"><strong>{index + 1}. {item.category?.name || "Unavailable category"}</strong><div><button type="button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${item.category?.name} up`}>↑</button><button type="button" disabled={index === draft.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${item.category?.name} down`}>↓</button><button type="button" onClick={() => { if (window.confirm(`Remove ${item.category?.name || "this item"} from mobile navigation? The category and products will remain.`)) setDraft(items => items.filter(row => row.categoryId !== item.categoryId)); }}>Remove</button></div></div><div className="mcn-fields"><label>Display name<input value={item.displayName} maxLength={40} onChange={event => update(item.categoryId, { displayName: event.target.value })} placeholder={item.category?.name || "Category name"} /></label><label>Custom icon URL<input type="url" value={item.icon} onChange={event => update(item.categoryId, { icon: event.target.value, iconPublicId: "" })} placeholder="Uses category image by default" /></label><label>Upload icon<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={event => void uploadIcon(item.categoryId, event.target.files?.[0])} /></label><label className="mcn-check"><input type="checkbox" checked={item.isActive} onChange={event => update(item.categoryId, { isActive: event.target.checked })} />Enabled</label></div></li>)}</ol> : <p>No categories configured. All remains available in the app.</p>}</section></div>
    </>}
  </main>;
}
