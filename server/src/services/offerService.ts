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
    Offer.find()
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Offer.countDocuments(),
  ]);

  return {
    data,
    pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems),
  };
};

export const getPublishedOffer = async (offerId: string) => {
  if (!Types.ObjectId.isValid(offerId)) throw new Error("Offer not found");

  const offer = await Offer.findOne({ _id: offerId, status: "published" }).lean();
  if (!offer) throw new Error("Offer not found");
  return offer;
};

export const createOffer = async (data: OfferInput) => {
  validateOfferInput(data);
  return Offer.create({ ...buildOfferData(data), status: "draft" as OfferStatus });
};

export const updateOffer = async (offerId: string, data: OfferInput) => {
  validateOfferInput(data);

  const offer = await Offer.findById(offerId);
  if (!offer) throw new Error("Offer not found");

  Object.assign(offer, buildOfferData(data));
  await offer.save();
  return offer;
};

export const publishOffer = async (offerId: string) => {
  const draft = await Offer.findOne({ _id: offerId, status: "draft" });
  if (!draft) {
    const existingOffer = await Offer.findById(offerId);
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

  void notifyEligibleCustomersAboutOffer({
    offerId: offer._id.toString(),
    title: offer.title,
    message: offer.message,
    redirectType: offer.redirectType,
    redirectValue: offer.redirectValue,
  }).catch((error) => {
    console.error("Offer notification dispatch failed:", error);
  });

  return offer;
};
