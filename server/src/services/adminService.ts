import User from "../models/User";
import Vendor from "../models/Vendor";
import Product from "../models/Product";
import Order from "../models/Order";
import { createPaginationMeta, getPagination } from "../utils/pagination";

// Get all vendors
export const getAllVendors = async (page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const [vendors, totalItems] = await Promise.all([Vendor.find()
    .select("-password")
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit), Vendor.countDocuments()]);

  return { data: vendors, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
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

// Deactivate Vendor
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
export const getAllUsers = async (page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const [users, totalItems] = await Promise.all([User.find().select("-__v").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit), User.countDocuments()]);

  return { data: users, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

// Products
export const getAllProductsAdmin = async (page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const [product, totalItems] = await Promise.all([Product.find()
    .populate("category", "name image")
    .populate("vendor", "name shopName email")
    .sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit), Product.countDocuments()]);

  return { data: product, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

// Orders
export const getAllOrdersAdmin = async (page?: unknown, limit?: unknown) => {
  const pagination = getPagination(page, limit);
  const [orders, totalItems] = await Promise.all([Order.find()
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
    .sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit), Order.countDocuments()]);

  return { data: orders, pagination: createPaginationMeta(pagination.page, pagination.limit, totalItems) };
};

const getIndiaDateKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getStartOfIndiaDay = (daysAgo: number): Date => {
  const now = new Date();
  const dateKey = getIndiaDateKey(now);
  const [year, month, day] = dateKey.split("-").map(Number);

  const start = new Date(Date.UTC(year, month - 1, day) - 330 * 60 * 1000);

  start.setUTCDate(start.getUTCDate() - daysAgo);

  return start;
};

// Dashboard
export const getAdminDashboard = async (days = 30) => {
  const validDays = [7, 30, 90].includes(days) ? days : 30;
  const startDate = getStartOfIndiaDay(validDays - 1);

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

  const salesTrendResult = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Kolkata",
          },
        },
        sales: {
          $sum: "$totalAmount",
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const usersTrendResult = await User.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Kolkata",
          },
        },
        users: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const salesMap = new Map<string, number>();

  salesTrendResult.forEach((item) => {
    salesMap.set(item._id, item.sales);
  });

  const usersMap = new Map<string, number>();

  usersTrendResult.forEach((item) => {
    usersMap.set(item._id, item.users);
  });

  const salesTrend: Array<{ date: string; sales: number }> = [];
  const usersTrend: Array<{ date: string; users: number }> = [];

  for (let index = 0; index < validDays; index += 1) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + index);

    const dateKey = getIndiaDateKey(date);

    salesTrend.push({
      date: dateKey,
      sales: salesMap.get(dateKey) ?? 0,
    });

    usersTrend.push({
      date: dateKey,
      users: usersMap.get(dateKey) ?? 0,
    });
  }

  return {
    totalUsers,
    totalVendors,
    totalProducts,
    totalOrders,
    totalSales,
    salesTrend,
    usersTrend,
    chartDays: validDays,
  };
};
