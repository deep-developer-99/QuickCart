import { useEffect, useState } from "react";

import { getProducts, getCategories } from "../../services/productService";

import type { Product, Category } from "../../types/product";

import ProductCard from "../../components/user/ProductCard";

import "./Products.css";

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();

        if (response?.success && Array.isArray(response.data)) {
          setCategories(response.data);
        } else if (Array.isArray(response?.data)) {
          setCategories(response.data);
        } else if (Array.isArray(response)) {
          setCategories(response);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };

    fetchCategories();
  }, []);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await getProducts(
          search.trim() || undefined,
          selectedCategory || undefined,
        );

        if (response?.success && Array.isArray(response.data)) {
          setProducts(response.data);
        } else if (Array.isArray(response?.data)) {
          setProducts(response.data);
        } else if (Array.isArray(response)) {
          setProducts(response);
        } else {
          setProducts([]);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);

        setError("Failed to load products. Please try again.");

        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [search, selectedCategory]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const handleCategoryChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setSelectedCategory(event.target.value);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("");
  };

  return (
    <div className="products-page">
      {/* Header */}
      <section className="products-header">
        <div>
          <h1>All Products</h1>

          <p>Fresh products delivered quickly to your door.</p>
        </div>
      </section>

      {/* Filters */}
      <section className="products-filters">
        {/* Search */}
        <div className="products-search">
          <label htmlFor="product-search">Search Products</label>

          <div className="search-input-wrapper">
            <input
              id="product-search"
              type="text"
              placeholder="Search for products..."
              value={search}
              onChange={handleSearchChange}
            />

            <span className="search-icon">🔍</span>
          </div>
        </div>

        {/* Category */}
        <div className="products-category">
          <label htmlFor="category-filter">Category</label>

          <select
            id="category-filter"
            value={selectedCategory}
            onChange={handleCategoryChange}
          >
            <option value="">All Categories</option>

            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {(search || selectedCategory) && (
          <button
            type="button"
            className="clear-filters-button"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        )}
      </section>

      {/* Product count */}
      {!isLoading && !error && (
        <div className="products-result-info">
          <p>
            {products.length} {products.length === 1 ? "product" : "products"}{" "}
            found
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="products-loading">
          <div className="products-spinner"></div>
          <p>Loading products...</p>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="products-error">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => {
              setSearch((prev) => prev);
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Products */}
      {!isLoading && !error && (
        <section className="products-grid-section">
          {products.length > 0 ? (
            <div className="products-grid">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <div className="products-empty">
              <div className="products-empty-icon">🛒</div>

              <h2>No Products Found</h2>

              <p>We couldn't find any products matching your search.</p>

              {(search || selectedCategory) && (
                <button type="button" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Products;
