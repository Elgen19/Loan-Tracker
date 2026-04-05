import { Router } from "express";
import { getContainers, postAssignExistingLoans, postContainer } from "../controllers/containerController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);
router.get("/", getContainers);
router.post("/", postContainer);
router.post("/assign-existing-loans", postAssignExistingLoans);

export default router;
