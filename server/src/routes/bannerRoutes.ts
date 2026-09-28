import { Router } from "express";

import { getActiveBannersController } from "../controllers/bannerController";

const router = Router();

router.get("/", getActiveBannersController);

export default router;
