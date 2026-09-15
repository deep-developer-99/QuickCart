import Cart from "../models/Cart";
import Product from "../models/Product";

export const calculateCheckout = async (userId: string) => {
  const cart = await Cart.findOne({
    user: userId,
  });

  if (!cart || cart.items.length === 0) {
    throw new Error("Cart is empty");
  }

  let totalAmount = 0;

  const items = [];

  for (const cartItem of cart.items) {
    const product = await Product.findOne({
      _id: cartItem.product,
      isActive: true,
    });

    if (!product) {
      throw new Error("One or more products are no longer available");
    }

    if (product.stock < cartItem.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    const itemTotal = product.price * cartItem.quantity;

    totalAmount += itemTotal;

    items.push({
      product,
      quantity: cartItem.quantity,
      itemTotal,
    });
  }

  return {
    items,
    totalAmount,
  };
};
