import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { addRecentSearch } from "../../hooks/useRecentSearches";
import { useSearchSuggestions } from "../../hooks/useSearchSuggestions";
import RotatingSearchPlaceholder from "./RotatingSearchPlaceholder";
import "./SearchBar.css";

const SearchBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSearchPage = location.pathname === "/search";
  const value = isSearchPage
    ? new URLSearchParams(location.search).get("q") || ""
    : "";
  const { config, index } = useSearchSuggestions();
  const placeholder = "Search for atta, milk and more";

  const openSearch = () => {
    if (!isSearchPage) {
      const query = value.trim();
      navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    }
  };

  const handleChange = (nextValue: string) => {
    const query = nextValue.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search", {
      replace: isSearchPage,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    addRecentSearch(query);
    navigate(`/search?q=${encodeURIComponent(query)}`, {
      replace: isSearchPage,
    });
  };

  const handleClear = () => {
    if (isSearchPage) navigate("/search", { replace: true });
  };

  return (
    <form
      className="quickcart-search"
      onSubmit={handleSubmit}
      role="search"
      onClick={openSearch}
    >
      <svg
        className="quickcart-search-icon"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="10.8"
          cy="10.8"
          r="6.8"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="m16 16 4.2 4.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {!value && (
        <RotatingSearchPlaceholder
          suggestions={config?.suggestions || []}
          index={index}
          enabled={Boolean(config?.isEnabled)}
          fallback={placeholder}
        />
      )}
      <input
        type="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={openSearch}
        placeholder={value ? "" : " "}
        aria-label="Search products"
      />
      {value && (
        <button
          type="button"
          className="quickcart-search-clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </form>
  );
};

export default SearchBar;
