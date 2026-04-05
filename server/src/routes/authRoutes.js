import { Router } from "express";
import { postClaimLegacyData } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/claim-legacy-data", requireAuth, postClaimLegacyData);

export default router;
