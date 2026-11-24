import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createAdminMobileBanner, deleteAdminMobileBanner, getAdminMobileBanners,
  getMobileBannerCategories, reorderAdminMobileBanners, searchMobileBannerProducts,
  setAdminMobileBannerStatus, updateAdminMobileBanner,
  type BannerCategory, type BannerProduct, type MobileBanner, type MobileBannerRedirectType,
} from "../../services/mobileBannerService";
import "./AdminMobileBanners.css";

type Form = { redirectType: MobileBannerRedirectType; redirectTarget: string; displayOrder: string; isActive: boolean; startDate: string; endDate: string };
const initialForm: Form = { redirectType: "none", redirectTarget: "", displayOrder: "0", isActive: true, startDate: "", endDate: "" };
const dateValue = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : "";
const requestError = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || "Request failed." : error instanceof Error ? error.message : "Request failed.";
const validImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export default function AdminMobileBanners() {
  const [banners, setBanners] = useState<MobileBanner[]>([]);
  const [categories, setCategories] = useState<BannerCategory[]>([]);
  const [products, setProducts] = useState<BannerProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<MobileBanner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dimensions, setDimensions] = useState("");
  const objectUrl = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, catalog] = await Promise.all([getAdminMobileBanners(), getMobileBannerCategories()]);
      setBanners(items); setCategories(catalog); setError("");
    } catch (cause) { setError(requestError(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    if (!showForm || form.redirectType !== "product") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void searchMobileBannerProducts(productSearch.trim()).then(items => { if (active) setProducts(items); })
        .catch(cause => { if (active) setError(requestError(cause)); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.redirectType, productSearch, showForm]);
  useEffect(() => {
    if (!preview) return;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setDimensions(`${image.naturalWidth} × ${image.naturalHeight} px · ${(image.naturalWidth / image.naturalHeight).toFixed(2)}:1`); };
    image.onerror = () => { if (active) setDimensions("Preview unavailable"); };
    image.src = preview;
    return () => { active = false; };
  }, [preview]);

  const clearPreview = () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; setFile(null); setPreview(""); setDimensions(""); };
  const close = () => { if (busy) return; clearPreview(); setShowForm(false); setEditing(null); setForm(initialForm); };
  const openAdd = () => { clearPreview(); setEditing(null); setForm({ ...initialForm, displayOrder: String(banners.length) }); setError(""); setMessage(""); setShowForm(true); };
  const openEdit = (banner: MobileBanner) => {
    clearPreview(); setEditing(banner); setPreview(banner.image);
    setForm({ redirectType: banner.redirectType, redirectTarget: banner.redirectTarget || "", displayOrder: String(banner.displayOrder), isActive: banner.isActive, startDate: dateValue(banner.startDate), endDate: dateValue(banner.endDate) });
    setError(""); setMessage(""); setShowForm(true);
  };
  const chooseFile = (selected?: File) => {
    if (!selected) return;
    if (!validImageTypes.has(selected.type) || selected.size > 5 * 1024 * 1024) { setError("Use a JPG, PNG or WEBP image no larger than 5 MB."); return; }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(selected); objectUrl.current = url; setFile(selected); setPreview(url); setError("");
  };
  const filtered = useMemo(() => banners.filter(banner => banner.title.toLowerCase().includes(search.trim().toLowerCase())), [banners, search]);
  const subcategories = useMemo(() => categories.flatMap(category => category.subcategories.map(sub => ({ ...sub, parentName: category.name }))), [categories]);
  const productOptions = useMemo(() => {
    if (form.redirectType !== "product" || !form.redirectTarget || products.some(item => item._id === form.redirectTarget)) return products;
    return [{ _id: form.redirectTarget, name: editing?.redirectTarget === form.redirectTarget ? `Current product (${form.redirectTarget})` : form.redirectTarget }, ...products];
  }, [editing, form.redirectTarget, form.redirectType, products]);
  const destinationName = (banner: MobileBanner) => {
    if (banner.redirectType === "none") return "No destination";
    const category = categories.find(item => item._id === banner.redirectTarget);
    const subcategory = subcategories.find(item => item._id === banner.redirectTarget);
    return `${banner.redirectType}: ${category?.name || subcategory?.name || banner.redirectTarget || "Unavailable"}`;
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!editing && !file) { setError("Choose a mobile banner image."); return; }
    if (form.redirectType !== "none" && !form.redirectTarget) { setError("Choose a redirect destination."); return; }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError("End date cannot be earlier than start date."); return; }
    const data = new FormData();
    data.append("redirectType", form.redirectType);
    data.append("redirectTarget", form.redirectType === "none" ? "" : form.redirectTarget);
    data.append("displayOrder", form.displayOrder); data.append("isActive", String(form.isActive));
    data.append("startDate", form.startDate); data.append("endDate", form.endDate);
    if (file) data.append("image", file);
    setBusy(true); setError(""); setMessage("");
    try {
      if (editing) await updateAdminMobileBanner(editing._id, data); else await createAdminMobileBanner(data);
      clearPreview(); setShowForm(false); setEditing(null); setForm(initialForm);
      setMessage(editing ? "Mobile banner updated." : "Mobile banner created."); await load();
    } catch (cause) { setError(requestError(cause)); }
    finally { setBusy(false); }
  };
  const changeStatus = async (banner: MobileBanner) => {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try { await setAdminMobileBannerStatus(banner._id, !banner.isActive); setMessage(banner.isActive ? "Mobile banner deactivated." : "Mobile banner activated."); await load(); }
    catch (cause) { setError(requestError(cause)); } finally { setBusy(false); }
  };
  const remove = async (banner: MobileBanner) => {
    if (busy || !window.confirm(`Delete mobile banner “${banner.title}”? The website banner is unaffected.`)) return;
    setBusy(true); setError(""); setMessage("");
    try { await deleteAdminMobileBanner(banner._id); setMessage("Mobile banner deleted."); await load(); }
    catch (cause) { setError(requestError(cause)); } finally { setBusy(false); }
  };
  const move = async (index: number, direction: -1 | 1) => {
    if (busy || search.trim()) return;
    const target = index + direction; if (target < 0 || target >= banners.length) return;
    const next = [...banners]; [next[index], next[target]] = [next[target], next[index]];
    setBusy(true); setError(""); setMessage("");
    try { await reorderAdminMobileBanners(next.map(item => item._id)); setMessage("Mobile banner order saved."); await load(); }
    catch (cause) { setError(requestError(cause)); } finally { setBusy(false); }
  };

  return <main className="amb-page"><div className="amb-container">
    <header className="amb-header"><div><span>MOBILE HOMEPAGE</span><h1>Mobile App Banners</h1><p>Manage mobile promotions independently from website banners.</p></div><button type="button" onClick={openAdd} disabled={busy}>+ Add mobile banner</button></header>
    {error && <p role="alert" className="amb-message amb-error">{error}</p>}
    {message && <p role="status" className="amb-message amb-success">{message}</p>}
    <label className="amb-search">Search banners by title<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search mobile banners" /></label>
    {loading ? <p>Loading mobile banners…</p> : filtered.length ? <ol className="amb-list">{filtered.map((banner, index) => <li key={banner._id} className="amb-card">
      <img src={banner.image} alt={`${banner.title} banner`} /><div className="amb-card-copy"><h2>{banner.title}</h2><p>Position {banner.displayOrder + 1} · {destinationName(banner)}</p><p>{banner.isActive ? "Active" : "Inactive"} · Updated {new Date(banner.updatedAt).toLocaleDateString("en-IN")}</p></div>
      <div className="amb-card-actions"><button type="button" disabled={busy || Boolean(search.trim()) || index === 0} onClick={() => void move(index, -1)}>Move up</button><button type="button" disabled={busy || Boolean(search.trim()) || index === banners.length - 1} onClick={() => void move(index, 1)}>Move down</button><button type="button" disabled={busy} onClick={() => openEdit(banner)}>Edit</button><button type="button" disabled={busy} onClick={() => void changeStatus(banner)}>{banner.isActive ? "Deactivate" : "Activate"}</button><button type="button" disabled={busy} onClick={() => void remove(banner)}>Delete</button></div>
    </li>)}</ol> : <p className="amb-empty">{search ? "No mobile banners match your search." : "No mobile banners yet. Add one to display it in the app."}</p>}
    {showForm && <div className="amb-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="amb-dialog" role="dialog" aria-modal="true" aria-labelledby="amb-form-title"><div className="amb-dialog-header"><h2 id="amb-form-title">{editing ? "Edit mobile banner" : "Add mobile banner"}</h2><button type="button" onClick={close} disabled={busy} aria-label="Close">×</button></div>
      <form onSubmit={event => void save(event)}>
        <label>Mobile image<input type="file" accept="image/jpeg,image/png,image/webp" required={!editing} onChange={event => chooseFile(event.target.files?.[0])} /><small>JPG, PNG or WEBP, up to 5 MB. Recommended: 1080 × 510, 1080 × 540 or 1080 × 1080 px.</small></label>
        {preview && <div className="amb-preview"><img src={preview} alt="Mobile homepage banner preview" /><p>{dimensions || "Reading image dimensions…"}</p></div>}
        <div className="amb-fields"><label>Destination type<select value={form.redirectType} onChange={event => setForm(current => ({ ...current, redirectType: event.target.value as MobileBannerRedirectType, redirectTarget: "" }))}><option value="none">None</option><option value="category">Category</option><option value="subcategory">Subcategory</option><option value="product">Product</option></select></label>
          {form.redirectType === "product" && <label>Search products<input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search by product name" /></label>}
          {form.redirectType !== "none" && <label>Redirect destination<select required value={form.redirectTarget} onChange={event => setForm(current => ({ ...current, redirectTarget: event.target.value }))}><option value="">Select destination</option>{(form.redirectType === "category" ? categories : form.redirectType === "subcategory" ? subcategories : productOptions).map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>}
          <label>Display position<input type="number" min="0" step="1" value={form.displayOrder} onChange={event => setForm(current => ({ ...current, displayOrder: event.target.value }))} required /></label>
          <label className="amb-check"><input type="checkbox" checked={form.isActive} onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))} />Active</label>
          <label>Start date (optional)<input type="date" value={form.startDate} onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))} /></label><label>End date (optional)<input type="date" value={form.endDate} onChange={event => setForm(current => ({ ...current, endDate: event.target.value }))} /></label></div>
        <div className="amb-form-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create banner"}</button></div>
      </form></section></div>}
  </div></main>;
}
