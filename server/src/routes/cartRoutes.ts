import { Router } from "express";

import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeFromCartController,
  clearCartController,
} from "../controllers/cartController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware("user"));

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
