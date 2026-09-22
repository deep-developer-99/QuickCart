import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getProducts } from "../../services/productService";

import type { Product } from "../../types/product";

import ProductCard from "../../components/user/ProductCard";

import "./SearchResults.css";

const SearchResults = () => {
  const [searchParams] = useSearchParams();

  const query = (searchParams.get("q") || "").trim();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    const searchProducts = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await getProducts(query);

        if (response?.success) {
          setProducts(response.data || []);
        } else {
          setProducts([]);
        }
      } catch (error) {
        console.error("Failed to search products:", error);

        setError("Failed to search products. Please try again.");

        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchProducts();
  }, [query]);

  if (!query) {
    return (
      <div className="search-results-page">
        <div className="search-results-empty">
          <div className="search-results-empty-icon">🔍</div>

          <h1>Search Products</h1>

          <p>Search for milk, bread, fruits, snacks and more.</p>

          <Link to="/">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-page">
      <div className="search-results-container">
        <div className="search-results-header">
          <div>
            <span className="search-results-eyebrow">SEARCH</span>

            <h1>Search Results</h1>

            <p>
              Showing results for <strong>"{query}"</strong>
            </p>
          </div>

          <Link to="/" className="search-results-back">
            ← Home
          </Link>
        </div>

        {isLoading && (
          <div className="search-results-loading">
            <div className="search-results-spinner" />
            <p>Searching products...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="search-results-error">
            <div>⚠️</div>

            <h2>Unable to search</h2>

            <p>{error}</p>

            <Link to="/">Go back home</Link>
          </div>
        )}

        {!isLoading && !error && products.length > 0 && (
          <>
            <div className="search-results-count">
              {products.length} {products.length === 1 ? "product" : "products"}{" "}
              found
            </div>

            <div className="search-results-grid">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          </>
        )}

        {!isLoading && !error && products.length === 0 && (
          <div className="search-results-empty">
            <div className="search-results-empty-icon">🛒</div>

            <h2>No Products Found</h2>

            <p>We couldn't find any product matching "{query}".</p>

            <Link to="/">Continue Shopping</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
