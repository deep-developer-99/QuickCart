import axios from "axios";
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
    const controller = new AbortController();
    const onError = () => {
      if (!cancelled) setState({ categories: [], categoryStatus: "Unable to load categories." });
    };

    getCategories(controller.signal).then((response) => {
      if (cancelled) return;
      if (!response?.success) {
        onError();
        return;
      }
      const categories = response.data || [];
      setState({ categories, categoryStatus: categories.length ? "" : "No categories available." });
    }).catch((error: unknown) => {
      if (cancelled || axios.isCancel(error)) return;
      onError();
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
};
