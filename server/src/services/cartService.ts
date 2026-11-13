import Cart from "../models/Cart";
import Product from "../models/Product";
import { Types } from "mongoose";

// Get Cart
export const getCart = async (userId: string) => {
  let cart = await Cart.findOne({
    user: userId,
  }).populate({
    path: "items.product",
    populate: [
      {
        path: "category",
        select: "name image",
      },
      {
        path: "vendor",
        select: "shopName",
      },
    ],
  });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [],
    });
  }
  cart = await Cart.findById(cart._id).populate({
    path: "items.product",
    populate: [
      {
        path: "category",
        select: "name image",
      },
      {
        path: "vendor",
        select: "shopName",
      },
    ],
  });
  return cart;
};

// Add Product To Cart
export const addToCart = async (
  userId: string,
  productId: string,
  quantity: number,
  variantId?: string,
) => {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a positive whole number");
  }
  if (!Types.ObjectId.isValid(productId)) {
    throw new Error("Product not found");
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const selectedVariant = product.variants?.find((item: any) => variantId ? item._id.toString() === variantId && item.isActive : item.isActive && item.stock > 0);
  if (!selectedVariant) throw new Error("Select an active product variant");
  const selectedVariantId = selectedVariant._id;
  const availableStock = selectedVariant.stock;
  if (availableStock < quantity) throw new Error("Insufficient product stock");

  let cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [
        {
          product: productId,
          ...(selectedVariantId ? { variantId: selectedVariantId } : {}),
          quantity,
        },
      ],
    });

    return cart;
  }

  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId && (item.variantId?.toString() ?? "") === (selectedVariantId?.toString() ?? ""),
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (newQuantity > availableStock) {
      throw new Error("Requested quantity exceeds available stock");
    }

    existingItem.quantity = newQuantity;
  } else {
    cart.items.push({
      product: new Types.ObjectId(productId),
      ...(selectedVariantId ? { variantId: selectedVariantId } : {}),
      quantity,
    });
  }

  await cart.save();

  return cart;
};

// Update Cart Item Quantity
export const updateCartItem = async (
  userId: string,
  productId: string,
  quantity: number,
  variantId?: string,
) => {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a positive whole number");
  }
  if (!Types.ObjectId.isValid(productId)) {
    throw new Error("Product not found");
  }
  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (!variantId) throw new Error("Variant ID is required to update this cart item");
  const variant = product.variants?.find((item: any) => item._id.toString() === variantId && item.isActive);
  if (!variant) throw new Error("Product variant is unavailable");
  if (quantity > variant.stock) {
    throw new Error("Requested quantity exceeds available stock");
  }

  const cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    throw new Error("Cart not found");
  }

  const item = cart.items.find(
    (cartItem) => cartItem.product.toString() === productId && cartItem.variantId?.toString() === variantId,
  );

  if (!item) {
    throw new Error("Product is not in cart");
  }

  item.quantity = quantity;

  await cart.save();

  return cart;
};

// Remove Product From Cart
export const removeFromCart = async (userId: string, productId: string, variantId?: string) => {
  const cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    throw new Error("Cart not found");
  }

  const initialLength = cart.items.length;

  cart.items = cart.items.filter((items) => items.product.toString() !== productId || (variantId ? items.variantId?.toString() !== variantId : false));

  if (cart.items.length === initialLength) {
    throw new Error("Product is not in cart");
  }

  await cart.save();

  return cart;
};

// Clear Cart
export const clearCart = async (userId: string): Promise<void> => {
  const cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    return;
  }

  cart.items = [];

  await cart.save();
};
