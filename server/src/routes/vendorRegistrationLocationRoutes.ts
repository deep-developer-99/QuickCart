import { Router } from "express";
import {
  reverseGeocodeController,
  searchLocationsController,
} from "../controllers/locationController";

// Vendor registration is unauthenticated until the account is created. These
// read-only endpoints reuse the same controllers, provider queue, cache,
// deduplication, and error handling as the authenticated location routes.
const router = Router();
router.get("/reverse", reverseGeocodeController);
router.post("/search", searchLocationsController);

export default router;
