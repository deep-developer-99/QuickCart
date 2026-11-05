import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAdminHomepageSections,
  saveAdminHomepageSections,
} from "../../services/homepageSectionService";
import type { AdminHomepageSection, HomepageSectionCategory } from "../../types/homepageSection";
import "./AdminHomepageSections.css";

const requestErrorText = (error: unknown) => axios.isAxiosError(error)
  ? error.response?.data?.message || "The request could not be completed."
  : error instanceof Error ? error.message : "The request could not be completed.";

const parentName = (category: HomepageSectionCategory) => category.parentCategory?.name || "Unavailable parent category";
const comparable = (sections: AdminHomepageSection[]) => JSON.stringify(sections.map(({ subCategoryId, isActive, productLimit }) => ({ subCategoryId, isActive, productLimit })));

const AdminHomepageSections = () => {
  const [available, setAvailable] = useState<HomepageSectionCategory[]>([]);
  const [saved, setSaved] = useState<AdminHomepageSection[]>([]);
  const [draft, setDraft] = useState<AdminHomepageSection[]>([]);
  const [search, setSearch] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAdminHomepageSections();
      if (!response.success) throw new Error("Failed to load homepage sections.");
      const sections = response.data.sections || [];
      setAvailable(response.data.subcategories || []);
      setSaved(sections);
      setDraft(sections);
      setError("");
    } catch (requestError) {
      setError(requestErrorText(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const hasChanges = comparable(draft) !== comparable(saved);
  const selectedIds = useMemo(() => new Set(draft.map((section) => section.subCategoryId)), [draft]);
  const parentCategories = useMemo(() => {
    const parents = new Map<string, string>();
    for (const category of available) parents.set(category.parentCategory._id, category.parentCategory.name);
    return [...parents].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [available]);
  const filteredAvailable = useMemo(() => available.filter((category) =>
    (!parentFilter || category.parentCategory._id === parentFilter) &&
    `${category.name} ${parentName(category)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ), [available, parentFilter, search]);
  const activeCount = draft.filter((section) => section.isActive).length;
  const previewSections = draft.filter((section) =>
    section.isActive && section.subCategory?.isActive && section.subCategory.parentCategory.isActive,
  );

  const addSection = (category: HomepageSectionCategory) => {
    if (selectedIds.has(category._id)) return;
    setDraft((current) => [...current, {
      subCategoryId: category._id,
      subCategory: category,
      displayOrder: current.length,
      isActive: true,
      productLimit: 15,
    }]);
    setFeedback("");
  };

  const removeSection = (section: AdminHomepageSection) => {
    const name = section.subCategory?.name || "unavailable subcategory";
    if (!window.confirm(`Remove ${name} from the homepage configuration?`)) return;
    setDraft((current) => current.filter((item) => item.subCategoryId !== section.subCategoryId)
      .map((item, displayOrder) => ({ ...item, displayOrder })));
    setFeedback("");
  };

  const moveSection = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= draft.length) return;
    const next = [...draft];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setDraft(next.map((item, displayOrder) => ({ ...item, displayOrder })));
    setFeedback("");
  };

  const updateSection = (subCategoryId: string, patch: Partial<AdminHomepageSection>) => {
    setDraft((current) => current.map((item) => item.subCategoryId === subCategoryId ? { ...item, ...patch } : item));
    setFeedback("");
  };

  const resetChanges = () => {
    setDraft(saved);
    setFeedback("");
    setError("");
  };

  const saveChanges = async () => {
    if (saving || !hasChanges) return;
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const response = await saveAdminHomepageSections(draft);
      if (!response.success) throw new Error("Failed to save homepage sections.");
      const sections = response.data.sections || [];
      setSaved(sections);
      setDraft(sections);
      setAvailable(response.data.subcategories || available);
      setFeedback("Homepage sections saved.");
    } catch (requestError) {
      setError(requestErrorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-homepage-sections">
      <header className="ahs-header">
        <div>
          <span className="ahs-eyebrow">HOMEPAGE</span>
          <h1>Homepage Sections</h1>
          <p>Manage the subcategories displayed on your customer homepage and control their visibility and display order.</p>
        </div>
        <div className="ahs-header-actions">
          <button type="button" className="ahs-button ahs-secondary" onClick={resetChanges} disabled={!hasChanges || saving}>Reset changes</button>
          <button type="button" className="ahs-button" onClick={() => void saveChanges()} disabled={!hasChanges || saving || loading}>{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </header>

      <section className="ahs-stats" aria-label="Homepage section totals">
        <article><span>Selected sections</span><strong>{draft.length}</strong></article>
        <article><span>Active sections</span><strong>{activeCount}</strong></article>
      </section>

      {error && <div className="ahs-message error" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()} disabled={loading}>Retry loading</button></div>}
      {feedback && <div className="ahs-message success" role="status">{feedback}</div>}

      {loading ? (
        <div className="ahs-loading" role="status">Loading homepage section settings…</div>
      ) : (
        <div className="ahs-grid">
          <section className="ahs-card">
            <div className="ahs-card-heading">
              <div><h2>Available subcategories</h2><p>Add active subcategories to the customer homepage.</p></div>
              <span className="ahs-count">{available.length} available</span>
            </div>
            <div className="ahs-filters">
              <label>Search subcategories<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></label>
              <label>Parent category<select value={parentFilter} onChange={(event) => setParentFilter(event.target.value)}><option value="">All parent categories</option>{parentCategories.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}</select></label>
            </div>
            {filteredAvailable.length ? (
              <ul className="ahs-available-list">
                {filteredAvailable.map((category) => {
                  const isSelected = selectedIds.has(category._id);
                  return <li key={category._id}>
                    {category.image ? <img src={category.image} alt="" /> : <span className="ahs-image-placeholder" aria-hidden="true">▧</span>}
                    <span className="ahs-category-name"><strong>{category.name}</strong><small>{parentName(category)}</small></span>
                    <button type="button" className={isSelected ? "ahs-selected" : ""} onClick={() => addSection(category)} disabled={isSelected}>{isSelected ? "Selected" : "Add section"}</button>
                  </li>;
                })}
              </ul>
            ) : <p className="ahs-empty">No matching active subcategories.</p>}
          </section>

          <section className="ahs-card">
            <div className="ahs-card-heading">
              <div><h2>Selected homepage sections</h2><p>Use the arrows to change order. Inactive sections remain saved.</p></div>
            </div>
            {draft.length ? (
              <ol className="ahs-selected-list">
                {draft.map((section, index) => <li key={section.subCategoryId}>
                  <div className="ahs-order-controls">
                    <strong>{index + 1}</strong>
                    <button type="button" aria-label={`Move ${section.subCategory?.name || "section"} up`} onClick={() => moveSection(index, -1)} disabled={index === 0}>↑</button>
                    <button type="button" aria-label={`Move ${section.subCategory?.name || "section"} down`} onClick={() => moveSection(index, 1)} disabled={index === draft.length - 1}>↓</button>
                  </div>
                  {section.subCategory?.image ? <img src={section.subCategory.image} alt="" /> : <span className="ahs-image-placeholder" aria-hidden="true">▧</span>}
                  <div className="ahs-section-details">
                    <strong>{section.subCategory?.name || "Unavailable subcategory"}</strong>
                    <small>{section.subCategory
                      ? `${parentName(section.subCategory)}${section.subCategory.isActive && section.subCategory.parentCategory.isActive ? "" : " · Category unavailable"}`
                      : "This category was removed. Remove this saved section."}</small>
                    <label>Products to show<input type="number" min={1} max={15} value={section.productLimit} onChange={(event) => updateSection(section.subCategoryId, { productLimit: Math.max(1, Math.min(15, Number(event.target.value) || 1)) })} /></label>
                  </div>
                  <label className="ahs-toggle"><input type="checkbox" checked={section.isActive} onChange={(event) => updateSection(section.subCategoryId, { isActive: event.target.checked })} /><span>{section.isActive ? "Active" : "Inactive"}</span></label>
                  <button type="button" className="ahs-remove" onClick={() => removeSection(section)} aria-label={`Remove ${section.subCategory?.name || "unavailable section"}`}>Remove</button>
                </li>)}
              </ol>
            ) : <p className="ahs-empty">No homepage sections selected. Add subcategories from the list.</p>}
            <div className="ahs-preview">
              <h3>Homepage preview</h3>
              {previewSections.length ? (
                <div className="ahs-preview-list">{previewSections.map((section) => <span key={section.subCategoryId}>{section.subCategory?.name}</span>)}</div>
              ) : <p>No active sections will appear on the homepage.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminHomepageSections;
