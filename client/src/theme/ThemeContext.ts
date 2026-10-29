import { createContext, useContext } from "react";
import type { ThemeColors } from "./theme";

export interface ThemeContextValue {
  colors: ThemeColors;
  isLoading: boolean;
  updateTheme: (colors: ThemeColors) => void;
  publishTheme: (colors: Partial<ThemeColors>) => Promise<ThemeColors>;
  resetTheme: () => Promise<ThemeColors>;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
};
