import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  getAdminHomepageSections,
  getPublicHomepageSections,
  saveHomepageSections,
} from "../services/homepageSectionService";

export const getPublicHomepageSectionsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getPublicHomepageSections();
    res.status(200).json({ success: true, data });
  } catch (error) {
    const details = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { error };
    console.error("[homepage-sections] Failed to load public sections:", details);
    res.status(500).json({ success: false, message: "Failed to load homepage sections." });
  }
};

export const getAdminHomepageSectionsController = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await getAdminHomepageSections();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get admin homepage sections error:", error);
    res.status(500).json({ success: false, message: "Failed to load homepage section settings." });
  }
};

export const saveAdminHomepageSectionsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await saveHomepageSections(req.body?.sections);
    res.status(200).json({ success: true, message: "Homepage sections saved.", data });
  } catch (error) {
    const candidate = error as { statusCode?: number; message?: string };
    res.status(candidate.statusCode || 500).json({
      success: false,
      message: candidate.message || "Failed to save homepage section settings.",
    });
  }
};
