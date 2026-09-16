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

router.use(authMiddleware("user"));

router.route("/").post(createAddressController).get(getUserAddressesController);
router
  .route("/:id")
  .get(getAddressByIdController)
  .put(updateAddressController)
  .delete(deleteAddressController);

export default router;
