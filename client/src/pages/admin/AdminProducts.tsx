import { useEffect, useState } from "react";
import axios from "axios";

import { getAdminProducts } from "../../services/adminService";

import "./AdminProducts.css";

interface AdminProduct {
  _id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  discountPrice?: number;
  stock: number;
  category:
    | {
        _id: string;
        name: string;
        image?: string;
      }
    | string;
  vendor:
    | {
        _id: string;
        name?: string;
        shopName?: string;
        email?: string;
      }
    | string;
  isActive: boolean;
  createdAt: string;
}

const AdminProducts = () => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminProducts();

      if (response?.success) {
        setProducts(response.data || []);
      } else {
        setError("Failed to load products.");
      }
    } catch (error: unknown) {
      console.error("Get admin products error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to load products.");
      } else {
        setError("Failed to load products.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  if (isLoading) {
    return (
      <div className="admin-products-page">
        <div className="admin-products-loading">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="admin-products-page">
      <div className="admin-products-container">
        <div className="admin-page-header">
          <div>
            <h1>Manage Products</h1>
            <p>View products added by QuickCart vendors.</p>
          </div>

          <div className="admin-count">
            {products.length} {products.length === 1 ? "Product" : "Products"}
          </div>
        </div>

        {error && <div className="admin-page-error">{error}</div>}

        {products.length === 0 ? (
          <div className="admin-empty">
            <div>📦</div>
            <h3>No Products Found</h3>
            <p>There are no products available.</p>
          </div>
        ) : (
          <div className="admin-products-grid">
            {products.map((product) => {
              const category =
                typeof product.category === "object"
                  ? product.category.name
                  : "N/A";

              const vendor =
                typeof product.vendor === "object"
                  ? product.vendor.shopName || product.vendor.name
                  : "N/A";

              const hasDiscount =
                product.discountPrice !== undefined &&
                product.discountPrice < product.price;

              return (
                <div className="admin-product-card" key={product._id}>
                  <div className="admin-product-image-wrapper">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="admin-product-image"
                    />

                    <span
                      className={`product-active-badge ${
                        product.isActive ? "active" : "inactive"
                      }`}
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="admin-product-content">
                    <h3>{product.name}</h3>

                    <p className="admin-product-description">
                      {product.description}
                    </p>

                    <div className="admin-product-price">
                      {hasDiscount ? (
                        <>
                          <strong>₹{product.discountPrice}</strong>
                          <span>₹{product.price}</span>
                        </>
                      ) : (
                        <strong>₹{product.price}</strong>
                      )}
                    </div>

                    <div className="admin-product-details">
                      <div>
                        <span>Category</span>
                        <strong>{category}</strong>
                      </div>

                      <div>
                        <span>Stock</span>
                        <strong>{product.stock}</strong>
                      </div>

                      <div>
                        <span>Vendor</span>
                        <strong>{vendor}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProducts;
