import mongoose, { Types } from "mongoose";

import Order from "../models/Order";
import Cart from "../models/Cart";
import Address from "../models/Address";
import Product from "../models/Product";

interface CreateOrderData {
  addressId: string;
  paymentMethod: "COD" | "RAZORPAY_FAKE";
  paymentId?: string;
}

export const createOrder = async (userId: string, data: CreateOrderData) => {
  const { addressId, paymentMethod, paymentId } = data;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Get user's cart
    const cart = await Cart.findOne({
      user: userId,
    }).session(session);

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // 2. Check address belongs to this user
    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    }).session(session);

    if (!address) {
      throw new Error("Address not found");
    }

    let totalAmount = 0;

    const orderItems = [];

    // 3. Validate products and calculate total
    for (const cartItem of cart.items) {
      const product = await Product.findOne({
        _id: cartItem.product,
        isActive: true,
      }).session(session);

      if (!product) {
        throw new Error("One or more products are no longer available");
      }

      if (product.stock < cartItem.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const discountedPrice = product.discountPrice ?? product.price;

      totalAmount += discountedPrice * cartItem.quantity;

      orderItems.push({
        product: product._id,
        vendor: product.vendor,
        name: product.name,
        image: product.image,
        price: product.price,
        discountedPrice,
        quantity: cartItem.quantity,
      });
    }

    // 4. Reduce stock safely
    for (const cartItem of cart.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: cartItem.product,
          isActive: true,
          stock: {
            $gte: cartItem.quantity,
          },
        },
        {
          $inc: {
            stock: -cartItem.quantity,
          },
        },
        {
          new: true,
          session,
        },
      );

      if (!updatedProduct) {
        throw new Error(
          "Stock changed while placing the order. Please try again.",
        );
      }
    }

    // 5. Create order
    const [order] = await Order.create(
      [
        {
          user: new Types.ObjectId(userId),
          items: orderItems,
          address: new Types.ObjectId(addressId),
          paymentMethod,
          paymentId,
          totalAmount,
          status: "Placed",
        },
      ],
      {
        session,
      },
    );

    // 6. Clear cart
    cart.items = [];

    await cart.save({
      session,
    });

    // 7. Commit transaction
    await session.commitTransaction();

    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// Get My Orders
export const getMyOrders = async (userId: string) => {
  const orders = await Order.find({
    user: userId,
  })
    .populate("address")
    .populate({
      path: "items.product",
      select: "name image price",
    })
    .populate({
      path: "items.vendor",
      select: "shopName",
    })
    .sort({ createdAt: -1 });

  if (!orders) {
    throw new Error("Order not found");
  }

  return orders;
};

// Get Single Order
export const getOrderById = async (orderId: string, userId: string) => {
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
  })
    .populate("address")
    .populate({
      path: "items.product",
      select: "name image price discountPrice",
    })
    .populate({
      path: "items.vendor",
      select: "shopName",
    });

  if (!order) {
    throw new Error("Order not found");
  }

  return order;
};

// Get Vendor Orders
export const getVendorOrders = async (vendorId: string) => {
  const orders = await Order.find({
    "items.vendor": vendorId,
  })
    .populate("user", "name email phone")
    .populate("address")
    .populate({
      path: "items.product",
      select: "name image price",
    })
    .populate({
      path: "items.vendor",
      select: "shopName",
    })
    .sort({ createdAt: -1 });

  return orders;
};

// Changing Order Status By Vendor
type OrderStatus = "Placed" | "Accepted" | "Out for Delivery" | "Delivered";

export const updateVendorOrderStatus = async (
  orderId: string,
  vendorId: string,
  newStatus: OrderStatus,
) => {
  const order = await Order.findOne({
    _id: orderId,
    "items.vendor": vendorId,
  });

  if (!order) {
    throw new Error("Order not found or access denied");
  }

  const statusFlow: Record<OrderStatus, OrderStatus | null> = {
    Placed: "Accepted",
    Accepted: "Out for Delivery",
    "Out for Delivery": "Delivered",
    Delivered: null,
  };

  const currentStatus = order.status;

  if (currentStatus === newStatus) {
    throw new Error("Order is already in this status");
  }

  if (statusFlow[currentStatus] !== newStatus) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}`,
    );
  }

  order.status = newStatus;

  await order.save();

  return order;
};

// Vendor Dashboard
export const getVendorDashboard = async (vendorId: string) => {
  const vendorObjectId = new Types.ObjectId(vendorId);

  const [productStats, orderStats] = await Promise.all([
    Product.countDocuments({
      vendor: vendorObjectId,
    }),

    Order.aggregate([
      {
        $unwind: "$items",
      },
      {
        $match: {
          "items.vendor": vendorObjectId,
        },
      },
      {
        $group: {
          _id: null,

          orderIds: {
            $addToSet: "$_id",
          },

          totalItemsSold: {
            $sum: "$items.quantity",
          },

          totalSales: {
            $sum: {
              $multiply: ["$items.price", "$items.quantity"],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,

          totalOrders: {
            $size: "$orderIds",
          },

          totalItemsSold: 1,
          totalSales: 1,
        },
      },
    ]),
  ]);

  return {
    totalProducts: productStats,
    totalOrders: orderStats[0]?.totalOrders ?? 0,
    totalItemsSold: orderStats[0]?.totalItemsSold ?? 0,
    totalSales: orderStats[0]?.totalSales ?? 0,
  };
};
