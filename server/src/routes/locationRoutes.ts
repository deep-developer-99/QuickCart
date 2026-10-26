import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  forwardGeocodeController,
  reverseGeocodeController,
  searchLocationsController,
} from "../controllers/locationController";

const router = Router();
router.post("/forward", authMiddleware("user", "vendor"), forwardGeocodeController);
router.get("/reverse", authMiddleware("user", "vendor"), reverseGeocodeController);
router.post("/search", authMiddleware("vendor"), searchLocationsController);
export default router;
