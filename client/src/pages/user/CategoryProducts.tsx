import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getCategories,
  getProductsByCategory,
} from "../../services/productService";

import type { Category, Product } from "../../types/product";

import ProductCard from "../../components/user/ProductCard";
import Pagination from "../../components/common/Pagination";

import "./CategoryProducts.css";

const CategoryProducts = () => {
  const { categoryId } = useParams<{ categoryId: string }>();

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (!categoryId) {
      setError("Category not found.");
      setIsLoading(false);
      return;
    }

    const fetchCategoryProducts = async () => {
      try {
        setIsLoading(true);
        setError("");

        const [productsResponse, categoriesResponse] = await Promise.all([
          getProductsByCategory(categoryId, page, 10),
          getCategories(),
        ]);

        if (productsResponse?.success) {
          setProducts(productsResponse.data || []);
          setTotalPages(productsResponse.pagination?.totalPages || 1);
          if (page > (productsResponse.pagination?.totalPages || 1)) setPage(productsResponse.pagination?.totalPages || 1);
          setTotalItems(productsResponse.pagination?.totalItems || 0);
        } else {
          setProducts([]);
        }

        if (categoriesResponse?.success) {
          const foundCategory = (categoriesResponse.data || []).find(
            (item: Category) => item._id === categoryId,
          );

          setCategory(foundCategory || null);
        }
      } catch (error) {
        console.error("Failed to load category products:", error);

        setError("Failed to load products. Please try again.");

        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategoryProducts();
  }, [categoryId, page]);

  if (isLoading) {
    return (
      <div className="category-products-page">
        <div className="category-products-loading">
          <div className="category-products-spinner" />
          <p>Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="category-products-page">
        <div className="category-products-error">
          <div className="category-products-error-icon">⚠️</div>

          <h2>Something went wrong</h2>

          <p>{error}</p>

          <Link to="/">Go back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="category-products-page">
      <div className="category-products-container">
        <div className="category-products-header">
          <div>
            <span className="category-products-eyebrow">QUICKCART</span>

            <h1>{category?.name || "Category Products"}</h1>

            <p>
              Fresh products from this category, delivered quickly to your door.
            </p>
          </div>

          <Link to="/" className="category-products-back">
            ← Back to Home
          </Link>
        </div>

        <div className="category-products-result">
          <span>
            {products.length} {products.length === 1 ? "product" : "products"}{" "}
            available
          </span>
        </div>

        {products.length > 0 ? (
          <div className="category-products-grid">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <div className="category-products-empty">
            <div className="category-products-empty-icon">🛒</div>

            <h2>No Products Found</h2>

            <p>There are currently no products available in this category.</p>

            <Link to="/">Continue Shopping</Link>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default CategoryProducts;
