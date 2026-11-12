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

    const variant = cartItem.variantId ? product.variants?.find((item: any) => item._id.toString() === cartItem.variantId?.toString() && item.isActive) : undefined;
    if (cartItem.variantId && !variant) throw new Error(`Selected variant for ${product.name} is no longer available`);
    const fallbackStock = !variant && product.legacyStock !== undefined ? product.legacyStock : product.stock;
    if ((variant?.stock ?? fallbackStock) < cartItem.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    const discountedPrice = variant?.price ?? product.discountPrice ?? product.legacyPrice ?? product.price;

    const itemTotal = discountedPrice * cartItem.quantity;

    totalAmount += itemTotal;

    items.push({
      product,
      quantity: cartItem.quantity,
      itemTotal,
      discountedPrice,
      variantId: variant?._id,
      variantQuantity: variant?.quantity,
      variantUnit: variant?.unit,
      price: variant?.price ?? product.legacyPrice ?? product.price,
    });
  }

  const subtotal = totalAmount;
  const shippingAmount = subtotal <= 99 ? 40 : 0;
  const finalTotal = subtotal + shippingAmount;

  return {
    items,
    subtotal,
    shippingAmount,
    totalAmount: finalTotal,
  };
};
