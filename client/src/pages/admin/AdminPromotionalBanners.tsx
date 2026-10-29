import axios from "axios";
import { useEffect, useState } from "react";
import { getAdminPromotionalBanners, savePromotionalBanner, deletePromotionalBanner, togglePromotionalBanner } from "../../services/promotionalBannerService";
import { getAdminCategories, getAdminProducts } from "../../services/adminService";
import type { PromotionalBanner, PromotionalRedirectType } from "../../types/promotionalBanner";
import type { Category, Product } from "../../types/product";
import "./AdminPromotionalBanners.css";

const empty = { redirectType: "category" as PromotionalRedirectType, redirectValue: "", order: "0", startDate: "", endDate: "", isActive: true };

const AdminPromotionalBanners = () => {
  const [banners, setBanners] = useState<PromotionalBanner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try { setBanners((await getAdminPromotionalBanners()).data || []); }
    catch (requestError) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Failed to load banners" : "Failed to load banners"); }
  };
  const loadRedirectOptions = async () => {
    try {
      const [categoryResponse, productResponse] = await Promise.all([
        getAdminCategories(1, 100),
        getAdminProducts(1, 100),
      ]);
      if (categoryResponse?.success) setCategories(categoryResponse.data || []);
      if (productResponse?.success) setProducts(productResponse.data || []);
    } catch (requestError) {
      console.error("Failed to load promotional banner targets:", requestError);
      setError("Failed to load promotional banner targets.");
    }
  };
  // The page synchronizes its initial form data with the protected API.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([load(), loadRedirectOptions()]);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, String(value)));
      if (image) data.append("image", image);
      if (!editing && !image) { setError("An image is required."); return; }
      if (!form.redirectValue) { setError("Please select a banner destination."); return; }
      await savePromotionalBanner(data, editing);
      setForm(empty); setImage(null); setEditing(undefined); setMessage("Promotional banner saved."); setError(""); await load();
    } catch (requestError) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Failed to save banner" : "Failed to save banner"); }
  };

  const edit = (banner: PromotionalBanner) => {
    setEditing(banner._id);
    setForm({ redirectType: banner.redirectType === "product" ? "product" : "category", redirectValue: banner.redirectValue || "", order: String(banner.order), startDate: banner.startDate?.slice(0, 10) || "", endDate: banner.endDate?.slice(0, 10) || "", isActive: banner.isActive });
    setMessage("");
  };

  return (
    <div className="admin-promo-page">
      <header><div><span>QUICKCART ADMIN</span><h1>Manage Promotional Banners</h1><p>Create the three homepage promotions without changing the main banner system.</p></div></header>
      {message && <div className="admin-promo-feedback">{message}</div>}{error && <div className="admin-promo-error">{error}</div>}
      <form className="admin-promo-form" onSubmit={submit}>
        <h2>{editing ? "Edit promotion" : "Add promotion"}</h2>
        <label>Banner image <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] || null)} /></label>
        <label>Redirect Type <select value={form.redirectType} onChange={(e) => setForm({ ...form, redirectType: e.target.value as PromotionalRedirectType, redirectValue: "" })}><option value="category">Category</option><option value="product">Product</option></select></label>
        <label>Redirect Target <select value={form.redirectValue} onChange={(e) => setForm({ ...form, redirectValue: e.target.value })} required><option value="">Select {form.redirectType}</option>{form.redirectType === "category" ? categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>) : products.map((product) => <option key={product._id} value={product._id}>{product.name} - ₹{product.price}</option>)}</select></label>
        <input type="number" min="0" placeholder="Display order" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
        <label>Starts <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        <label>Ends <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
        <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        <button type="submit">{editing ? "Save changes" : "Add banner"}</button>
        {editing && <button type="button" onClick={() => { setEditing(undefined); setForm(empty); setImage(null); }}>Cancel</button>}
      </form>
      <section className="admin-promo-list"><h2>Existing promotions</h2>{banners.map((banner) => <article key={banner._id}><img src={banner.image} alt="Promotional banner" /><div><strong>Promotional banner</strong><small>Order {banner.order} · {banner.isActive ? "Active" : "Inactive"}</small></div><button onClick={() => edit(banner)}>Edit</button><button onClick={() => void togglePromotionalBanner(banner._id).then(load)}>Toggle</button><button onClick={() => window.confirm("Delete this promotion?") && void deletePromotionalBanner(banner._id).then(load)}>Delete</button></article>)}</section>
    </div>
  );
};
export default AdminPromotionalBanners;
