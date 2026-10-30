import mongoose from "mongoose";
import Banner from "../models/Banner";

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);

    const activeBanners = await Banner.collection
      .find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .toArray();

    if (activeBanners.length > 1) {
      const bannersToDeactivate = activeBanners.slice(1).map((banner) => banner._id);

      await Banner.collection.updateMany(
        { _id: { $in: bannersToDeactivate } },
        { $set: { isActive: false } },
      );
    }

    await Banner.collection.createIndex(
      { isActive: 1 },
      {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: "one_active_main_banner",
      },
    );

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDB;
