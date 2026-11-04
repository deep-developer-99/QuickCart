import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [categoryReadyId, setCategoryReadyId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let current = true;

    if (!categoryId) {
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
        setSelectedSubcategory(getDefaultSubcategoryId(activeSubcategories));
        setCategoryReadyId(categoryId);
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load category.");
        setCategoryReadyId(categoryId);
      });

    return () => { current = false; };
  }, [categoryId]);

  useEffect(() => {
    if (!categoryId || categoryReadyId !== categoryId || error) return;
    if (subcategories.length > 0 && !subcategories.some((item) => item._id === selectedSubcategory)) return;

    let current = true;
    getProductsByCategory(categoryId, page, 10, selectedSubcategory || undefined)
      .then((response) => {
        if (!current) return;
        if (!response?.success) throw new Error("Failed to load products.");
        const nextPageCount = response.pagination?.totalPages || 1;
        setProducts(response.data || []);
        setTotalPages(nextPageCount);
        setTotalItems(response.pagination?.totalItems || 0);
        if (page > nextPageCount) setPage(nextPageCount);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load products. Please try again.");
        setProducts([]);
        setTotalItems(0);
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => { current = false; };
  }, [categoryId, categoryReadyId, selectedSubcategory, subcategories, page, error]);

  const selectSubcategory = (subcategoryId: string) => {
    if (subcategoryId === selectedSubcategory) return;
    setIsLoading(true);
    setPage(1);
    setSelectedSubcategory(subcategoryId);
  };

  const changePage = (nextPage: number) => {
    setIsLoading(true);
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

  if (isLoading || categoryReadyId !== categoryId) {
    return (
      <div className="category-products-page">
        <div className="category-products-loading"><div className="category-products-spinner" /><p>Loading products...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="category-products-page">
        <div className="category-products-error">
          <div className="category-products-error-icon" aria-hidden="true">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{error}</p>
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

          <section className="category-products-main" aria-label="Category products">
            <div className="category-products-result">
              <strong>{currentSubcategory?.name || category?.name}</strong>
              <span>{totalItems} {totalItems === 1 ? "product" : "products"} available</span>
            </div>

            {products.length > 0 ? (
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
