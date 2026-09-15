import User from "../models/User";
import Vendor from "../models/Vendor";
import Product from "../models/Product";
import Order from "../models/Order";

// Get all vendors

export const getAllVendors = async () => {
  const vendors = await Vendor.find()
    .select("-password")
    .sort({ createdAt: -1 });

  return vendors;
};

// Approve vendor

export const approveVendor = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  vendor.status = "approved";
  vendor.isApproved = true;

  await vendor.save();

  return vendor;
};

// Reject vendor

export const rejectVendor = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  vendor.status = "rejected";
  vendor.isApproved = false;

  await vendor.save();

  return vendor;
};

// Deactive Vendor
export const deactivateVendor = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  vendor.isActive = false;

  await vendor.save();

  return vendor;
};

// Activate Vendor
export const activateVendor = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  vendor.isActive = true;

  await vendor.save();

  return vendor;
};

// Get All Users
export const getAllUsers = async () => {
  const users = await User.find().select("-__v").sort({ createdAt: -1 });

  return users;
};

// Products
export const getAllProductsAdmin = async () => {
  const product = await Product.find()
    .populate("category", "name image")
    .populate("vendor", "name shopName email")
    .sort({ createdAt: -1 });

  return product;
};

// Orders
export const getAllOrdersAdmin = async () => {
  const orders = await Order.find()
    .populate("user", "name email phone")
    .populate("address")
    .populate({
      path: "items.product",
      select: "name image",
    })
    .populate({
      path: "items.vendor",
      select: "name shopName",
    })
    .sort({ createdAt: -1 });

  return orders;
};

// Dashboard
export const getAdminDashboard = async () => {
  const [totalUsers, totalVendors, totalProducts, totalOrders] =
    await Promise.all([
      User.countDocuments(),

      Vendor.countDocuments(),

      Product.countDocuments(),

      Order.countDocuments(),
    ]);

  const salesResult = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalSales: {
          $sum: "$totalAmount",
        },
      },
    },
  ]);

  const totalSales = salesResult.length > 0 ? salesResult[0].totalSales : 0;

  return {
    totalUsers,
    totalVendors,
    totalProducts,
    totalOrders,
    totalSales,
  };
};
