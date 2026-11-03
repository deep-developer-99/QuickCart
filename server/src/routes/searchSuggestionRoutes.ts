import { Router } from "express";
import { getPublicSearchSuggestionsController } from "../controllers/searchSuggestionController";

const router = Router();
router.get("/", getPublicSearchSuggestionsController);
export default router;
