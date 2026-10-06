import { Router } from "express";

import {
  getWishlistController,
  addToWishlistController,
  removeFromWishlistController,
  clearWishlistController,
  checkWishlistController,
} from "../controllers/wishlistController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware("user"));

router
  .route("/")
  .get(getWishlistController)
  .post(addToWishlistController)
  .delete(clearWishlistController);

router.get("/check/:productId", checkWishlistController);
router.delete("/:productId", removeFromWishlistController);

export default router;
