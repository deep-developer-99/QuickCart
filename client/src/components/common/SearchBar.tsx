import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./SearchBar.css";

const SearchBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [value, setValue] = useState("");

  useEffect(() => {
    if (location.pathname === "/search") {
      const params = new URLSearchParams(location.search);

      setValue(params.get("q") || "");
    } else {
      setValue("");
    }
  }, [location.pathname, location.search]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const search = value.trim();

    if (!search) {
      return;
    }

    navigate(`/search?q=${encodeURIComponent(search)}`);
  };

  const handleClear = () => {
    setValue("");

    if (location.pathname === "/search") {
      navigate("/");
    }
  };

  return (
    <form className="quickcart-search" onSubmit={handleSubmit} role="search">
      <span className="quickcart-search-icon" aria-hidden="true">
        🔍
      </span>

      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search for milk, bread, fruits & more"
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

      <button type="submit" className="quickcart-search-submit">
        Search
      </button>
    </form>
  );
};

export default SearchBar;
