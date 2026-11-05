import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  getCategoryById,
  getProductsByCategory,
  getSubcategories,
} from "../../services/productService";
import type { Category, Product } from "../../types/product";
import { activeSubcategoriesForParent, getDefaultSubcategoryId } from "../../utils/categorySelection";
import ProductCard from "../../components/user/ProductCard";
import Pagination from "../../components/common/Pagination";
import "./CategoryProducts.css";

const CategoryProducts = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [searchParams] = useSearchParams();
  const requestedSubcategoryId = searchParams.get("subCategory") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [categoryReadyId, setCategoryReadyId] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [productError, setProductError] = useState("");
  const [productRetry, setProductRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Category details and subcategories are fetched only when the parent changes.
  useEffect(() => {
    let current = true;

    if (!categoryId) {
      setIsInitialLoading(false);
      return () => { current = false; };
    }

    setIsInitialLoading(true);
    setCategoryError("");
    setProductError("");
    setCategoryReadyId("");
    setCategory(null);
    setSubcategories([]);
    setSelectedSubcategory("");
    setProducts([]);
    setPage(1);
    setTotalPages(1);
    setTotalItems(0);

    Promise.all([getCategoryById(categoryId), getSubcategories(categoryId)])
      .then(([categoryResponse, subcategoryResponse]) => {
        if (!current) return;
        if (!categoryResponse?.success || !categoryResponse.data) throw new Error("Category not found.");
        if (!subcategoryResponse?.success || !Array.isArray(subcategoryResponse.data)) throw new Error("Failed to load subcategories.");
        const activeSubcategories = activeSubcategoriesForParent(subcategoryResponse.data as Category[], categoryId);
        setCategory(categoryResponse.data as Category);
        setSubcategories(activeSubcategories);
        const requestedSubcategory = new URLSearchParams(window.location.search).get("subCategory");
        setSelectedSubcategory(
          activeSubcategories.some((item) => item._id === requestedSubcategory)
            ? requestedSubcategory || ""
            : getDefaultSubcategoryId(activeSubcategories),
        );
        setCategoryReadyId(categoryId);
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        setCategoryError(requestError instanceof Error ? requestError.message : "Failed to load category.");
      })
      .finally(() => {
        if (current) setIsInitialLoading(false);
      });

    return () => { current = false; };
  }, [categoryId]);

  useEffect(() => {
    if (!requestedSubcategoryId || categoryReadyId !== categoryId) return;
    if (!subcategories.some((item) => item._id === requestedSubcategoryId)) return;
    setSelectedSubcategory((current) => current === requestedSubcategoryId ? current : requestedSubcategoryId);
    setPage((current) => current === 1 ? current : 1);
  }, [categoryId, categoryReadyId, requestedSubcategoryId, subcategories]);

  // A per-effect cleanup token ensures an older request can never commit results
  // or clear the loading state for a newer category, subcategory, page, or retry.
  useEffect(() => {
    if (!categoryId || categoryReadyId !== categoryId || categoryError) return;
    if (subcategories.length > 0 && !subcategories.some((item) => item._id === selectedSubcategory)) return;

    let current = true;
    setIsProductsLoading(true);
    setProductError("");

    getProductsByCategory(categoryId, page, 10, selectedSubcategory || undefined)
      .then((response) => {
        if (!current) return;
        if (!response?.success || !Array.isArray(response.data)) throw new Error("Failed to load products.");
        const nextPageCount = response.pagination?.totalPages || 1;
        setProducts(response.data as Product[]);
        setTotalPages(nextPageCount);
        setTotalItems(response.pagination?.totalItems || 0);
        if (page > nextPageCount) setPage(nextPageCount);
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        setProductError(requestError instanceof Error ? requestError.message : "Failed to load products. Please try again.");
      })
      .finally(() => {
        if (current) setIsProductsLoading(false);
      });

    return () => { current = false; };
  }, [categoryId, categoryReadyId, categoryError, selectedSubcategory, subcategories, page, productRetry]);

  const selectSubcategory = (subcategoryId: string) => {
    if (subcategoryId === selectedSubcategory) return;
    setPage(1);
    setSelectedSubcategory(subcategoryId);
  };

  const changePage = (nextPage: number) => {
    if (nextPage === page) return;
    setPage(nextPage);
  };

  if (!categoryId) {
    return (
      <div className="category-products-page">
        <div className="category-products-error">
          <h2>Category not found</h2>
          <p>Choose a category from the home page to continue shopping.</p>
          <Link to="/">Go back home</Link>
        </div>
      </div>
    );
  }

  if (isInitialLoading || categoryReadyId !== categoryId) {
    return (
      <div className="category-products-page">
        <div className="category-products-loading"><div className="category-products-spinner" /><p>Loading category...</p></div>
      </div>
    );
  }

  if (categoryError) {
    return (
      <div className="category-products-page">
        <div className="category-products-error">
          <div className="category-products-error-icon" aria-hidden="true">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{categoryError}</p>
          <Link to="/">Go back home</Link>
        </div>
      </div>
    );
  }

  const currentSubcategory = subcategories.find((item) => item._id === selectedSubcategory);

  return (
    <div className="category-products-page">
      <div className="category-products-container">
        <div className="category-products-header">
          <div>
            <span className="category-products-eyebrow">QUICKCART</span>
            <h1>{category?.name || "Category Products"}</h1>
            <p>Fresh products from this category, delivered quickly to your door.</p>
          </div>
          <Link to="/" className="category-products-back">← Back to Home</Link>
        </div>

        <div className={`category-products-layout${subcategories.length ? " has-subcategories" : ""}`}>
          {subcategories.length > 0 && (
            <aside className="category-subcategory-sidebar">
              <h2>Shop by category</h2>
              <nav className="category-subcategory-nav" aria-label="Subcategories">
                {subcategories.map((subcategory) => (
                  <button
                    type="button"
                    key={subcategory._id}
                    className={`category-subcategory-option${subcategory._id === selectedSubcategory ? " active" : ""}`}
                    onClick={() => selectSubcategory(subcategory._id)}
                    aria-current={subcategory._id === selectedSubcategory ? "true" : undefined}
                  >
                    {subcategory.image ? <img src={subcategory.image} alt="" /> : <span className="category-subcategory-placeholder" aria-hidden="true">▧</span>}
                    <span>{subcategory.name}</span>
                  </button>
                ))}
              </nav>
            </aside>
          )}

          <section className="category-products-main" aria-label="Category products" aria-busy={isProductsLoading}>
            <div className="category-products-result">
              <strong>{currentSubcategory?.name || category?.name}</strong>
              <span>{totalItems} {totalItems === 1 ? "product" : "products"} available</span>
            </div>

            {productError ? (
              <div className="category-products-inline-error" role="alert">
                <span>{productError}</span>
                <button type="button" onClick={() => setProductRetry((retry) => retry + 1)}>Retry</button>
              </div>
            ) : isProductsLoading ? (
              <div className="category-products-grid category-products-grid--loading" aria-label="Loading products">
                {Array.from({ length: Math.min(4, Math.max(products.length, 2)) }, (_, index) => (
                  <div className="category-product-skeleton" key={index}>
                    <span className="category-product-skeleton-image" />
                    <span className="category-product-skeleton-line" />
                    <span className="category-product-skeleton-line short" />
                  </div>
                ))}
                <span className="category-products-loading-label">Loading products…</span>
              </div>
            ) : products.length > 0 ? (
              <div className="category-products-grid">
                {products.map((product) => <ProductCard key={product._id} product={product} variant="category" />)}
              </div>
            ) : (
              <div className="category-products-empty">
                <div className="category-products-empty-icon" aria-hidden="true">🛒</div>
                <h2>No Products Found</h2>
                <p>{currentSubcategory ? `There are currently no products in ${currentSubcategory.name}.` : "There are currently no products available in this category."}</p>
                <Link to="/">Continue Shopping</Link>
              </div>
            )}
            <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={changePage} />
          </section>
        </div>
      </div>
    </div>
  );
};

export default CategoryProducts;
