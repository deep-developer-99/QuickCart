import { Router } from "express";

import {
  createAddressController,
  getUserAddressesController,
  getAddressByIdController,
  updateAddressController,
  deleteAddressController,
} from "../controllers/addressController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

// All address endpoints belong to authenticated normal users.
router.use(authMiddleware("user"));

// Keep the collection routes explicit. This avoids ambiguity when the router
// is mounted at /api/addresses in app.ts.
router.get("/", getUserAddressesController);
router.post("/", createAddressController);

router.get("/:id", getAddressByIdController);
router.put("/:id", updateAddressController);
router.delete("/:id", deleteAddressController);

export default router;
