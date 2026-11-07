import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  getCategoryById,
  getProductsByCategory,
  getSubcategories,
} from "../../services/productService";
import type { Category, Product } from "../../types/product";
import { activeSubcategoriesForParent, getDefaultSubcategoryId } from "../../utils/categorySelection";
import ProductCard from "../../components/user/ProductCard";
import "./CategoryProducts.css";

const PAGE_SIZE = 15;

interface ProductPage {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
}

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
  const [pagination, setPagination] = useState<ProductPage>({ currentPage: 1, totalPages: 1, totalItems: 0, hasNextPage: false });
  const [hasLoadedFirstPage, setHasLoadedFirstPage] = useState(false);
  const productScrollRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);
  const requestedPageRef = useRef(1);
  const generationRef = useRef(0);

  useEffect(() => {
    let current = true;
    generationRef.current += 1;
    inFlightRef.current = false;
    requestedPageRef.current = 1;
    setIsInitialLoading(true);
    setCategoryError("");
    setProductError("");
    setCategoryReadyId("");
    setCategory(null);
    setSubcategories([]);
    setSelectedSubcategory("");
    setProducts([]);
    setPage(1);
    setPagination({ currentPage: 1, totalPages: 1, totalItems: 0, hasNextPage: false });
    setHasLoadedFirstPage(false);

    if (!categoryId) {
      setIsInitialLoading(false);
      return () => { current = false; };
    }

    Promise.all([getCategoryById(categoryId), getSubcategories(categoryId)])
      .then(([categoryResponse, subcategoryResponse]) => {
        if (!current) return;
        if (!categoryResponse?.success || !categoryResponse.data) throw new Error("Category not found.");
        if (!subcategoryResponse?.success || !Array.isArray(subcategoryResponse.data)) throw new Error("Failed to load subcategories.");
        const activeSubcategories = activeSubcategoriesForParent(subcategoryResponse.data as Category[], categoryId);
        setCategory(categoryResponse.data as Category);
        setSubcategories(activeSubcategories);
        const urlSubcategory = new URLSearchParams(window.location.search).get("subCategory") || "";
        setSelectedSubcategory(
          activeSubcategories.some((item) => item._id === urlSubcategory)
            ? urlSubcategory
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

  // Keep direct links reactive when the query string changes while this page is open.
  useEffect(() => {
    if (categoryReadyId !== categoryId || !requestedSubcategoryId) return;
    if (!subcategories.some((item) => item._id === requestedSubcategoryId)) return;
    if (selectedSubcategory !== requestedSubcategoryId) {
      generationRef.current += 1;
      inFlightRef.current = false;
      requestedPageRef.current = 1;
      setPage(1);
      setProducts([]);
      setPagination({ currentPage: 1, totalPages: 1, totalItems: 0, hasNextPage: false });
      setHasLoadedFirstPage(false);
      setProductError("");
      setIsProductsLoading(false);
      if (productScrollRef.current) productScrollRef.current.scrollTop = 0;
      setSelectedSubcategory(requestedSubcategoryId);
    }
  }, [categoryId, categoryReadyId, requestedSubcategoryId, selectedSubcategory, subcategories]);

  const loadNextPage = useCallback(() => {
    if (inFlightRef.current || requestedPageRef.current > page || !pagination.hasNextPage || productError) return;
    const next = page + 1;
    requestedPageRef.current = next;
    setPage(next);
  }, [page, pagination.hasNextPage, productError]);

  useEffect(() => {
    if (!categoryId || categoryReadyId !== categoryId || categoryError) return;
    if (subcategories.length > 0 && !subcategories.some((item) => item._id === selectedSubcategory)) return;
    if (inFlightRef.current) return;

    let current = true;
    const generation = generationRef.current;
    inFlightRef.current = true;
    setIsProductsLoading(true);
    setProductError("");

    getProductsByCategory(categoryId, page, PAGE_SIZE, selectedSubcategory || undefined)
      .then((response) => {
        if (!current || generation !== generationRef.current) return;
        if (!response?.success || !Array.isArray(response.data)) throw new Error("Failed to load products.");
        const meta = response.pagination || {};
        const nextPagination: ProductPage = {
          currentPage: Number(meta.currentPage) || page,
          totalPages: Number(meta.totalPages) || 1,
          totalItems: Number(meta.totalItems) || 0,
          hasNextPage: Boolean(meta.hasNextPage),
        };
        setProducts((existing) => {
          const combined = page === 1 ? response.data as Product[] : [...existing, ...response.data as Product[]];
          const unique = new Map<string, Product>();
          combined.forEach((product) => unique.set(product._id, product));
          return [...unique.values()];
        });
        setPagination(nextPagination);
        requestedPageRef.current = nextPagination.currentPage;
        setHasLoadedFirstPage(true);
      })
      .catch((requestError: unknown) => {
        if (!current || generation !== generationRef.current) return;
        setProductError(requestError instanceof Error ? requestError.message : "Failed to load products. Please try again.");
      })
      .finally(() => {
        if (current && generation === generationRef.current) {
          inFlightRef.current = false;
          setIsProductsLoading(false);
        }
      });

    return () => { current = false; };
  }, [categoryId, categoryReadyId, categoryError, selectedSubcategory, subcategories, page, productRetry]);

  // The observer root is the product pane itself, so the browser window never drives loading.
  useEffect(() => {
    const root = productScrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !pagination.hasNextPage || productError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNextPage();
    }, { root, rootMargin: "240px 0px", threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadNextPage, pagination.hasNextPage, products.length, productError]);

  const selectSubcategory = (subcategoryId: string) => {
    if (subcategoryId === selectedSubcategory) return;
    generationRef.current += 1;
    requestedPageRef.current = 1;
    inFlightRef.current = false;
    setPage(1);
    setProducts([]);
    setPagination({ currentPage: 1, totalPages: 1, totalItems: 0, hasNextPage: false });
    setHasLoadedFirstPage(false);
    setProductError("");
    setIsProductsLoading(false);
    setSelectedSubcategory(subcategoryId);
    if (productScrollRef.current) productScrollRef.current.scrollTop = 0;
  };

  const retryProducts = () => {
    setProductError("");
    setProductRetry((retry) => retry + 1);
  };

  if (!categoryId) {
    return <div className="category-products-page"><div className="category-products-error"><h2>Category not found</h2><p>Choose a category from the home page to continue shopping.</p><Link to="/">Go back home</Link></div></div>;
  }

  if (isInitialLoading || categoryReadyId !== categoryId) {
    return <div className="category-products-page"><div className="category-products-loading"><div className="category-products-spinner" /><p>Loading category...</p></div></div>;
  }

  if (categoryError) {
    return <div className="category-products-page"><div className="category-products-error"><div className="category-products-error-icon" aria-hidden="true">⚠️</div><h2>Something went wrong</h2><p>{categoryError}</p><Link to="/">Go back home</Link></div></div>;
  }

  const currentSubcategory = subcategories.find((item) => item._id === selectedSubcategory);
  return (
    <div className="category-products-page">
      <section className="category-shopping-container" aria-label={`${category?.name || "Category"} shopping`}>
        <div className={`category-products-layout${subcategories.length ? " has-subcategories" : ""}`}>
          {subcategories.length > 0 && (
            <aside className="category-subcategory-sidebar">
              <nav className="category-subcategory-nav" aria-label="Subcategories">
                {subcategories.map((subcategory) => (
                  <button type="button" key={subcategory._id}
                    className={`category-subcategory-option${subcategory._id === selectedSubcategory ? " active" : ""}`}
                    onClick={() => selectSubcategory(subcategory._id)}
                    aria-current={subcategory._id === selectedSubcategory ? "true" : undefined}>
                    {subcategory.image ? <img src={subcategory.image} alt="" /> : <span className="category-subcategory-placeholder" aria-hidden="true">▧</span>}
                    <span>{subcategory.name}</span>
                  </button>
                ))}
              </nav>
            </aside>
          )}

          <section ref={productScrollRef} className="category-products-main" aria-label="Category products" aria-busy={isProductsLoading}>
            <div className="category-products-result">
              <span>{pagination.totalItems} {pagination.totalItems === 1 ? "product" : "products"} available</span>
            </div>

            {productError && !hasLoadedFirstPage ? (
              <div className="category-products-inline-error" role="alert"><span>{productError}</span><button type="button" onClick={retryProducts}>Retry</button></div>
            ) : products.length > 0 ? (
              <>
                <div className="category-products-grid">
                  {products.map((product) => <ProductCard key={product._id} product={product} variant="category" />)}
                  {isProductsLoading && Array.from({ length: 6 }, (_, index) => <div className="category-product-skeleton" key={`skeleton-${index}`} aria-hidden="true"><span className="category-product-skeleton-image" /><span className="category-product-skeleton-line" /><span className="category-product-skeleton-line short" /></div>)}
                </div>
                <div ref={sentinelRef} className="category-products-sentinel" aria-hidden="true" />
                {productError && <div className="category-products-inline-error" role="alert"><span>{productError}</span><button type="button" onClick={retryProducts}>Retry</button></div>}
                {hasLoadedFirstPage && !pagination.hasNextPage && <p className="category-products-end">You’ve reached the end of the list.</p>}
              </>
            ) : isProductsLoading || !hasLoadedFirstPage ? (
              <div className="category-products-grid category-products-grid--loading" aria-label="Loading products">
                {Array.from({ length: 15 }, (_, index) => <div className="category-product-skeleton" key={index}><span className="category-product-skeleton-image" /><span className="category-product-skeleton-line" /><span className="category-product-skeleton-line short" /></div>)}
              </div>
            ) : (
              <div className="category-products-empty"><div className="category-products-empty-icon" aria-hidden="true">🛒</div><h2>No Products Found</h2><p>{currentSubcategory ? `There are currently no products in ${currentSubcategory.name}.` : "There are currently no products available in this category."}</p><Link to="/">Continue Shopping</Link></div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};

export default CategoryProducts;
