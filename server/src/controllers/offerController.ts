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
import { deleteOffer, getManagedOffers, resendOfferNotification } from "../services/offerService";

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
    const offer = await createOffer(parseOfferInput(req.body), req.user?.id, req.user?.role === "vendor" ? "vendor" : "admin");
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
    const offer = await updateOffer(req.params.id as string, { title: String(req.body.title ?? ""), message: String(req.body.message ?? "") }, req.user?.id, req.user?.role === "vendor" ? "vendor" : "admin");
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
    const offer = await publishOffer(req.params.id as string, req.user?.id, req.user?.role === "vendor" ? "vendor" : "admin");
    res.status(200).json({ success: true, message: "Offer published successfully", data: offer });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to publish offer",
    });
  }
};

export const getManagedOffersController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    res.status(200).json({ success: true, ...(await getManagedOffers(req.user.id, req.user.role, req.query.page, req.query.limit)) });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch offers" }); }
};

export const deleteOfferController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    const offer = await deleteOffer(req.params.id as string, req.user.id, req.user.role);
    if (!offer) { res.status(404).json({ success: false, message: "Offer not found" }); return; }
    res.status(200).json({ success: true, message: "Offer deleted; historical notifications are retained", data: { id: offer._id, deletedAt: offer.deletedAt } });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to delete offer" }); }
};

export const resendOfferNotificationController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "vendor")) { res.status(403).json({ success: false, message: "Access denied" }); return; }
    const result = await resendOfferNotification(req.params.id as string, req.user.id, req.user.role, String(req.get("Idempotency-Key") ?? ""));
    res.status(200).json({ success: true, message: result.duplicate ? "Duplicate resend request" : "Resend completed", data: result });
  } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to resend offer notification" }); }
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
