import axios from "axios";
import { useEffect, useMemo, useState } from "react";

import Pagination from "../../components/common/Pagination";
import { getCategories } from "../../services/productService";
import {
  createAdminSubcategory,
  deleteAdminSubcategory,
  getAdminSubcategories,
  updateAdminSubcategory,
} from "../../services/adminService";
import type { Category } from "../../types/product";
import "./AdminSubCategories.css";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

interface Subcategory extends Category {
  parentCategory: string | Pick<Category, "_id" | "name">;
  createdAt?: string;
}

interface SubcategoryPageResponse {
  success: boolean;
  data: Subcategory[];
  pagination: { currentPage: number; totalPages: number; totalItems: number };
  totalSubcategories: number;
}

const getParentName = (category: Subcategory) =>
  typeof category.parentCategory === "string" ? "Main category" : category.parentCategory.name;

const AdminSubCategories = () => {
  const [categories, setCategories] = useState<Subcategory[]>([]);
  const [mainCategories, setMainCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subcategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentCategory, setParentCategory] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    getCategories()
      .then((response) => {
        if (active && response?.success) setMainCategories((response.data || []) as Category[]);
      })
      .catch(() => {
        if (active) setError("Failed to load main categories.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchSubcategories = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminSubcategories({
        page,
        limit: 10,
        search: debouncedSearch,
        parentCategory: parentFilter || undefined,
        isActive: statusFilter || undefined,
      }) as SubcategoryPageResponse;
      if (!response.success) throw new Error("Failed to load subcategories.");
      setCategories(response.data || []);
      setTotalItems(response.totalSubcategories ?? response.pagination?.totalItems ?? 0);
      setTotalPages(response.pagination?.totalPages || 1);
      if (page > (response.pagination?.totalPages || 1)) setPage(response.pagination?.totalPages || 1);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError)
        ? requestError.response?.data?.message || "Failed to load subcategories."
        : requestError instanceof Error ? requestError.message : "Failed to load subcategories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    getAdminSubcategories({
      page,
      limit: 10,
      search: debouncedSearch,
      parentCategory: parentFilter || undefined,
      isActive: statusFilter || undefined,
    }).then((value) => {
      if (!current) return;
      const response = value as SubcategoryPageResponse;
      if (!response.success) throw new Error("Failed to load subcategories.");
      setError("");
      setCategories(response.data || []);
      setTotalItems(response.totalSubcategories ?? response.pagination?.totalItems ?? 0);
      setTotalPages(response.pagination?.totalPages || 1);
      if (page > (response.pagination?.totalPages || 1)) setPage(response.pagination?.totalPages || 1);
    }).catch((requestError: unknown) => {
      if (!current) return;
      setError(axios.isAxiosError(requestError)
        ? requestError.response?.data?.message || "Failed to load subcategories."
        : requestError instanceof Error ? requestError.message : "Failed to load subcategories.");
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [page, debouncedSearch, parentFilter, statusFilter]);

  useEffect(() => () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const clearForm = () => {
    setShowForm(false);
    setEditing(null);
    setName("");
    setDescription("");
    setParentCategory("");
    setIsActive(true);
    setImageFile(null);
    setImagePreview("");
    setUploadProgress(null);
  };

  const openCreate = () => {
    clearForm();
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (subcategory: Subcategory) => {
    setEditing(subcategory);
    setName(subcategory.name);
    setDescription(subcategory.description || "");
    setParentCategory(typeof subcategory.parentCategory === "string" ? subcategory.parentCategory : subcategory.parentCategory._id);
    setIsActive(subcategory.isActive);
    setImageFile(null);
    setImagePreview(subcategory.image || "");
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPG, JPEG, PNG and WEBP images are allowed.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image size must be 5 MB or less.");
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim()) return setError("Subcategory name is required.");
    if (!parentCategory) return setError("Select a main category.");
    if (!editing && !imageFile) return setError("A subcategory image is required.");

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("parentCategory", parentCategory);
    formData.append("isActive", String(isActive));
    if (imageFile) formData.append("image", imageFile);

    setSaving(true);
    setUploadProgress(imageFile ? 0 : null);
    try {
      const onProgress = (progress: number) => setUploadProgress(progress);
      const response = editing
        ? await updateAdminSubcategory(editing._id, formData, onProgress)
        : await createAdminSubcategory(formData, onProgress);
      if (!response?.success) throw new Error(response?.message || "Failed to save subcategory.");
      setSuccess(editing ? "Subcategory updated successfully." : "Subcategory created successfully.");
      clearForm();
      await fetchSubcategories();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError)
        ? requestError.response?.data?.message || "Failed to save subcategory."
        : requestError instanceof Error ? requestError.message : "Failed to save subcategory.");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleDelete = async (subcategory: Subcategory) => {
    if (!window.confirm(`Deactivate “${subcategory.name}”? Products assigned to it must be reassigned first.`)) return;
    setDeletingId(subcategory._id);
    setError("");
    setSuccess("");
    try {
      const response = await deleteAdminSubcategory(subcategory._id);
      if (!response?.success) throw new Error(response?.message || "Failed to delete subcategory.");
      setSuccess("Subcategory deactivated successfully.");
      await fetchSubcategories();
    } catch (requestError) {
      const assignedCount = axios.isAxiosError(requestError) ? requestError.response?.data?.productsCount : undefined;
      setError(assignedCount !== undefined
        ? `This subcategory has ${assignedCount} assigned product${assignedCount === 1 ? "" : "s"}. Reassign them before deleting it.`
        : axios.isAxiosError(requestError)
          ? requestError.response?.data?.message || "Failed to delete subcategory."
          : requestError instanceof Error ? requestError.message : "Failed to delete subcategory.");
    } finally {
      setDeletingId(null);
    }
  };

  const countLabel = useMemo(() => `${totalItems} subcategor${totalItems === 1 ? "y" : "ies"}`, [totalItems]);

  return (
    <main className="admin-subcategories-page">
      <header className="admin-subcategories-header">
        <div>
          <span className="admin-subcategories-eyebrow">QUICKCART ADMIN</span>
          <h1>Manage Subcategories</h1>
          <p>Organize products under active main categories. Each subcategory requires its own image.</p>
        </div>
        <button type="button" className="admin-subcategories-add" onClick={openCreate}>+ Add Subcategory</button>
      </header>

      {error && <div className="admin-subcategories-message error" role="alert">{error}</div>}
      {success && <div className="admin-subcategories-message success" role="status">{success}</div>}

      <section className="admin-subcategories-toolbar" aria-label="Subcategory filters">
        <label className="admin-subcategories-search">
          <span className="sr-only">Search subcategories</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); setLoading(true); }} placeholder="Search subcategories" />
        </label>
        <label>
          <span className="sr-only">Filter by main category</span>
          <select value={parentFilter} onChange={(event) => { setParentFilter(event.target.value); setPage(1); setLoading(true); }}>
            <option value="">All main categories</option>
            {mainCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "" | "true" | "false"); setPage(1); setLoading(true); }}>
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <strong className="admin-subcategories-count">{countLabel}</strong>
      </section>

      <section className="admin-subcategories-table-wrap" aria-label="Subcategories">
        {loading ? <p className="admin-subcategories-state">Loading subcategories…</p> : categories.length === 0 ? (
          <div className="admin-subcategories-state"><h2>No subcategories found</h2><p>Add a subcategory or adjust your filters.</p></div>
        ) : (
          <table className="admin-subcategories-table">
            <thead><tr><th>Image</th><th>Subcategory</th><th>Main Category</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>{categories.map((subcategory) => (
              <tr key={subcategory._id}>
                <td><img className="admin-subcategories-image" src={subcategory.image} alt="" /></td>
                <td data-label="Subcategory"><strong>{subcategory.name}</strong></td>
                <td data-label="Main Category">{getParentName(subcategory)}</td>
                <td data-label="Status"><span className={`admin-subcategories-status${subcategory.isActive ? " active" : " inactive"}`}>{subcategory.isActive ? "Active" : "Inactive"}</span></td>
                <td data-label="Created">{subcategory.createdAt ? new Date(subcategory.createdAt).toLocaleDateString() : "—"}</td>
                <td data-label="Actions"><div className="admin-subcategories-actions">
                  <button type="button" onClick={() => openEdit(subcategory)} disabled={deletingId === subcategory._id}>Edit</button>
                  <button type="button" className="delete" onClick={() => void handleDelete(subcategory)} disabled={!subcategory.isActive || deletingId === subcategory._id}>{deletingId === subcategory._id ? "Deleting…" : "Delete"}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      {!loading && totalItems > 0 && <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={(nextPage) => { setLoading(true); setPage(nextPage); }} />}

      {showForm && (
        <div className="admin-subcategories-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) clearForm(); }}>
          <section className="admin-subcategories-modal" role="dialog" aria-modal="true" aria-labelledby="admin-subcategories-form-title">
            <header><div><h2 id="admin-subcategories-form-title">{editing ? "Edit Subcategory" : "Add Subcategory"}</h2><p>Subcategories are limited to one level below a main category.</p></div><button type="button" aria-label="Close" onClick={clearForm} disabled={saving}>×</button></header>
            <form onSubmit={handleSubmit}>
              <label>Subcategory Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={saving} /></label>
              <label>Subcategory Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={4} placeholder="Optional information shown on the category shopping page." disabled={saving} /><small>Optional. Up to 1,200 characters.</small></label>
              <label>Main Category<select value={parentCategory} onChange={(event) => setParentCategory(event.target.value)} required disabled={saving}>
                <option value="">Select a main category</option>
                {mainCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
              </select></label>
              <label>Subcategory Image<input type="file" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handleImageChange} disabled={saving} />
                <small>JPG, JPEG, PNG or WEBP, up to 5 MB. {editing ? "Leave empty to keep the current image." : "An image is required."}</small>
              </label>
              {imagePreview && <img className="admin-subcategories-preview" src={imagePreview} alt="Subcategory preview" />}
              <label className="admin-subcategories-checkbox"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} disabled={saving} /> Active</label>
              {uploadProgress !== null && <div className="admin-subcategories-progress" role="status">Uploading image: {uploadProgress}%</div>}
              <div className="admin-subcategories-form-actions"><button type="button" onClick={clearForm} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Subcategory"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
};

export default AdminSubCategories;
