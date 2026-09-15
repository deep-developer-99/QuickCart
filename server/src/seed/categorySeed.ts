import dotenv from "dotenv";
import connectDB from "../config/db";
import Category from "../models/Category";

dotenv.config();

const categories = [
  "Grocery",
  "Fruits & Vegetables",
  "Dairy",
  "Snacks",
  "Beverages",
  "Household",
];

const seedCategories = async (): Promise<void> => {
  try {
    await connectDB();

    await Category.deleteMany();

    await Category.insertMany(
      categories.map((name) => ({
        name,
        isActive: true,
      })),
    );

    console.log("Categories seeded successfully");

    process.exit(0);
  } catch (error) {
    console.error("Category seeding failed:", error);

    process.exit(1);
  }
};

seedCategories();
