import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createProduct,
  deleteProduct,
  getCategories,
  getSubcategories,
  getVendorProducts,
  restoreProduct,
  updateProduct,
} from "../../services/productService";

import type { Category, Product } from "../../types/product";
import { activeSubcategoriesForParent } from "../../utils/categorySelection";
import Pagination from "../../components/common/Pagination";

import "./VendorProducts.css";

interface ProductForm {
  name: string;
  description: string;
  category: string;
  subCategory: string;
}
type VariantForm = { _id?: string; quantity: string; unit: string; price: string; discountPrice: string; stock: string; isActive?: boolean };
const units = ["g", "kg", "ml", "L", "pcs", "pc", "set", "pack", "m", "cm", "dozen", "pair"];

const initialForm: ProductForm = {
  name: "",
  description: "",
  category: "",
  subCategory: "",
};

const VendorProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [isLoadingSubcategories, setIsLoadingSubcategories] = useState(false);
  const [subcategoryLoadError, setSubcategoryLoadError] = useState("");
  const [subcategoryRetry, setSubcategoryRetry] = useState(0);
  const subcategoryRequestId = useRef(0);

  const [form, setForm] = useState<ProductForm>(initialForm);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  // ==============================
  // Fetch Vendor Products + Categories
  // ==============================

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [productResponse, categoryResponse] = await Promise.all([
        getVendorProducts(page, 10),
        getCategories(),
      ]);

      if (productResponse?.success) {
        setProducts(productResponse.data || []);
        setTotalPages(productResponse.pagination?.totalPages || 1);
        if (page > (productResponse.pagination?.totalPages || 1)) setPage(productResponse.pagination?.totalPages || 1);
        setTotalItems(productResponse.pagination?.totalItems || 0);
      }

      if (categoryResponse?.success) {
        setCategories(categoryResponse.data || []);
      }
    } catch (error) {
      console.error("Failed to load vendor products:", error);

      setError("Failed to load products.");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // The callback starts the page's asynchronous API load and updates loading/data state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const requestId = ++subcategoryRequestId.current;
    if (!isFormOpen || !form.category) {
      return;
    }

    getSubcategories(form.category)
      .then((response) => {
        if (requestId !== subcategoryRequestId.current) return;
        if (!response?.success || !Array.isArray(response.data)) throw new Error("Failed to load subcategories.");
        setSubcategories(activeSubcategoriesForParent(response.data as Category[], form.category));
      })
      .catch(() => {
        if (requestId !== subcategoryRequestId.current) return;
        setSubcategories([]);
        setSubcategoryLoadError("Could not load subcategories. Retry by selecting the main category again.");
      })
      .finally(() => {
        if (requestId === subcategoryRequestId.current) setIsLoadingSubcategories(false);
      });

    return () => {
      if (requestId === subcategoryRequestId.current) subcategoryRequestId.current += 1;
    };
  }, [form.category, isFormOpen, subcategoryRetry]);

  // ==============================
  // Cleanup Preview URL
  // ==============================

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // ==============================
  // Lock Background Scroll
  // ==============================

  useEffect(() => {
    if (!isFormOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFormOpen]);

  // ==============================
  // Handle Input Change
  // ==============================

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;

    if (name === "category") {
      setForm((previous) => ({ ...previous, category: value, subCategory: "" }));
      setSubcategories([]);
      setIsLoadingSubcategories(Boolean(value));
      setSubcategoryLoadError("");
      setError("");
    } else {
      setForm((previous) => ({ ...previous, [name]: value }));
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, JPEG, PNG and WEBP images are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      event.target.value = "";
      return;
    }

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  // ==============================
  // Reset / Close Form
  // ==============================

  const resetForm = () => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setForm(initialForm);
    setVariants([]);
    setSubcategories([]);
    setIsLoadingSubcategories(false);
    setSubcategoryLoadError("");
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview("");
  };

  const closeForm = () => {
    if (isSubmitting) {
      return;
    }

    resetForm();
    setIsFormOpen(false);
    setError("");
  };

  const openAddForm = () => {
    resetForm();
    setError("");
    setSuccess("");
    setVariants([{ quantity: "", unit: "g", price: "", discountPrice: "", stock: "" }]);
    setIsFormOpen(true);
  };

  // ==============================
  // Submit Product
  // ==============================

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!form.description.trim()) {
      setError("Product description is required.");
      return;
    }

    if (!editingProduct && !imageFile) {
      setError("Product image is required.");
      return;
    }

    if (variants.length === 0) { setError("Add at least one product variant with a known pack size."); return; }
    const variantKeys = new Set<string>();
    for (const variant of variants) {
      const key = `${Number(variant.quantity)}:${variant.unit}`;
      const discount = variant.discountPrice.trim() === "" ? undefined : Number(variant.discountPrice);
      if (!Number.isFinite(Number(variant.quantity)) || Number(variant.quantity) <= 0 || !Number.isFinite(Number(variant.price)) || Number(variant.price) <= 0 || (discount !== undefined && (!Number.isFinite(discount) || discount <= 0 || discount >= Number(variant.price))) || !Number.isInteger(Number(variant.stock)) || Number(variant.stock) < 0 || !units.includes(variant.unit) || variantKeys.has(key)) {
        setError("Check each variant quantity, unit, original price, optional lower discount price and stock. Variant combinations must be unique."); return;
      }
      variantKeys.add(key);
    }

    if (!form.category) {
      setError("Please select a category.");
      return;
    }

    if (isLoadingSubcategories || subcategoryLoadError) {
      setError(subcategoryLoadError || "Wait for subcategories to finish loading.");
      return;
    }

    const currentSubcategory = editingProduct?.subCategory;
    const currentSubcategoryId = typeof currentSubcategory === "string"
      ? currentSubcategory
      : currentSubcategory?._id;
    const editingCategoryId = typeof editingProduct?.category === "string"
      ? editingProduct.category
      : editingProduct?.category?._id;
    const currentSubcategoryIsActive = currentSubcategoryId
      ? subcategories.some((subcategory) => subcategory._id === currentSubcategoryId)
      : true;
    if (editingProduct && currentSubcategoryId && editingCategoryId === form.category && !currentSubcategoryIsActive && !form.subCategory) {
      setError("This product's subcategory is inactive. Choose an active replacement before updating.");
      return;
    }
    if (form.subCategory && !subcategories.some((subcategory) => subcategory._id === form.subCategory)) {
      setError("Select a subcategory that belongs to the selected main category.");
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();

      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("category", form.category);
      formData.append("subCategory", form.subCategory);
      formData.append("variants", JSON.stringify(variants.map(({ discountPrice, ...variant }) => ({ ...variant, quantity: Number(variant.quantity), price: Number(variant.price), ...(discountPrice.trim() ? { discountPrice: Number(discountPrice) } : {}), stock: Number(variant.stock) }))));

      if (imageFile) {
        formData.append("image", imageFile);
      }

      if (editingProduct) {
        const response = await updateProduct(editingProduct._id, formData);

        if (response?.success) {
          setSuccess("Product updated successfully.");
          resetForm();
          setIsFormOpen(false);
          await fetchData();
        }

        return;
      }

      const response = await createProduct(formData);

      if (response?.success) {
        setSuccess("Product added successfully.");
        resetForm();
        setIsFormOpen(false);
        await fetchData();
      }
    } catch (error) {
      console.error("Product save error:", error);
      setError(axios.isAxiosError(error)
        ? error.response?.data?.message || "Failed to save product. Please try again."
        : error instanceof Error ? error.message : "Failed to save product. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==============================
  // Edit Product
  // ==============================

  const handleEdit = (product: Product) => {
    const categoryId =
      typeof product.category === "string"
        ? product.category
        : product.category?._id;

    setEditingProduct(product);
    setVariants((product.variants ?? []).map((variant) => ({ _id: variant._id, quantity: String(variant.quantity), unit: variant.unit, price: String(variant.price), discountPrice: variant.discountPrice == null ? "" : String(variant.discountPrice), stock: String(variant.stock), isActive: variant.isActive })));

    setForm({
      name: product.name,
      description: product.description || "",
      category: categoryId || "",
      subCategory: typeof product.subCategory === "string"
        ? product.subCategory
        : product.subCategory?._id || "",
    });

    setImageFile(null);
    setImagePreview(product.image || "");
    setError("");
    setSuccess("");
    setIsLoadingSubcategories(Boolean(categoryId));
    setSubcategoryLoadError("");
    setIsFormOpen(true);
  };

  const addVariant = () => setVariants((current) => [...current, { quantity: "", unit: "g", price: "", discountPrice: "", stock: "" }]);
  const updateVariant = (index: number, key: keyof VariantForm, value: string) => setVariants((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));

  // ==============================
  // Delete Product
  // ==============================

  const handleDelete = async (productId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await deleteProduct(productId);

      if (response?.success) {
        setSuccess("Product deleted successfully.");
        await fetchData();
      }
    } catch (error) {
      console.error("Delete product error:", error);

      setError("Failed to delete product.");
    }
  };

  // ==============================
  // Restore Product
  // ==============================

  const handleRestore = async (productId: string) => {
    try {
      setError("");
      setSuccess("");

      const response = await restoreProduct(productId);

      if (response?.success) {
        setSuccess("Product restored successfully.");
        await fetchData();
      }
    } catch (error) {
      console.error("Restore product error:", error);

      setError("Failed to restore product.");
    }
  };

  const existingSubcategory = editingProduct?.subCategory;
  const existingSubcategoryId = typeof existingSubcategory === "string"
    ? existingSubcategory
    : existingSubcategory?._id;
  const existingCategoryId = typeof editingProduct?.category === "string"
    ? editingProduct.category
    : editingProduct?.category?._id;
  const existingCategoryName = typeof editingProduct?.category === "object" && editingProduct.category
    ? editingProduct.category.name
    : "Previously assigned category";
  const needsSubcategoryReplacement = Boolean(
    editingProduct && existingSubcategoryId && existingCategoryId === form.category &&
    !subcategories.some((subcategory) => subcategory._id === existingSubcategoryId),
  );

  // ==============================
  // Loading
  // ==============================

  if (isLoading) {
    return (
      <div className="vendor-products-page">
        <div className="vendor-products-loading">Loading products...</div>
      </div>
    );
  }

  // ==============================
  // UI
  // ==============================

  return (
    <div className="vendor-products-page">
      <div className="vendor-products-container">
        {/* Header */}

        <div className="vendor-products-header">
          <div>
            <h1>Manage Products</h1>
            <p>Add, edit and manage your products.</p>
          </div>

          <div className="vendor-products-header-actions">
            <button
              type="button"
              className="add-products-button"
              onClick={openAddForm}
            >
              <span className="add-products-icon">+</span>
              Add Products
            </button>
          </div>
        </div>

        {/* Messages */}

        {error && !isFormOpen && (
          <div className="vendor-product-error">{error}</div>
        )}

        {success && <div className="vendor-product-success">{success}</div>}

        {/* Main Content */}

        <div className="vendor-products-content">
          {/* Product List */}

          <section className="vendor-product-list-section">
            {products.length === 0 ? (
              <div className="no-products">
                <h3>No products found</h3>
                <p>Click &quot;Add Products&quot; to add your first product.</p>

                <button
                  type="button"
                  className="empty-state-add-button"
                  onClick={openAddForm}
                >
                  + Add Products
                </button>
              </div>
            ) : (
              <>
              <div className="vendor-products-grid">
              {products.map((product) => {
                  const categoryName =
                    typeof product.category === "string"
                      ? product.category
                      : product.category?.name;

                  const isActive = product.isActive !== false;

                  return (
                    <div
                      className={`vendor-product-card ${
                        !isActive ? "inactive-product" : ""
                      }`}
                      key={product._id}
                    >
                      {/* Image */}

                      <div className="vendor-product-image">
                        {product.image ? (
                          <img src={product.image} alt={product.name} />
                        ) : (
                          <div className="no-image">No Image</div>
                        )}

                        <span
                          className={`product-status ${
                            isActive ? "active" : "inactive"
                          }`}
                        >
                          {isActive ? "Active" : "Deleted"}
                        </span>
                      </div>

                      {/* Info */}

                      <div className="vendor-product-info">
                        <h3>{product.name}</h3>

                      <p className="vendor-product-category">
                          {categoryName}{typeof product.subCategory === "object" && product.subCategory ? ` · ${product.subCategory.name}` : ""}
                        </p>

                        <div className="vendor-product-price">
                          {product.variants?.filter((variant) => variant.isActive).map((variant) => <p key={variant._id}>{variant.quantity} {variant.unit}: <strong>{String.fromCharCode(0x20b9)}{variant.discountPrice ?? variant.price}</strong>{variant.discountPrice != null && <del> {String.fromCharCode(0x20b9)}{variant.price}</del>} <small>Stock: {variant.stock}</small></p>)}
                        </div>

                        {/* Actions */}

                        <div className="vendor-product-actions">
                          {isActive ? (
                            <>
                              <button
                                type="button"
                                className="edit-product-button"
                                onClick={() => handleEdit(product)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="delete-product-button"
                                onClick={() => handleDelete(product._id)}
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="edit-product-button"
                                onClick={() => handleEdit(product)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="restore-product-button"
                                onClick={() => handleRestore(product._id)}
                              >
                                Restore
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
              })}
              </div>
              <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
              </>
            )}
          </section>
        </div>
      </div>

      {/* Add / Edit Product Modal */}

      {isFormOpen && (
        <div
          className="product-form-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section
            className="product-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <div className="form-header">
              <div>
                <h2 id="product-form-title">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>

                <p>
                  {editingProduct
                    ? "Update the details of your product."
                    : "Enter the details below to add a new product."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeForm}
                disabled={isSubmitting}
                aria-label="Close product form"
              >
                ×
              </button>
            </div>

            {error && <div className="vendor-product-error">{error}</div>}

            <form className="product-form" onSubmit={handleSubmit}>
              {/* Product Name */}

              <div className="form-group">
                <label htmlFor="name">Product Name</label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. Fresh Apple"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              {/* Category */}

              <div className="form-group">
                <label htmlFor="category">Category</label>

                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                >
                  <option value="">Select Category</option>

                  {editingProduct && existingCategoryId && !categories.some((category) => category._id === existingCategoryId) && (
                    <option value={existingCategoryId} disabled>{existingCategoryName} (inactive — choose an active category)</option>
                  )}

                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="subCategory">Subcategory</label>
                <select
                  id="subCategory"
                  name="subCategory"
                  value={form.subCategory}
                  onChange={handleChange}
                  disabled={!form.category || isLoadingSubcategories || Boolean(subcategoryLoadError)}
                >
                  <option value="" disabled={needsSubcategoryReplacement}>
                    {isLoadingSubcategories ? "Loading subcategories…" : "No subcategory (optional)"}
                  </option>
                  {needsSubcategoryReplacement && existingSubcategory && typeof existingSubcategory !== "string" && (
                    <option value={existingSubcategoryId} disabled>
                      {existingSubcategory.name} (inactive — choose a replacement)
                    </option>
                  )}
                  {subcategories.map((subcategory) => (
                    <option key={subcategory._id} value={subcategory._id}>{subcategory.name}</option>
                  ))}
                </select>
                {subcategoryLoadError ? (
                  <>
                    <small className="vendor-subcategory-message error">{subcategoryLoadError}</small>
                    <button type="button" className="vendor-subcategory-retry" onClick={() => { setIsLoadingSubcategories(true); setSubcategoryLoadError(""); setSubcategoryRetry((current) => current + 1); }}>Retry subcategories</button>
                  </>
                ) : needsSubcategoryReplacement ? (
                  <small className="vendor-subcategory-message error">The assigned subcategory is inactive. Choose an active replacement before saving.</small>
                ) : !isLoadingSubcategories && form.category && subcategories.length === 0 ? (
                  <small className="vendor-subcategory-message">No subcategories are available. You can save with no subcategory.</small>
                ) : null}
              </div>

              {/* Price */}

              <div className="form-group form-group-full">
                <label>Product variants</label>
                <small>Enter the pack size, original price, optional discounted price and available stock for each option.</small>
                {variants.map((variant, index) => (
                  <div key={variant._id ?? `new-${index}`} className="variant-editor-row">
                    <input aria-label="Variant quantity" type="number" min="0.001" step="any" placeholder="Quantity" value={variant.quantity} onChange={(event) => updateVariant(index, "quantity", event.target.value)} required />
                    <select aria-label="Variant unit" value={variant.unit} onChange={(event) => updateVariant(index, "unit", event.target.value)}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
                    <input aria-label="Variant price" type="number" min="0.01" step="any" placeholder="Price (₹)" value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} required />
                    <input aria-label="Variant discount price (optional)" type="number" min="0.01" step="any" placeholder="Discount price (optional)" value={variant.discountPrice} onChange={(event) => updateVariant(index, "discountPrice", event.target.value)} />
                    <input aria-label="Variant stock" type="number" min="0" step="1" placeholder="Stock" value={variant.stock} onChange={(event) => updateVariant(index, "stock", event.target.value)} required />
                    <button type="button" onClick={() => setVariants((current) => current.filter((_, i) => i !== index))} aria-label={`Remove variant ${index + 1}`}>Remove</button>
                  </div>
                ))}
                <button type="button" onClick={addVariant}>Add Another Variant</button>
                {editingProduct && !(editingProduct.variants?.length) && <small>This older product has no recorded variant sizes. Enter each real variant with its correct price and stock. Legacy product level values remain archived for review and are not copied automatically.</small>}
              </div>

              {/* Image */}

              <div className="form-group form-group-full">
                <label htmlFor="image">Product Image</label>

                <input
                  id="image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                />

                <small>
                  JPG, JPEG, PNG or WEBP. Maximum size: 5MB.
                  {editingProduct
                    ? " Leave empty to keep the current image."
                    : ""}
                </small>

                {imagePreview && (
                  <div className="product-image-preview">
                    <img src={imagePreview} alt="Product preview" />
                  </div>
                )}
              </div>

              {/* Description */}

              <div className="form-group form-group-full">
                <label htmlFor="description">Description</label>

                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Enter product description"
                  value={form.description}
                  onChange={handleChange}
                />
              </div>

              {/* Submit */}

              <div className="form-actions">
                <button
                  type="submit"
                  className="submit-product-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingProduct
                      ? "Update Product"
                      : "Add Product"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default VendorProducts;
