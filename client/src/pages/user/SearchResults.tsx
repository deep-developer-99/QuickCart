import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getProducts } from "../../services/productService";
import type { Product } from "../../types/product";
import ProductCard from "../../components/user/ProductCard";
import { addRecentSearch, useRecentSearches } from "../../hooks/useRecentSearches";

import "./SearchResults.css";

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = (searchParams.get("q") || "").trim();
  const { searches, clearRecentSearches } = useRecentSearches();
  const [products, setProducts] = useState<Product[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const inputSelector = window.matchMedia("(max-width: 768px)").matches
      ? ".navbar-search-mobile input"
      : ".navbar-search-desktop input";
    const input = document.querySelector<HTMLInputElement>(inputSelector);
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  useEffect(() => {
    if (!query) {
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await getProducts(query, undefined, 1, 24);
        if (!isCurrent) return;
        setResolvedQuery(query);
        setError("");
        setProducts(response?.success ? response.data || [] : []);
        if (!response?.success) setError("Search is temporarily unavailable. Please try again.");
      } catch (requestError) {
        if (!isCurrent) return;
        console.error("Failed to search products:", requestError);
        setResolvedQuery(query);
        setProducts([]);
        setError("We couldn't load search results. Check your connection and try again.");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }, 300);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [query, retryKey]);

  const suggestions = useMemo(() => {
    const normalized = query.toLocaleLowerCase();
    const seen = new Set<string>();
    return products.filter((product) => {
      const name = product.name.trim();
      const key = name.toLocaleLowerCase();
      if (!name || !key.includes(normalized) || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }, [products, query]);
  const showingLoading = Boolean(query) && (isLoading || resolvedQuery !== query);

  const selectRecentSearch = (term: string) => {
    setSearchParams({ q: term });
  };

  const openProduct = (product: Product) => {
    addRecentSearch(product.name);
    navigate(`/products/${product._id}`);
  };

  return (
    <div className="search-results-page">
      <div className="search-results-container">
        {!query ? (
          <section className="recent-searches" aria-labelledby="recent-searches-title">
            <div className="recent-searches-heading">
              <h1 id="recent-searches-title">Recent searches</h1>
              {searches.length > 0 && (
                <button type="button" onClick={clearRecentSearches}>Clear</button>
              )}
            </div>
            {searches.length ? (
              <div className="recent-searches-list">
                {searches.slice(0, 10).map((term) => (
                  <button type="button" className="recent-search-chip" key={term} onClick={() => selectRecentSearch(term)}>
                    <span aria-hidden="true">◷</span>{term}
                  </button>
                ))}
              </div>
            ) : (
              <p className="recent-searches-empty">Your recent searches will show up here.</p>
            )}
          </section>
        ) : (
          <section className="search-live-results" aria-live="polite">
            {showingLoading && (
              <div className="search-results-grid" aria-label="Loading search results">
                {Array.from({ length: 8 }, (_, index) => <div className="search-product-skeleton" key={index} />)}
              </div>
            )}

            {!showingLoading && error && (
              <div className="search-state search-state-error" role="alert">
                <div className="search-state-icon" aria-hidden="true">!</div>
                <h2>Unable to search right now</h2>
                <p>{error}</p>
                <button type="button" onClick={() => { setResolvedQuery(""); setRetryKey((current) => current + 1); }}>Try again</button>
              </div>
            )}

            {!showingLoading && !error && products.length > 0 && (
              <>
                {suggestions.length > 0 && (
                  <div className="search-suggestions" role="listbox" aria-label="Product suggestions">
                    {suggestions.map((product) => (
                      <button type="button" role="option" className="search-suggestion" key={product._id} onClick={() => openProduct(product)}>
                        <img src={product.image} alt="" />
                        <span>{product.name}</span>
                        <span className="search-suggestion-arrow" aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="search-results-count">{products.length} {products.length === 1 ? "product" : "products"} found</div>
                <div className="search-results-grid">
                  {products.map((product) => <ProductCard key={product._id} product={product} variant="compact" />)}
                </div>
              </>
            )}

            {!showingLoading && !error && products.length === 0 && (
              <div className="search-state search-state-empty">
                <div className="search-state-icon" aria-hidden="true">⌕</div>
                <h2>No products found.</h2>
                <p>Try another search or check the spelling.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
