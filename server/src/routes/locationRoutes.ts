import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { reverseGeocodeController } from "../controllers/locationController";

const router = Router();
router.get("/reverse", authMiddleware("user"), reverseGeocodeController);
export default router;
