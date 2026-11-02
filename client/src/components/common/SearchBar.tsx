import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { addRecentSearch } from "../../hooks/useRecentSearches";
import "./SearchBar.css";

const SearchBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSearchPage = location.pathname === "/search";
  const value = isSearchPage ? new URLSearchParams(location.search).get("q") || "" : "";

  const openSearch = () => {
    if (!isSearchPage) {
      const query = value.trim();
      navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    }
  };

  const handleChange = (nextValue: string) => {
    const query = nextValue.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search", { replace: isSearchPage });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    addRecentSearch(query);
    navigate(`/search?q=${encodeURIComponent(query)}`, { replace: isSearchPage });
  };

  const handleClear = () => {
    if (isSearchPage) navigate("/search", { replace: true });
  };

  return (
    <form className="quickcart-search" onSubmit={handleSubmit} role="search" onClick={openSearch}>
      <span className="quickcart-search-icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={openSearch}
        placeholder="Search for milk, bread, fruits & more"
        aria-label="Search products"
      />
      {value && (
        <button type="button" className="quickcart-search-clear" onClick={handleClear} aria-label="Clear search">
          ×
        </button>
      )}
    </form>
  );
};

export default SearchBar;
