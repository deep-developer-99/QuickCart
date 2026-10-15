import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  deleteSavedCardController,
  listSavedCardsController,
  syncSavedCardsController,
} from "../controllers/savedCardController";

const router = Router();
router.use(authMiddleware("user"));
router.get("/", listSavedCardsController);
router.post("/sync", syncSavedCardsController);
router.delete("/:cardId", deleteSavedCardController);

export default router;
