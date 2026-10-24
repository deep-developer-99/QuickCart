import { Types } from "mongoose";

import Offer, {
  OfferRedirectType,
  OfferStatus,
} from "../models/Offer";
import Category from "../models/Category";
import Product from "../models/Product";
import { createPaginationMeta, getPagination } from "../utils/pagination";
import { notifyEligibleCustomersAboutOffer } from "./notificationService";

export interface OfferInput {
  title: string;
  message: string;
  redirectType: OfferRedirectType;
  redirectValue: string;
}

const normalize = (value: unknown) => String(value ?? "").trim();

const validateOfferInput = (data: OfferInput) => {
  const title = normalize(data.title);
  const message = normalize(data.message);
  const redirectValue = normalize(data.redirectValue);

  if (!title || title.length > 120) {
    throw new Error("Offer title is required and must be at most 120 characters");
  }
  if (!message || message.length > 240) {
    throw new Error("Offer message is required and must be at most 240 characters");
  }
  if (!["category", "product"].includes(data.redirectType)) {
    throw new Error("Invalid offer redirect type");
  }
  if (!redirectValue || redirectValue.length > 120) {
    throw new Error("Offer redirect value is required and must be at most 120 characters");
  }
};

const buildOfferData = (data: OfferInput) => ({
  title: normalize(data.title),
  message: normalize(data.message),
  redirectType: data.redirectType,
  redirectValue: normalize(data.redirectValue),
});

export const getAdminOffers = async (page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const [data, totalItems] = await Promise.all([
    Offer.find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Offer.countDocuments({ deletedAt: null }),
  ]);

  return {
    data,
    pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems),
  };
};

export const getPublishedOffer = async (offerId: string) => {
  if (!Types.ObjectId.isValid(offerId)) throw new Error("Offer not found");

  const offer = await Offer.findOne({ _id: offerId, status: "published", deletedAt: null }).lean();
  if (!offer) throw new Error("Offer not found");
  const destinationExists = Types.ObjectId.isValid(offer.redirectValue) && (offer.redirectType === "category"
    ? await Category.exists({ _id: offer.redirectValue, isActive: true })
    : await Product.exists({ _id: offer.redirectValue, isActive: true }));
  if (!destinationExists) throw new Error("Offer not found");
  return offer;
};

export const createOffer = async (data: OfferInput, ownerId?: string, ownerRole: "admin" | "vendor" = "admin") => {
  validateOfferInput(data);
  return Offer.create({ ...buildOfferData(data), status: "draft" as OfferStatus, ownerId, ownerRole, audience: ownerRole === "vendor" ? "vendor_customers" : "all" });
};

export const updateOffer = async (offerId: string, data: Pick<OfferInput, "title" | "message">, actorId?: string, actorRole: "admin" | "vendor" = "admin") => {
  const title = normalize(data.title), message = normalize(data.message);
  if (!title || title.length > 120) throw new Error("Offer title is required and must be at most 120 characters");
  if (!message || message.length > 240) throw new Error("Offer message is required and must be at most 240 characters");
  if (!Types.ObjectId.isValid(offerId)) throw new Error("Offer not found");
  const filter: Record<string, unknown> = { _id: offerId, deletedAt: null };
  if (actorRole === "vendor") Object.assign(filter, { ownerId: actorId, ownerRole: "vendor" });
  const offer = await Offer.findOne(filter);
  if (!offer) throw new Error("Offer not found");

  offer.title = title;
  offer.message = message;
  await offer.save();
  return offer;
};

export const publishOffer = async (offerId: string, actorId?: string, actorRole: "admin" | "vendor" = "admin") => {
  if (!Types.ObjectId.isValid(offerId)) throw new Error("Offer not found");
  const ownership = actorRole === "vendor" ? { ownerId: actorId, ownerRole: "vendor", deletedAt: null } : { deletedAt: null };
  const draft = await Offer.findOne({ _id: offerId, status: "draft", ...ownership });
  if (!draft) {
    const existingOffer = await Offer.findOne({ _id: offerId, ...ownership });
    if (!existingOffer) throw new Error("Offer not found");
    throw new Error("Offer has already been published");
  }

  if (!Types.ObjectId.isValid(draft.redirectValue)) {
    throw new Error("Offer destination is invalid");
  }

  const destinationExists =
    draft.redirectType === "category"
      ? await Category.exists({ _id: draft.redirectValue, isActive: true })
      : await Product.exists({ _id: draft.redirectValue, isActive: true });

  if (!destinationExists) {
    throw new Error("Offer destination is not available");
  }

  const now = new Date();
  const offer = await Offer.findOneAndUpdate(
    { _id: offerId, status: "draft" },
    { $set: { status: "published", publishedAt: now } },
    { new: true },
  );

  if (!offer) {
    throw new Error("Offer has already been published");
  }

  const stats = await notifyEligibleCustomersAboutOffer({
    offerId: offer._id.toString(),
    title: offer.title,
    message: offer.message,
    redirectType: offer.redirectType,
    redirectValue: offer.redirectValue,
  }, { senderId: actorId ?? draft.ownerId?.toString(), senderRole: actorRole, audience: draft.audience }).catch((error) => {
    console.error("Offer notification dispatch failed:", error);
    return { attempted: 0, accepted: 0, failed: 1, skipped: 0 };
  });

  const completedAt = new Date();
  await Offer.updateOne({ _id: offer._id }, { $set: { lastDispatch: { ...stats, completedAt } }, $push: { dispatchHistory: { kind: "publish", outcome: "complete", ...stats, completedAt } } });

  return (await Offer.findById(offer._id)) ?? offer;
};

export const getManagedOffers = async (actorId: string, actorRole: "admin" | "vendor", page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const filter = actorRole === "admin" ? { deletedAt: null } : { deletedAt: null, ownerId: actorId, ownerRole: "vendor" };
  const [data, totalItems] = await Promise.all([
    Offer.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Offer.countDocuments(filter),
  ]);
  return { data, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

export const deleteOffer = async (offerId: string, actorId: string, actorRole: "admin" | "vendor") => {
  if (!Types.ObjectId.isValid(offerId)) throw new Error("Offer not found");
  const filter: Record<string, unknown> = { _id: offerId, deletedAt: null };
  if (actorRole === "vendor") Object.assign(filter, { ownerId: actorId, ownerRole: "vendor" });
  return Offer.findOneAndUpdate(filter, { $set: { deletedAt: new Date() } }, { new: true });
};

export const resendOfferNotification = async (offerId: string, actorId: string, actorRole: "admin" | "vendor", idempotencyKey: string) => {
  if (!Types.ObjectId.isValid(offerId)) throw new Error("Offer not found");
  const filter: Record<string, unknown> = { _id: offerId, status: "published", deletedAt: null };
  if (actorRole === "vendor") Object.assign(filter, { ownerId: actorId, ownerRole: "vendor" });
  const offer = await Offer.findOne(filter);
  if (!offer) throw new Error("Offer not found, published, or available to resend");
  if (!Types.ObjectId.isValid(offer.redirectValue)) throw new Error("Offer destination is invalid");
  const available = offer.redirectType === "category"
    ? await Category.exists({ _id: offer.redirectValue, isActive: true })
    : await Product.exists({ _id: offer.redirectValue, isActive: true });
  if (!available) throw new Error("Offer destination is not available");
  const key = idempotencyKey.trim().slice(0, 100);
  if (!key) throw new Error("Idempotency-Key header is required");
  if (offer.resendKeys?.includes(key)) {
    const previous = offer.dispatchHistory?.find((entry: { kind: string; idempotencyKey?: string }) => entry.kind === "resend" && entry.idempotencyKey === key);
    const result = previous ?? offer.lastDispatch ?? { stored: 0, attempted: 0, accepted: 0, failed: 0, skipped: 0 };
    return { duplicate: true, stored: result.stored, attempted: result.attempted, accepted: result.accepted, failed: result.failed, skipped: result.skipped, completedAt: result.completedAt };
  }
  const claim = await Offer.findOneAndUpdate({ ...filter, resendKeys: { $ne: key } }, { $addToSet: { resendKeys: key }, $set: { resendKey: key } }, { new: true });
  if (!claim) {
    const result = offer.lastDispatch ?? { stored: 0, attempted: 0, accepted: 0, failed: 0, skipped: 0 };
    return { duplicate: true, stored: result.stored, attempted: result.attempted, accepted: result.accepted, failed: result.failed, skipped: result.skipped, completedAt: result.completedAt };
  }
  let stats: { stored: number; attempted: number; accepted: number; failed: number; skipped: number };
  let outcome: "complete" | "failed" = "complete";
  try {
    stats = await notifyEligibleCustomersAboutOffer({ offerId: offer._id.toString(), title: offer.title, message: offer.message, redirectType: offer.redirectType, redirectValue: offer.redirectValue }, { senderId: actorId, senderRole: actorRole, audience: offer.audience, idempotencyKey: `resend:${key}` });
  } catch (error) {
    console.error("Offer resend dispatch failed:", error);
    stats = { stored: 0, attempted: 0, accepted: 0, failed: 1, skipped: 0 };
    outcome = "failed";
  }
  const completedAt = new Date();
  await Offer.updateOne({ _id: offer._id }, { $set: { lastDispatch: { ...stats, completedAt } }, $push: { dispatchHistory: { kind: "resend", idempotencyKey: key, outcome, ...stats, completedAt } } });
  return { duplicate: false, ...stats, completedAt };
};
