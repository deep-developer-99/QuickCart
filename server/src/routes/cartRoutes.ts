import { Router } from "express";

import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeFromCartController,
  clearCartController,
} from "../controllers/cartController";

import authMiddleware from "../middleware/authMiddleware";
import authorize from "../middleware/authorize";

const router = Router();

router.use(authMiddleware, authorize("user"));

router
  .route("/")
  .get(getCartController)
  .post(addToCartController)
  .delete(clearCartController);
router
  .route("/:productId")
  .put(updateCartItemController)
  .delete(removeFromCartController);

export default router;
