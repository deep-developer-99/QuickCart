import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import api from "../services/api";
import {
  applyTheme,
  defaultTheme,
  fetchPublicTheme,
  normalizeTheme,
  type ThemeColors,
} from "./theme";
import { ThemeContext, type ThemeContextValue } from "./ThemeContext";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [colors, setColors] = useState<ThemeColors>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublicTheme()
      .then((loadedTheme) => {
        if (active) setColors(loadedTheme);
      })
      .catch((error) => {
        console.warn("Failed to load public theme; using defaults:", error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyTheme(colors);
  }, [colors]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      isLoading,
      updateTheme: (nextColors) => setColors(normalizeTheme(nextColors)),
      publishTheme: async (updates) => {
        const response = await api.patch("/admin/theme", { colors: updates });
        const nextColors = normalizeTheme(response.data?.data);
        setColors(nextColors);
        return nextColors;
      },
      resetTheme: async () => {
        const response = await api.post("/admin/theme/reset");
        const nextColors = normalizeTheme(response.data?.data);
        setColors(nextColors);
        return nextColors;
      },
    }),
    [colors, isLoading],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
