import { useEffect, useState } from "react";
import axios from "axios";

import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "../../services/adminService";
import type { Category } from "../../types/product";

import "./AdminCategories.css";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const AdminCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminCategories();

      if (response?.success) {
        setCategories(response.data || []);
      } else {
        setError("Failed to load categories.");
      }
    } catch (error: unknown) {
      console.error("Get admin categories error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to load categories.");
      } else {
        setError("Failed to load categories.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCategories();
  }, []);

  const clearPreviewUrl = () => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
  };

  const resetForm = () => {
    clearPreviewUrl();

    setName("");
    setImageFile(null);
    setImagePreview("");
    setEditingCategory(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    resetForm();
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (category: Category) => {
    clearPreviewUrl();

    setEditingCategory(category);
    setName(category.name);
    setImageFile(null);
    setImagePreview(category.image || "");
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
      setError("Image size must be less than 5MB.");
      event.target.value = "";
      return;
    }

    clearPreviewUrl();

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Category name is required.");
      return;
    }

    if (!editingCategory && !imageFile) {
      setError("Category image is required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("name", trimmedName);

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = editingCategory
        ? await updateAdminCategory(editingCategory._id, formData)
        : await createAdminCategory(formData);

      if (!response?.success) {
        throw new Error(
          response?.message ||
            (editingCategory
              ? "Failed to update category."
              : "Failed to create category."),
        );
      }

      setSuccess(
        editingCategory
          ? "Category updated successfully."
          : "Category added successfully.",
      );

      resetForm();
      await fetchCategories();
    } catch (error: unknown) {
      console.error(
        editingCategory ? "Update category error:" : "Create category error:",
        error,
      );

      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ||
            (editingCategory
              ? "Failed to update category."
              : "Failed to create category."),
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : editingCategory
              ? "Failed to update category."
              : "Failed to create category.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const confirmed = window.confirm(
      `Delete the "${category.name}" category? Categories with active products cannot be deleted.`,
    );

    if (!confirmed) return;

    try {
      setIsDeleting(category._id);
      setError("");
      setSuccess("");

      const response = await deleteAdminCategory(category._id);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to delete category.");
      }

      setCategories((previous) =>
        previous.filter((item) => item._id !== category._id),
      );
      setSuccess("Category deleted successfully.");
    } catch (error: unknown) {
      console.error("Delete category error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to delete category.");
      } else {
        setError(
          error instanceof Error ? error.message : "Failed to delete category.",
        );
      }
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-categories-page">
        <div className="admin-categories-loading">Loading categories...</div>
      </div>
    );
  }

  const isEditing = Boolean(editingCategory);

  return (
    <div className="admin-categories-page">
      <div className="admin-categories-container">
        <div className="admin-categories-header">
          <div>
            <h1>Manage Categories</h1>
            <p>Add and manage the categories available in QuickCart.</p>
          </div>

          <button
            type="button"
            className="admin-add-category-button"
            onClick={openAddForm}
          >
            + Add Category
          </button>
        </div>

        {error && <div className="admin-category-message error">{error}</div>}

        {success && (
          <div className="admin-category-message success">{success}</div>
        )}

        {showForm && (
          <div
            className="admin-category-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-category-modal-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                resetForm();
              }
            }}
          >
            <div className="admin-category-form-card">
              <div className="admin-category-form-header">
                <div>
                  <h2 id="admin-category-modal-title">
                    {isEditing ? "Edit Category" : "Add New Category"}
                  </h2>
                  <p>
                    {isEditing
                      ? "Update the category name or replace its image."
                      : "Enter a category name and upload its image."}
                  </p>
                </div>

                <button
                  type="button"
                  className="admin-category-close-button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="admin-category-form">
                <label>
                  Category Name
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Fruits & Vegetables"
                    maxLength={80}
                    disabled={isSubmitting}
                  />
                </label>

                <label>
                  Category Image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                  />
                  <span className="admin-category-file-help">
                    JPG, JPEG, PNG or WEBP. Maximum size: 5MB.
                    {isEditing ? " Leave empty to keep the current image." : ""}
                  </span>
                </label>

                {imagePreview && (
                  <div className="admin-category-preview">
                    <img src={imagePreview} alt="Category preview" />
                  </div>
                )}

                <div className="admin-category-form-actions">
                  <button
                    type="button"
                    className="admin-category-cancel-button"
                    onClick={resetForm}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="admin-category-submit-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? isEditing
                        ? "Updating..."
                        : "Adding..."
                      : isEditing
                        ? "Update Category"
                        : "Add Category"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {categories.length === 0 ? (
          <div className="admin-categories-empty">
            <div>🗂️</div>
            <h3>No Categories Found</h3>
            <p>Add your first QuickCart category.</p>
          </div>
        ) : (
          <div className="admin-categories-grid">
            {categories.map((category) => (
              <div className="admin-category-card" key={category._id}>
                <div className="admin-category-image-wrapper">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="admin-category-image"
                    />
                  ) : (
                    <div className="admin-category-no-image">No Image</div>
                  )}

                  <span
                    className={`admin-category-status ${
                      category.isActive ? "active" : "inactive"
                    }`}
                  >
                    {category.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="admin-category-card-body">
                  <h3>{category.name}</h3>

                  <div className="admin-category-card-actions">
                    <button
                      type="button"
                      className="admin-category-edit-button"
                      onClick={() => openEditForm(category)}
                      disabled={isDeleting === category._id}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="admin-category-delete-button"
                      onClick={() => handleDelete(category)}
                      disabled={isDeleting === category._id}
                    >
                      {isDeleting === category._id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCategories;
