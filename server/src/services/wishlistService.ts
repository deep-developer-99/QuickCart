import { Types } from "mongoose";

import Product from "../models/Product";
import Wishlist from "../models/Wishlist";

/**
 * Common populate configuration used whenever we return a wishlist.
 * Inactive products are excluded from the returned wishlist.
 */
const wishlistPopulate = {
  path: "products",
  match: {
    isActive: true,
  },
  select:
    "name description image price discountPrice stock category vendor isActive createdAt updatedAt",
  populate: [
    {
      path: "category",
      select: "name image isActive",
    },
    {
      path: "vendor",
      select: "shopName",
    },
  ],
};

const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

/**
 * Get the logged-in user's wishlist.
 * Creates an empty wishlist document for a new user.
 */
export const getWishlist = async (userId: string) => {
  let wishlist = await Wishlist.findOne({
    user: userId,
  }).populate(wishlistPopulate);

  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: userId,
      products: [],
    });

    await wishlist.populate(wishlistPopulate);
  }

  return wishlist;
};

/**
 * Add a product to the logged-in user's wishlist.
 *
 * $addToSet prevents duplicate product IDs.
 */

export const addToWishlist = async (userId: string, productId: string) => {
  if (!isValidObjectId(productId)) {
    throw new Error("Invalid product ID");
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new Error("Product not found or inactive");
  }

  await Wishlist.findOneAndUpdate(
    {
      user: userId,
    },
    {
      $addToSet: {
        products: product._id,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return getWishlist(userId);
};

// Remove one product from the logged-in user's wishlist.

export const removeFromWishlist = async (userId: string, productId: string) => {
  if (!isValidObjectId(productId)) {
    throw new Error("Invalid product ID");
  }

  const wishlist = await Wishlist.findOne({
    user: userId,
  });

  if (!wishlist) {
    throw new Error("Wishlist not found");
  }

  const productExists = wishlist.products.some(
    (id) => id.toString() === productId,
  );

  if (!productExists) {
    throw new Error("Product is not in wishlist");
  }

  await Wishlist.updateOne(
    {
      _id: wishlist._id,
    },
    {
      $pull: {
        products: new Types.ObjectId(productId),
      },
    },
  );

  return getWishlist(userId);
};

// Remove every product from the logged-in user's wishlist.

export const clearWishlist = async (userId: string): Promise<void> => {
  await Wishlist.updateOne(
    {
      user: userId,
    },
    {
      $set: {
        products: [],
      },
    },
  );
};

// Check whether a product is in the logged-in user's wishlist.

export const isProductInWishlist = async (
  userId: string,
  productId: string,
): Promise<boolean> => {
  if (!isValidObjectId(productId)) {
    return false;
  }

  const wishlistExists = await Wishlist.exists({
    user: userId,
    products: new Types.ObjectId(productId),
  });

  return Boolean(wishlistExists);
};
