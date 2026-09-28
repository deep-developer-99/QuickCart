import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";

import {
  createAdminBanner,
  deleteAdminBanner,
  getAdminBanners,
  toggleAdminBannerStatus,
  updateAdminBanner,
} from "../../services/bannerService";
import {
  getAdminCategories,
  getAdminProducts,
} from "../../services/adminService";
import type { Banner, BannerRedirectType } from "../../types/banner";
import type { Category, Product } from "../../types/product";

import "./AdminBanners.css";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type BannerFormState = {
  title: string;
  subtitle: string;
  buttonText: string;
  redirectType: BannerRedirectType;
  redirectValue: string;
  order: string;
  backgroundColor: string;
  textColor: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};

const initialForm: BannerFormState = {
  title: "",
  subtitle: "",
  buttonText: "Shop Now",
  redirectType: "category",
  redirectValue: "",
  order: "0",
  backgroundColor: "#e9f6e7",
  textColor: "#172033",
  isActive: true,
  startDate: "",
  endDate: "",
};

const toDateInputValue = (value?: string) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const AdminBanners = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyBannerId, setBusyBannerId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerFormState>(initialForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isEditing = Boolean(editingBanner);

  const redirectOptions = useMemo(() => {
    if (form.redirectType === "category") {
      return categories.map((category) => ({
        value: category._id,
        label: category.name,
      }));
    }

    return products.map((product) => ({
      value: product._id,
      label: product.name,
    }));
  }, [categories, products, form.redirectType]);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminBanners();

      if (response?.success) {
        setBanners(response.data || []);
      } else {
        setError("Failed to load banners.");
      }
    } catch (error: unknown) {
      console.error("Get admin banners error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to load banners.");
      } else {
        setError("Failed to load banners.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBannerOptions = async () => {
    try {
      const [categoryResponse, productResponse] = await Promise.all([
        getAdminCategories(),
        getAdminProducts(),
      ]);

      if (categoryResponse?.success) {
        setCategories(categoryResponse.data || []);
      }

      if (productResponse?.success) {
        setProducts(productResponse.data || []);
      }
    } catch (error) {
      console.error("Get banner redirect options error:", error);
    }
  };

  useEffect(() => {
    void Promise.all([fetchBanners(), fetchBannerOptions()]);
  }, []);

  const resetForm = () => {
    setShowForm(false);
    setEditingBanner(null);
    setForm(initialForm);
    setImageFile(null);
    setImagePreview("");
  };

  const openAddForm = () => {
    setError("");
    setSuccess("");
    setEditingBanner(null);
    setForm(initialForm);
    setImageFile(null);
    setImagePreview("");
    setShowForm(true);
  };

  const openEditForm = (banner: Banner) => {
    setError("");
    setSuccess("");
    setEditingBanner(banner);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      buttonText: banner.buttonText || "Shop Now",
      redirectType: banner.redirectType,
      redirectValue: banner.redirectValue || "",
      order: String(banner.order ?? 0),
      backgroundColor: banner.backgroundColor || "#e9f6e7",
      textColor: banner.textColor || "#172033",
      isActive: banner.isActive,
      startDate: toDateInputValue(banner.startDate),
      endDate: toDateInputValue(banner.endDate),
    });
    setImageFile(null);
    setImagePreview(banner.image || "");
    setShowForm(true);
  };

  const handleImageChange = (file: File | null) => {
    setError("");

    if (!file) {
      setImageFile(null);
      if (editingBanner) {
        setImagePreview(editingBanner.image || "");
      } else {
        setImagePreview("");
      }
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPG, JPEG, PNG and WEBP images are allowed.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Banner image must be 5 MB or smaller.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleFormChange = (
    field: keyof BannerFormState,
    value: string | boolean,
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Banner title is required.");
      return;
    }

    if (!isEditing && !imageFile) {
      setError("Please upload a banner image.");
      return;
    }

    if (form.redirectType !== "url" && !form.redirectValue) {
      setError("Please select where this banner should redirect.");
      return;
    }

    if (form.redirectType === "url" && form.redirectValue) {
      try {
        new URL(form.redirectValue);
      } catch {
        setError("Please enter a valid redirect URL.");
        return;
      }
    }

    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate) < new Date(form.startDate)
    ) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("title", form.title.trim());
      formData.append("subtitle", form.subtitle.trim());
      formData.append("buttonText", form.buttonText.trim());
      formData.append("redirectType", form.redirectType);
      formData.append("redirectValue", form.redirectValue.trim());
      formData.append("order", form.order || "0");
      formData.append("backgroundColor", form.backgroundColor);
      formData.append("textColor", form.textColor);
      formData.append("isActive", String(form.isActive));
      formData.append(
        "startDate",
        form.startDate
          ? new Date(`${form.startDate}T00:00:00`).toISOString()
          : "",
      );
      formData.append(
        "endDate",
        form.endDate
          ? new Date(`${form.endDate}T23:59:59.999`).toISOString()
          : "",
      );

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response =
        isEditing && editingBanner
          ? await updateAdminBanner(editingBanner._id, formData)
          : await createAdminBanner(formData);

      if (!response?.success) {
        throw new Error(
          response?.message ||
            `Failed to ${isEditing ? "update" : "create"} banner.`,
        );
      }

      await fetchBanners();
      resetForm();
      setSuccess(
        isEditing
          ? "Banner updated successfully."
          : "Banner created successfully.",
      );
    } catch (error: unknown) {
      console.error("Save banner error:", error);

      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ||
            `Failed to ${isEditing ? "update" : "create"} banner.`,
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : `Failed to ${isEditing ? "update" : "create"} banner.`,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (banner: Banner) => {
    const confirmed = window.confirm(
      `Delete the "${banner.title}" banner? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setBusyBannerId(banner._id);
      setError("");
      setSuccess("");

      const response = await deleteAdminBanner(banner._id);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to delete banner.");
      }

      setBanners((previous) =>
        previous.filter((item) => item._id !== banner._id),
      );
      setSuccess("Banner deleted successfully.");
    } catch (error: unknown) {
      console.error("Delete banner error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to delete banner.");
      } else {
        setError(
          error instanceof Error ? error.message : "Failed to delete banner.",
        );
      }
    } finally {
      setBusyBannerId(null);
    }
  };

  const handleToggleStatus = async (banner: Banner) => {
    try {
      setBusyBannerId(banner._id);
      setError("");
      setSuccess("");

      const response = await toggleAdminBannerStatus(banner._id);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to update banner status.");
      }

      setBanners((previous) =>
        previous.map((item) =>
          item._id === banner._id
            ? { ...item, isActive: response.data?.isActive ?? !item.isActive }
            : item,
        ),
      );
      setSuccess(response.message || "Banner status updated successfully.");
    } catch (error: unknown) {
      console.error("Toggle banner status error:", error);

      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message || "Failed to update banner status.",
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to update banner status.",
        );
      }
    } finally {
      setBusyBannerId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-banners-page">
        <div className="admin-banners-loading">Loading banners...</div>
      </div>
    );
  }

  return (
    <div className="admin-banners-page">
      <div className="admin-banners-container">
        <div className="admin-banners-header">
          <div>
            <span className="admin-banners-eyebrow">HOME PAGE CONTENT</span>
            <h1>Manage Banners</h1>
            <p>
              Create promotional banners and control what customers see on the
              QuickCart home page.
            </p>
          </div>

          <button
            type="button"
            className="admin-banner-add-button"
            onClick={openAddForm}
          >
            + Add Banner
          </button>
        </div>

        {error && <div className="admin-banner-message error">{error}</div>}
        {success && (
          <div className="admin-banner-message success">{success}</div>
        )}

        {showForm && (
          <div
            className="admin-banner-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-banner-modal-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isSubmitting) {
                resetForm();
              }
            }}
          >
            <div className="admin-banner-form-card">
              <div className="admin-banner-form-header">
                <div>
                  <span className="admin-banners-eyebrow">BANNER EDITOR</span>
                  <h2 id="admin-banner-modal-title">
                    {isEditing ? "Edit Banner" : "Add New Banner"}
                  </h2>
                  <p>
                    Configure the banner, image, destination and display
                    schedule.
                  </p>
                </div>

                <button
                  type="button"
                  className="admin-banner-close-button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form className="admin-banner-form" onSubmit={handleSubmit}>
                <div className="admin-banner-form-grid">
                  <label>
                    Banner Title
                    <input
                      type="text"
                      value={form.title}
                      onChange={(event) =>
                        handleFormChange("title", event.target.value)
                      }
                      placeholder="Fresh groceries delivered fast"
                      maxLength={120}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label>
                    Button Text
                    <input
                      type="text"
                      value={form.buttonText}
                      onChange={(event) =>
                        handleFormChange("buttonText", event.target.value)
                      }
                      placeholder="Shop Now"
                      maxLength={40}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label className="full-width">
                    Subtitle
                    <textarea
                      value={form.subtitle}
                      onChange={(event) =>
                        handleFormChange("subtitle", event.target.value)
                      }
                      placeholder="Fresh products delivered to your doorstep."
                      maxLength={240}
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label className="full-width">
                    Banner Image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={(event) =>
                        handleImageChange(event.target.files?.[0] || null)
                      }
                      disabled={isSubmitting}
                    />
                    <small>
                      JPG, JPEG, PNG or WEBP. Maximum 5 MB. A wide image works
                      best (recommended around 1000 × 650 px).
                    </small>
                  </label>

                  {imagePreview && (
                    <div className="admin-banner-preview full-width">
                      <img src={imagePreview} alt="Banner preview" />
                    </div>
                  )}

                  <label>
                    Redirect Type
                    <select
                      value={form.redirectType}
                      onChange={(event) => {
                        handleFormChange(
                          "redirectType",
                          event.target.value as BannerRedirectType,
                        );
                        handleFormChange("redirectValue", "");
                      }}
                      disabled={isSubmitting}
                    >
                      <option value="category">Category</option>
                      <option value="product">Product</option>
                      <option value="url">External URL</option>
                    </select>
                  </label>

                  {form.redirectType === "url" ? (
                    <label>
                      Redirect URL
                      <input
                        type="url"
                        value={form.redirectValue}
                        onChange={(event) =>
                          handleFormChange("redirectValue", event.target.value)
                        }
                        placeholder="https://example.com/offers"
                        disabled={isSubmitting}
                      />
                    </label>
                  ) : (
                    <label>
                      {form.redirectType === "category"
                        ? "Category"
                        : "Product"}
                      <select
                        value={form.redirectValue}
                        onChange={(event) =>
                          handleFormChange("redirectValue", event.target.value)
                        }
                        disabled={isSubmitting}
                      >
                        <option value="">
                          Select{" "}
                          {form.redirectType === "category"
                            ? "category"
                            : "product"}
                        </option>
                        {redirectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label>
                    Display Order
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.order}
                      onChange={(event) =>
                        handleFormChange("order", event.target.value)
                      }
                      disabled={isSubmitting}
                    />
                    <small>Lower numbers appear first.</small>
                  </label>

                  <label>
                    Active
                    <span className="admin-banner-checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) =>
                          handleFormChange("isActive", event.target.checked)
                        }
                        disabled={isSubmitting}
                      />
                      Show this banner on the Home Page
                    </span>
                  </label>

                  <label>
                    Background Color
                    <span className="admin-banner-color-row">
                      <input
                        type="color"
                        value={form.backgroundColor}
                        onChange={(event) =>
                          handleFormChange(
                            "backgroundColor",
                            event.target.value,
                          )
                        }
                        disabled={isSubmitting}
                      />
                      <input
                        type="text"
                        value={form.backgroundColor}
                        onChange={(event) =>
                          handleFormChange(
                            "backgroundColor",
                            event.target.value,
                          )
                        }
                        maxLength={7}
                        disabled={isSubmitting}
                      />
                    </span>
                  </label>

                  <label>
                    Text Color
                    <span className="admin-banner-color-row">
                      <input
                        type="color"
                        value={form.textColor}
                        onChange={(event) =>
                          handleFormChange("textColor", event.target.value)
                        }
                        disabled={isSubmitting}
                      />
                      <input
                        type="text"
                        value={form.textColor}
                        onChange={(event) =>
                          handleFormChange("textColor", event.target.value)
                        }
                        maxLength={7}
                        disabled={isSubmitting}
                      />
                    </span>
                  </label>

                  <label>
                    Start Date
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        handleFormChange("startDate", event.target.value)
                      }
                      disabled={isSubmitting}
                    />
                    <small>Leave blank to start immediately.</small>
                  </label>

                  <label>
                    End Date
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(event) =>
                        handleFormChange("endDate", event.target.value)
                      }
                      disabled={isSubmitting}
                    />
                    <small>Leave blank for no expiry.</small>
                  </label>
                </div>

                <div className="admin-banner-form-actions">
                  <button
                    type="button"
                    className="admin-banner-cancel-button"
                    onClick={resetForm}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-banner-submit-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Saving..."
                      : isEditing
                        ? "Update Banner"
                        : "Save Banner"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {banners.length === 0 ? (
          <div className="admin-banners-empty">
            <div className="admin-banners-empty-icon">🖼️</div>
            <h2>No banners yet</h2>
            <p>
              Add your first Home Page banner. Customers will see active banners
              automatically.
            </p>
            <button type="button" onClick={openAddForm}>
              + Add First Banner
            </button>
          </div>
        ) : (
          <div className="admin-banners-list">
            {banners.map((banner) => (
              <article className="admin-banner-card" key={banner._id}>
                <div
                  className="admin-banner-card-image"
                  style={{
                    backgroundColor: banner.backgroundColor || "#e9f6e7",
                  }}
                >
                  <img src={banner.image} alt={banner.title} />
                  <span
                    className={`admin-banner-status ${banner.isActive ? "active" : "inactive"}`}
                  >
                    {banner.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="admin-banner-order">
                    Order {banner.order}
                  </span>
                </div>

                <div className="admin-banner-card-body">
                  <div>
                    <span className="admin-banner-card-label">
                      {banner.redirectType.toUpperCase()}
                    </span>
                    <h2>{banner.title}</h2>
                    {banner.subtitle && <p>{banner.subtitle}</p>}
                  </div>

                  <div className="admin-banner-card-meta">
                    <span>
                      {banner.startDate
                        ? `Starts ${new Date(banner.startDate).toLocaleDateString("en-IN")}`
                        : "Starts immediately"}
                    </span>
                    <span>
                      {banner.endDate
                        ? `Ends ${new Date(banner.endDate).toLocaleDateString("en-IN")}`
                        : "No expiry"}
                    </span>
                  </div>

                  <div className="admin-banner-card-actions">
                    <button
                      type="button"
                      className="edit"
                      onClick={() => openEditForm(banner)}
                      disabled={busyBannerId === banner._id}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="status"
                      onClick={() => void handleToggleStatus(banner)}
                      disabled={busyBannerId === banner._id}
                    >
                      {busyBannerId === banner._id
                        ? "Please wait..."
                        : banner.isActive
                          ? "Disable"
                          : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="delete"
                      onClick={() => void handleDelete(banner)}
                      disabled={busyBannerId === banner._id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBanners;
