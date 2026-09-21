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

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  // ==============================
  // Reset Form
  // ==============================

  const resetForm = () => {
    setForm(initialForm);
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview("");
  };

  // ==============================
  // Submit Product
  // ==============================

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    // Validation
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

      // Update existing product
      if (editingProduct) {
        const response = await updateProduct(editingProduct._id, formData);

        if (response?.success) {
          setSuccess("Product updated successfully.");
          resetForm();
          await fetchData();
        }

        return;
      }

      // Create new product
      const response = await createProduct(formData);

      if (response?.success) {
        setSuccess("Product added successfully.");
        resetForm();
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

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

        {/* Error */}
        {error && <div className="vendor-product-error">{error}</div>}

        {/* Success */}
        {success && <div className="vendor-product-success">{success}</div>}

        {/* ==============================
            Add / Edit Product Form
        ============================== */}

        <section className="product-form-section">
          <div className="form-header">
            <h2>{editingProduct ? "Edit Product" : "Add New Product"}</h2>

            {editingProduct && (
              <button
                type="button"
                className="cancel-button"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>

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

              {editingProduct && (
                <button
                  type="button"
                  className="cancel-button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ==============================
            Product List
        ============================== */}

        <section className="vendor-product-list-section">
          <div className="list-header">
            <h2>My Products</h2>
          </div>

          {products.length === 0 ? (
            <div className="no-products">
              <h3>No products found</h3>

              <p>Add your first product using the form above.</p>
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

                      <p className="vendor-product-category">{categoryName}</p>

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
  );
};

export default VendorProducts;
