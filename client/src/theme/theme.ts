import api from "../services/api";

export const themeColorKeys = [
  "primary",
  "primaryHover",
  "primaryActive",
  "secondary",
  "accent",
  "pageBackground",
  "secondaryBackground",
  "cardBackground",
  "surfaceBackground",
  "modalBackground",
  "headingText",
  "bodyText",
  "mutedText",
  "link",
  "linkHover",
  "onPrimary",
  "primaryButtonBackground",
  "primaryButtonText",
  "secondaryButtonBackground",
  "secondaryButtonText",
  "inputBackground",
  "inputText",
  "inputPlaceholder",
  "inputBorder",
  "inputFocusBorder",
  "border",
  "activeNavigation",
  "selectedTab",
  "badgeBackground",
  "badgeText",
  "disabledBackground",
  "disabledText",
  "focusRing",
  "success",
  "warning",
  "error",
  "info",
] as const;

export type ThemeColorKey = (typeof themeColorKeys)[number];
export type ThemeColors = Record<ThemeColorKey, string>;
const hexColor = /^#[0-9a-fA-F]{6}$/;

export const defaultTheme: ThemeColors = {
  primary: "#4D9F50",
  primaryHover: "#3F8B43",
  primaryActive: "#2F7133",
  secondary: "#21D4B4",
  accent: "#F5A623",
  pageBackground: "#F8FAFC",
  secondaryBackground: "#F6F8F7",
  cardBackground: "#FFFFFF",
  surfaceBackground: "#FFFFFF",
  modalBackground: "#FFFFFF",
  headingText: "#172033",
  bodyText: "#334155",
  mutedText: "#64748B",
  link: "#15803D",
  linkHover: "#166534",
  onPrimary: "#FFFFFF",
  primaryButtonBackground: "#4D9F50",
  primaryButtonText: "#FFFFFF",
  secondaryButtonBackground: "#F0FDF4",
  secondaryButtonText: "#166534",
  inputBackground: "#FFFFFF",
  inputText: "#172033",
  inputPlaceholder: "#94A3B8",
  inputBorder: "#CBD5E1",
  inputFocusBorder: "#4D9F50",
  border: "#E2E8F0",
  activeNavigation: "#4D9F50",
  selectedTab: "#4D9F50",
  badgeBackground: "#DCFCE7",
  badgeText: "#166534",
  disabledBackground: "#F1F5F9",
  disabledText: "#94A3B8",
  focusRing: "#86EFAC",
  success: "#16A34A",
  warning: "#A16207",
  error: "#DC2626",
  info: "#2563EB",
};

const cssVariableNames: Record<ThemeColorKey, string> = {
  primary: "--color-primary",
  primaryHover: "--color-primary-hover",
  primaryActive: "--color-primary-active",
  secondary: "--color-secondary",
  accent: "--color-accent",
  pageBackground: "--color-page-background",
  secondaryBackground: "--color-secondary-background",
  cardBackground: "--color-card-background",
  surfaceBackground: "--color-surface-background",
  modalBackground: "--color-modal-background",
  headingText: "--color-heading-text",
  bodyText: "--color-body-text",
  mutedText: "--color-muted-text",
  link: "--color-link",
  linkHover: "--color-link-hover",
  onPrimary: "--color-on-primary",
  primaryButtonBackground: "--color-primary-button-background",
  primaryButtonText: "--color-primary-button-text",
  secondaryButtonBackground: "--color-secondary-button-background",
  secondaryButtonText: "--color-secondary-button-text",
  inputBackground: "--color-input-background",
  inputText: "--color-input-text",
  inputPlaceholder: "--color-input-placeholder",
  inputBorder: "--color-input-border",
  inputFocusBorder: "--color-input-focus-border",
  border: "--color-border",
  activeNavigation: "--color-active-navigation",
  selectedTab: "--color-selected-tab",
  badgeBackground: "--color-badge-background",
  badgeText: "--color-badge-text",
  disabledBackground: "--color-disabled-background",
  disabledText: "--color-disabled-text",
  focusRing: "--color-focus-ring",
  success: "--color-success",
  warning: "--color-warning",
  error: "--color-error",
  info: "--color-info",
};

export const normalizeTheme = (value: unknown): ThemeColors => {
  const colors =
    value && typeof value === "object" ? (value as Partial<ThemeColors>) : {};

  return themeColorKeys.reduce(
    (result, key) => {
      result[key] =
        typeof colors[key] === "string" && hexColor.test(colors[key])
          ? colors[key]
          : defaultTheme[key];
      return result;
    },
    {} as ThemeColors,
  );
};

export const applyTheme = (colors: ThemeColors) => {
  const root = document.documentElement;
  themeColorKeys.forEach((key) => {
    root.style.setProperty(cssVariableNames[key], colors[key]);
  });
};

export const fetchPublicTheme = async (): Promise<ThemeColors> => {
  const response = await api.get("/theme/public");
  return normalizeTheme(response.data?.data);
};
