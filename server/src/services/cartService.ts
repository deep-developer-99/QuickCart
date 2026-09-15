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
) => {
  if (quantity < 1) {
    throw new Error("Quantity must be at least 1");
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (product.stock < quantity) {
    throw new Error("Insufficient product stock");
  }

  let cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [
        {
          product: productId,
          quantity,
        },
      ],
    });

    return cart;
  }

  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId,
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (newQuantity > product.stock) {
      throw new Error("Requested quantity exceeds available stock");
    }

    existingItem.quantity = newQuantity;
  } else {
    cart.items.push({
      product: new Types.ObjectId(productId),
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
) => {
  if (quantity < 1) {
    throw new Error("Quantity must be at least 1");
  }
  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (quantity > product.stock) {
    throw new Error("Requested quantity exceeds available stock");
  }

  const cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    throw new Error("Cart not found");
  }

  const item = cart.items.find(
    (cartItem) => cartItem.product.toString() === productId,
  );

  if (!item) {
    throw new Error("Product is not in cart");
  }

  item.quantity = quantity;

  await cart.save();

  return cart;
};

// Remove Product From Cart
export const removeFromCart = async (userId: string, productId: string) => {
  const cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    throw new Error("Cart not found");
  }

  const initialLength = cart.items.length;

  cart.items = cart.items.filter(
    (items) => items.product.toString() !== productId,
  );

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
