import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import FooterSettings, { defaultFooterSettings } from "../models/FooterSettings";

const getSettings = async () =>
  FooterSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global", ...defaultFooterSettings } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

export const getPublicFooterSettingsController = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getSettings() });
  } catch (error) {
    console.error("Get public footer settings error:", error);
    res.json({ success: true, data: defaultFooterSettings });
  }
};

export const getAdminFooterSettingsController = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, data: await getSettings() });
  } catch (error) {
    console.error("Get admin footer settings error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch footer settings" });
  }
};

export const updateAdminFooterSettingsController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allowed = ["usefulLinks", "socialLinks", "appLinks", "headings", "copyright", "disclaimer"];
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const unsupported = Object.keys(input).filter((key) => !allowed.includes(key));
    if (unsupported.length) {
      res.status(400).json({ success: false, message: `Unsupported footer fields: ${unsupported.join(", ")}` });
      return;
    }
    const settings = await FooterSettings.findOneAndUpdate(
      { key: "global" },
      { $set: input, $setOnInsert: { key: "global", ...defaultFooterSettings } },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ success: true, message: "Footer settings saved", data: settings });
  } catch (error) {
    console.error("Update footer settings error:", error);
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid footer settings" });
  }
};
