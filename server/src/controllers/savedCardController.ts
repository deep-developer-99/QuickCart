import { Response } from "express";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import SavedCard from "../models/SavedCard";
import {
  deleteCashfreeSavedCardInstrument,
  getCashfreeCustomerId,
  listCashfreeSavedCardInstruments,
} from "../services/cashfreePaymentService";

const sendError = (res: Response, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  res.status(502).json({ success: false, message: fallback, details: message });
};

/** GET /api/payment-methods/cards — sync provider instruments and return masked card metadata. */
export const listSavedCardsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }
    const userId = req.user.id;
    const customerId = getCashfreeCustomerId(userId);
    const instruments = await listCashfreeSavedCardInstruments(customerId);
    const activeIds = instruments.map((item) => item.instrumentId);

    for (const instrument of instruments) {
      await SavedCard.findOneAndUpdate(
        {
          user: new Types.ObjectId(userId),
          instrumentId: instrument.instrumentId,
        },
        {
          $set: {
            provider: "cashfree",
            customerId,
            cardBrand: instrument.cardBrand,
            last4: instrument.last4,
            issuingBank: instrument.issuingBank,
            instrumentType: "card",
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    await SavedCard.updateMany(
      {
        user: new Types.ObjectId(userId),
        isActive: true,
        ...(activeIds.length ? { instrumentId: { $nin: activeIds } } : {}),
      },
      { $set: { isActive: false } },
    );

    const cards = await SavedCard.find({ user: userId, isActive: true })
      .select("_id cardBrand last4 issuingBank instrumentType createdAt")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: cards });
  } catch (error) {
    console.error(
      "List saved cards error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    sendError(
      res,
      error,
      "Could not load saved cards. Confirm Cashfree Token Vault is enabled for this merchant.",
    );
  }
};

/** POST /api/payment-methods/cards/sync — sync cards saved via Cashfree checkout; no card credentials accepted. */
export const syncSavedCardsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }
    const customerId = getCashfreeCustomerId(req.user.id);
    const instruments = await listCashfreeSavedCardInstruments(customerId);
    for (const instrument of instruments) {
      await SavedCard.findOneAndUpdate(
        {
          user: new Types.ObjectId(req.user.id),
          instrumentId: instrument.instrumentId,
        },
        {
          $set: {
            provider: "cashfree",
            customerId,
            cardBrand: instrument.cardBrand,
            last4: instrument.last4,
            issuingBank: instrument.issuingBank,
            instrumentType: "card",
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    res.json({
      success: true,
      message: "Saved cards synced from Cashfree",
      data: instruments.map((item) => ({
        cardBrand: item.cardBrand,
        last4: item.last4,
        issuingBank: item.issuingBank,
      })),
    });
  } catch (error) {
    console.error(
      "Sync saved cards error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    sendError(
      res,
      error,
      "Could not sync saved cards. Confirm Cashfree Token Vault is enabled for this merchant.",
    );
  }
};

/** DELETE /api/payment-methods/cards/:cardId — delete only a card owned by the authenticated user. */
export const deleteSavedCardController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const cardId = req.params.cardId;

    if (typeof cardId !== "string" || !Types.ObjectId.isValid(cardId)) {
      res.status(400).json({
        success: false,
        message: "Invalid saved card ID",
      });
      return;
    }

    const card = await SavedCard.findOne({
      _id: cardId,
      user: req.user.id,
      isActive: true,
    });
    if (!card) {
      res.status(404).json({ success: false, message: "Saved card not found" });
      return;
    }
    await deleteCashfreeSavedCardInstrument(card.customerId, card.instrumentId);
    card.isActive = false;
    await card.save();
    res.json({ success: true, message: "Saved card removed successfully" });
  } catch (error) {
    console.error(
      "Delete saved card error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    sendError(res, error, "Could not remove saved card from Cashfree.");
  }
};
