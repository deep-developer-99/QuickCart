import { Router } from "express";

import {
  createAddressController,
  getUserAddressesController,
  getAddressByIdController,
  updateAddressController,
  deleteAddressController,
} from "../controllers/addressController";

import authMiddleware from "../middleware/authMiddleware";
import authorize from "../middleware/authorize";

const router = Router();

router.use(authMiddleware, authorize("user"));

router.route("/").post(createAddressController).get(getUserAddressesController);
router
  .route("/:id")
  .get(getAddressByIdController)
  .put(updateAddressController)
  .delete(deleteAddressController);

export default router;
