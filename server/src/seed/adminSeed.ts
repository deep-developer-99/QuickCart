import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import connectDB from "../config/db";
import Admin from "../models/Admin";

dotenv.config();

const seedAdmin = async (): Promise<void> => {
  try {
    await connectDB();

    const email = "admin@quickcart.com";
    const password = "Admin@123";

    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await Admin.create({
      name: "QuickCart Admin",
      email,
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    console.log("Admin created successfully");
    console.log(`Email: ${email}`);

    process.exit(0);
  } catch (error) {
    console.error("Admin seeding failed:", error);

    process.exit(1);
  }
};

seedAdmin();
