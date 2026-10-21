import { Request, Response } from "express";

import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  createOffer,
  getAdminOffers,
  getPublishedOffer,
  publishOffer,
  updateOffer,
} from "../services/offerService";
import type { OfferRedirectType } from "../models/Offer";

const parseOfferInput = (body: Record<string, unknown>) => ({
  title: String(body.title ?? ""),
  message: String(body.message ?? ""),
  redirectType: String(body.redirectType ?? "") as OfferRedirectType,
  redirectValue: String(body.redirectValue ?? ""),
});

export const getAdminOffersController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const offers = await getAdminOffers(req.query.page, req.query.limit);
    res.status(200).json({ success: true, ...offers });
  } catch (error) {
    console.error("Get admin offers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch offers" });
  }
};

export const createOfferController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const offer = await createOffer(parseOfferInput(req.body));
    res.status(201).json({
      success: true,
      message: "Offer draft created successfully",
      data: offer,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create offer",
    });
  }
};

export const updateOfferController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const offer = await updateOffer(req.params.id as string, parseOfferInput(req.body));
    res.status(200).json({ success: true, message: "Offer updated successfully", data: offer });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update offer",
    });
  }
};

export const publishOfferController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const offer = await publishOffer(req.params.id as string);
    res.status(200).json({ success: true, message: "Offer published successfully", data: offer });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to publish offer",
    });
  }
};

export const getPublishedOfferController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const offer = await getPublishedOffer(req.params.id as string);
    res.status(200).json({ success: true, data: offer });
  } catch {
    res.status(404).json({ success: false, message: "Offer not found" });
  }
};
