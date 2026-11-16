import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getCategoryCatalog } from "../../services/productService";
import type { CategoryCatalogItem } from "../../types/product";
import "./CategoriesPage.css";

const pageTitle = "Categories | QuickCart";
const pageDescription = "Explore all QuickCart categories and subcategories.";

const CategoriesPage = () => {
  const [categories, setCategories] = useState<CategoryCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const previousTitle = document.title;
    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const createdDescription = !description;
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    const previousDescription = description.content;
    document.title = pageTitle;
    description.content = pageDescription;

    return () => {
      document.title = previousTitle;
      if (createdDescription) description?.remove();
      else if (description) description.content = previousDescription;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getCategoryCatalog(controller.signal)
      .then((response) => {
        if (!current) return;
        if (!response?.success || !Array.isArray(response.data)) {
          throw new Error("Unable to load categories.");
        }

        const seenCategories = new Set<string>();
        const seenSubcategories = new Set<string>();
        const safeCategories = response.data.filter((category) => {
          const name = category?.name?.trim();
          if (
            !category?._id ||
            !name ||
            category.isActive === false ||
            seenCategories.has(category._id)
          ) {
            return false;
          }
          seenCategories.add(category._id);
          return true;
        }).map((category) => {
          const subcategories = Array.isArray(category.subcategories)
            ? category.subcategories.filter((subcategory) => {
                const name = subcategory?.name?.trim();
                if (
                  !subcategory?._id ||
                  !name ||
                  subcategory.isActive === false ||
                  seenSubcategories.has(subcategory._id)
                ) {
                  return false;
                }
                seenSubcategories.add(subcategory._id);
                return true;
              })
            : [];
          return { ...category, subcategories };
        });

        setCategories(safeCategories);
      })
      .catch((requestError: unknown) => {
        if (!current || controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load categories. Please try again.",
        );
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryKey]);

  const retryLoading = () => {
    setCategories([]);
    setError("");
    setIsLoading(true);
    setRetryKey((key) => key + 1);
  };

  return (
    <div className="all-categories-page">
      <div className="all-categories-content">
        <h1>Categories</h1>

        {isLoading ? (
          <div
            className="all-categories-loading"
            role="status"
            aria-label="Loading categories"
            aria-busy="true"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <section className="all-categories-skeleton" key={index}>
                <span className="all-categories-skeleton-heading" />
                <div className="all-categories-skeleton-links">
                  {Array.from({ length: 4 }, (__, linkIndex) => (
                    <span key={linkIndex} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : error ? (
          <div className="all-categories-message" role="alert">
            <p>{error}</p>
            <button type="button" onClick={retryLoading}>
              Retry
            </button>
          </div>
        ) : categories.length === 0 ? (
          <p className="all-categories-empty" role="status">
            No categories are available right now.
          </p>
        ) : (
          <div className="all-categories-list">
            {categories.map((category) => (
              <section
                className={`all-categories-section${category.subcategories.length ? " all-categories-section--has-subcategories" : ""}`}
                key={category._id}
                aria-labelledby={`category-${category._id}`}
              >
                <h2 id={`category-${category._id}`}>{category.name}</h2>
                {category.subcategories.length > 0 ? (
                  <ul className="all-categories-subcategories">
                    {category.subcategories.map((subcategory) => (
                      <li key={subcategory._id}>
                        <Link
                          to={`/category/${encodeURIComponent(category._id)}?subCategory=${encodeURIComponent(subcategory._id)}`}
                        >
                          {subcategory.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;
