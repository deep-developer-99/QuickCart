import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import productRoutes from "./routes/productRoutes";
import addressRoutes from "./routes/addressRoutes";
import cartRoutes from "./routes/cartRoutes";
import orderRoutes from "./routes/orderRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import bannerRoutes from "./routes/bannerRoutes";
import wishlistRoutes from "./routes/wishlistRoutes";
import offerRoutes from "./routes/offerRoutes";
import locationRoutes from "./routes/locationRoutes";
import vendorRegistrationLocationRoutes from "./routes/vendorRegistrationLocationRoutes";
import themeRoutes from "./routes/themeRoutes";
import promotionalBannerRoutes from "./routes/promotionalBannerRoutes";
import footerSettingsRoutes from "./routes/footerSettingsRoutes";
import { apiErrorHandler, apiRequestLogger } from "./middleware/apiRequestLogging";

const app = express();

app.use(apiRequestLogger);

app.use(
  cors({
    origin: [process.env.CLIENT_URL || "http://localhost:5173"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/location/registration", vendorRegistrationLocationRoutes);
app.use("/api/theme", themeRoutes);
app.use("/api/promotional-banners", promotionalBannerRoutes);
app.use("/api/footer-settings", footerSettingsRoutes);

app.use(apiErrorHandler);

export default app;
