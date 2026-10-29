import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import Theme, {
  defaultThemeColors,
  themeColorKeys,
  type ThemeColors,
} from "../models/Theme";

const hexColor = /^#[0-9a-fA-F]{6}$/;

const getPublishedColors = (colors?: Partial<ThemeColors>): ThemeColors =>
  themeColorKeys.reduce(
    (result, key) => {
      const value = colors?.[key];
      result[key] =
        typeof value === "string" && hexColor.test(value)
          ? value
          : defaultThemeColors[key];
      return result;
    },
    {} as ThemeColors,
  );

const getThemeDocument = async () =>
  Theme.findOneAndUpdate(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        colors: defaultThemeColors,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

export const getPublicThemeController = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const theme = await getThemeDocument();
    res.status(200).json({ success: true, data: getPublishedColors(theme?.colors) });
  } catch (error) {
    console.error("Get public theme error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch theme",
      data: defaultThemeColors,
    });
  }
};

export const getAdminThemeController = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const theme = await getThemeDocument();
    res.status(200).json({ success: true, data: getPublishedColors(theme?.colors) });
  } catch (error) {
    console.error("Get admin theme error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch theme" });
  }
};

export const updateAdminThemeController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const input = req.body?.colors;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      res.status(400).json({ success: false, message: "Theme colors are required" });
      return;
    }

    const unsupportedKeys = Object.keys(input).filter(
      (key) => !themeColorKeys.includes(key as (typeof themeColorKeys)[number]),
    );
    if (unsupportedKeys.length > 0) {
      res.status(400).json({
        success: false,
        message: `Unsupported theme fields: ${unsupportedKeys.join(", ")}`,
      });
      return;
    }

    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== "string" || !hexColor.test(value)) {
        res.status(400).json({
          success: false,
          message: `${key} must be a valid six-digit HEX color`,
        });
        return;
      }
    }

    const existing = await getThemeDocument();
    const colors = {
      ...getPublishedColors(existing?.colors),
      ...(input as Partial<ThemeColors>),
    };
    const theme = await Theme.findOneAndUpdate(
      { key: "global" },
      { $set: { colors, updatedBy: req.user?.id } },
      { new: true, upsert: true, runValidators: true },
    );

    res.status(200).json({ success: true, data: getPublishedColors(theme?.colors) });
  } catch (error) {
    console.error("Update admin theme error:", error);
    res.status(500).json({ success: false, message: "Failed to update theme" });
  }
};

export const resetAdminThemeController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const theme = await Theme.findOneAndUpdate(
      { key: "global" },
      { $set: { colors: defaultThemeColors, updatedBy: req.user?.id } },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(200).json({ success: true, data: getPublishedColors(theme?.colors) });
  } catch (error) {
    console.error("Reset admin theme error:", error);
    res.status(500).json({ success: false, message: "Failed to reset theme" });
  }
};
