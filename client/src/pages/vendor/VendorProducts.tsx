import { useEffect, useState } from "react";

import {
  createProduct,
  deleteProduct,
  getCategories,
  getVendorProducts,
  restoreProduct,
  updateProduct,
} from "../../services/productService";

import type { Category, Product } from "../../types/product";

import "./VendorProducts.css";

interface ProductForm {
  name: string;
  description: string;
  price: string;
  discountPrice: string;
  stock: string;
  category: string;
}

const initialForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  stock: "",
  category: "",
};

const VendorProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  // ==============================
  // Fetch Vendor Products + Categories
  // ==============================

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError("");

      const [productResponse, categoryResponse] = await Promise.all([
        getVendorProducts(),
        getCategories(),
      ]);

      if (productResponse?.success) {
        setProducts(productResponse.data || []);
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
  };

  useEffect(() => {
    fetchData();
  }, []);

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

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
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

    if (!form.price || Number(form.price) <= 0) {
      setError("Please enter a valid price.");
      return;
    }

    if (form.discountPrice && Number(form.discountPrice) < 0) {
      setError("Please enter a valid discount price.");
      return;
    }

    if (
      form.discountPrice &&
      Number(form.discountPrice) >= Number(form.price)
    ) {
      setError("Discount price must be less than the original price.");
      return;
    }

    if (form.stock === "" || Number(form.stock) < 0) {
      setError("Please enter a valid stock.");
      return;
    }

    if (!form.category) {
      setError("Please select a category.");
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();

      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("price", form.price);
      formData.append("stock", form.stock);
      formData.append("category", form.category);

      if (form.discountPrice) {
        formData.append("discountPrice", form.discountPrice);
      }

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

      setError("Failed to save product. Please try again.");
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

    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      discountPrice:
        product.discountPrice !== undefined
          ? String(product.discountPrice)
          : "",
      stock: String(product.stock),
      category: categoryId || "",
    });

    setImageFile(null);
    setImagePreview(product.image || "");
    setError("");
    setSuccess("");
    setIsFormOpen(true);
  };

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

          <div className="product-count">{products.length} Products</div>
        </div>

        {/* Messages */}

        {error && !isFormOpen && (
          <div className="vendor-product-error">{error}</div>
        )}

        {success && <div className="vendor-product-success">{success}</div>}

        {/* Main Content */}

        <div className="vendor-products-content">
          {/* Left Action Panel */}

          <aside className="vendor-products-sidebar">
            <div className="vendor-products-sidebar-card">
              <h2>Products</h2>

              <p>
                Add a new product or manage the products already listed in your
                store.
              </p>

              <button
                type="button"
                className="add-products-button"
                onClick={openAddForm}
              >
                <span className="add-products-icon">+</span>
                Add Products
              </button>
            </div>
          </aside>

          {/* Product List */}

          <section className="vendor-product-list-section">
            <div className="list-header">
              <div>
                <h2>My Products</h2>
                <p>View and manage all products added by your store.</p>
              </div>
            </div>

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
                          {categoryName}
                        </p>

                        <div className="vendor-product-price">
                          <strong>
                            ₹{product.discountPrice ?? product.price}
                          </strong>

                          {product.discountPrice !== undefined && (
                            <span>₹{product.price}</span>
                          )}
                        </div>

                        <p className="vendor-product-stock">
                          Stock: {product.stock}
                        </p>

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
                            <button
                              type="button"
                              className="restore-product-button"
                              onClick={() => handleRestore(product._id)}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}

              <div className="form-group">
                <label htmlFor="price">Price</label>

                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  placeholder="e.g. 120"
                  value={form.price}
                  onChange={handleChange}
                />
              </div>

              {/* Discount Price */}

              <div className="form-group">
                <label htmlFor="discountPrice">Discount Price</label>

                <input
                  id="discountPrice"
                  name="discountPrice"
                  type="number"
                  min="0"
                  placeholder="Optional"
                  value={form.discountPrice}
                  onChange={handleChange}
                />
              </div>

              {/* Stock */}

              <div className="form-group">
                <label htmlFor="stock">Stock</label>

                <input
                  id="stock"
                  name="stock"
                  type="number"
                  min="0"
                  placeholder="e.g. 50"
                  value={form.stock}
                  onChange={handleChange}
                />
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
