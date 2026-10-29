import mongoose, { Document, Schema } from "mongoose";

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

export interface ITheme extends Document {
  key: "global";
  colors: ThemeColors;
  updatedBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const hexColor = /^#[0-9a-fA-F]{6}$/;

export const defaultThemeColors: ThemeColors = {
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

const themeSchema = new Schema<ITheme>(
  {
    key: {
      type: String,
      enum: ["global"],
      unique: true,
      default: "global",
      required: true,
    },
    colors: {
      type: Schema.Types.Mixed,
      required: true,
      default: defaultThemeColors,
      validate: {
        validator: (value: Partial<ThemeColors>) =>
          themeColorKeys.every(
            (colorKey) =>
              typeof value[colorKey] === "string" &&
              hexColor.test(value[colorKey]),
          ),
        message: "Theme contains an invalid color value",
      },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

const Theme =
  mongoose.models.Theme || mongoose.model<ITheme>("Theme", themeSchema);

export default Theme;
