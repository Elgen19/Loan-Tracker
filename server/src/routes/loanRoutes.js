import { Router } from "express";
import { getLoan, getLoans, postLoan, postPayment, postRecalculateSchedules, putLoan, putPayment, removeLoan, removePayment } from "../controllers/loanController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);
router.get("/", getLoans);
router.post("/recalculate-schedules", postRecalculateSchedules);
router.get("/:loanId", getLoan);
router.post("/", postLoan);
router.put("/:loanId", putLoan);
router.delete("/:loanId", removeLoan);
router.post("/:loanId/payments", postPayment);
router.put("/:loanId/payments/:paymentId", putPayment);
router.delete("/:loanId/payments/:paymentId", removePayment);

export default router;
