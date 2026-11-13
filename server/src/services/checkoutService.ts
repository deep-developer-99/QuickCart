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
    if (!variant) throw new Error(`Select a valid variant for ${product.name} before checkout`);
    if (variant.stock < cartItem.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    const discountedPrice = variant.discountPrice != null && variant.discountPrice < variant.price ? variant.discountPrice : variant.price;

    const itemTotal = discountedPrice * cartItem.quantity;

    totalAmount += itemTotal;

    items.push({
      product,
      quantity: cartItem.quantity,
      itemTotal,
      discountedPrice,
      variantId: variant._id,
      variantQuantity: variant.quantity,
      variantUnit: variant.unit,
      price: variant.price,
      discountPrice: variant.discountPrice,
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
