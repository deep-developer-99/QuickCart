import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  forwardGeocodeController,
  reverseGeocodeController,
} from "../controllers/locationController";

const router = Router();
router.post("/forward", authMiddleware("user"), forwardGeocodeController);
router.get("/reverse", authMiddleware("user"), reverseGeocodeController);
export default router;
