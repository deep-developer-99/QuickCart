import { useEffect, useState } from "react";
import { getCategories } from "../services/productService";
import type { Category } from "../types/product";

export const useFooterCategories = () => {
  const [state, setState] = useState<{ categories: Category[]; categoryStatus: string }>({
    categories: [],
    categoryStatus: "Loading categories…",
  });

  useEffect(() => {
    let cancelled = false;
    const onError = () => {
      if (!cancelled) setState({ categories: [], categoryStatus: "Unable to load categories." });
    };

    getCategories().then((response) => {
      if (cancelled) return;
      if (!response?.success) {
        onError();
        return;
      }
      const categories = response.data || [];
      setState({ categories, categoryStatus: categories.length ? "" : "No categories available." });
    }).catch(onError);

    return () => { cancelled = true; };
  }, []);

  return state;
};
