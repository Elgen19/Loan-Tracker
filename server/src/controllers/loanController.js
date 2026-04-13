import { addPayment, createLoan, deleteLoan, deletePayment, getLoanById, listLoans, recalculateLoanSchedules, updateLoan, updatePayment } from "../data/loanRepository.js";
import { getContainerById, listContainers } from "../data/containerRepository.js";
import { logAuditEvent } from "../utils/audit.js";
import { filterContainersForUser, isAllowedContainerForUser } from "../utils/accessPolicy.js";
import { summarizeLoans } from "../utils/loanStatus.js";

function validateLoanPayload(body) {
  const requiredFields = ["loanName", "containerId", "principal", "loanType"];
  const missingField = requiredFields.find((field) => !body[field] && body[field] !== 0);

  if (missingField) {
    return `Missing required field: ${missingField}`;
  }

  if (!["fixed", "flexible"].includes(body.loanType)) {
    return "Loan type must be fixed or flexible.";
  }

  if (body.loanType === "fixed") {
    const fixedRequiredFields = ["monthlyPayment", "remainingBalance"];
    const missingFixedRequiredField = fixedRequiredFields.find((field) => !body[field] && body[field] !== 0);

    if (missingFixedRequiredField) {
      return `Missing required field: ${missingFixedRequiredField}`;
    }

    const fixedFields = ["termCount", "paymentFrequency", "firstRepaymentDate", "nextDueDate"];
    const missingFixedField = fixedFields.find((field) => !body[field]);

    if (missingFixedField) {
      return `Missing required field: ${missingFixedField}`;
    }

    if (Number(body.termCount) <= 0) {
      return "Term count must be greater than zero.";
    }
  }

  return null;
}

function validatePaymentPayload(body) {
  const requiredFields = ["amount", "paymentDate"];
  const missingField = requiredFields.find((field) => !body[field] && body[field] !== 0);

  if (missingField) {
    return `Missing required field: ${missingField}`;
  }

  if (Array.isArray(body.proofImages) && body.proofImages.length > 3) {
    return "You can only upload up to 3 proof images.";
  }

  return null;
}

export async function getLoans(req, res, next) {
  try {
    const [loans, containers] = await Promise.all([listLoans(req.workspaceId), listContainers(req.workspaceId)]);
    const allowedContainerIds = new Set(filterContainersForUser(req.user.email, containers).map((container) => container.id));
    const visibleLoans = loans.filter((loan) => allowedContainerIds.has(loan.containerId));

    res.json({
      loans: visibleLoans,
      summary: summarizeLoans(visibleLoans),
    });
  } catch (error) {
    next(error);
  }
}

export async function getLoan(req, res, next) {
  try {
    const loan = await getLoanById(req.workspaceId, req.params.loanId);

    if (!loan) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const container = await getContainerById(req.workspaceId, loan.containerId);

    if (!isAllowedContainerForUser(req.user.email, container)) {
      return res.status(404).json({ message: "Loan not found." });
    }

    return res.json(loan);
  } catch (error) {
    return next(error);
  }
}

export async function postLoan(req, res, next) {
  const validationError = validateLoanPayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const container = await getContainerById(req.workspaceId, req.body.containerId);

    if (!container || !isAllowedContainerForUser(req.user.email, container)) {
      return res.status(404).json({ message: "Container not found." });
    }

    const loan = await createLoan(req.body, req.workspaceId, req.user.uid);
    await logAuditEvent(req, {
      action: "loan.create",
      targetType: "loan",
      targetId: loan.id,
      summary: `Created loan ${loan.loanName}`,
      metadata: {
        loanName: loan.loanName,
        containerId: loan.containerId,
      },
    });
    return res.status(201).json(loan);
  } catch (error) {
    return next(error);
  }
}

export async function postPayment(req, res, next) {
  const validationError = validatePaymentPayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const existingLoan = await getLoanById(req.workspaceId, req.params.loanId);

    if (!existingLoan) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const existingContainer = await getContainerById(req.workspaceId, existingLoan.containerId);

    if (!isAllowedContainerForUser(req.user.email, existingContainer)) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const loan = await addPayment(req.workspaceId, req.params.loanId, req.body);

    if (!loan) {
      return res.status(404).json({ message: "Loan not found." });
    }

    await logAuditEvent(req, {
      action: "payment.add",
      targetType: "loan",
      targetId: loan.id,
      summary: `Added payment to ${loan.loanName}`,
      metadata: {
        loanName: loan.loanName,
        amount: Number(req.body.amount || 0),
        paymentDate: req.body.paymentDate || "",
      },
    });

    return res.status(201).json(loan);
  } catch (error) {
    return next(error);
  }
}

export async function putPayment(req, res, next) {
  const validationError = validatePaymentPayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const existingLoan = await getLoanById(req.workspaceId, req.params.loanId);

    if (!existingLoan) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const existingContainer = await getContainerById(req.workspaceId, existingLoan.containerId);

    if (!isAllowedContainerForUser(req.user.email, existingContainer)) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const result = await updatePayment(req.workspaceId, req.params.loanId, req.params.paymentId, req.body);

    if (!result) {
      return res.status(404).json({ message: "Payment not found." });
    }

    await logAuditEvent(req, {
      action: "payment.update",
      targetType: "loan",
      targetId: result.loan.id,
      summary: `Updated payment on ${result.loan.loanName}`,
      metadata: {
        loanName: result.loan.loanName,
        paymentId: req.params.paymentId,
        amount: Number(req.body.amount || 0),
        paymentDate: req.body.paymentDate || "",
      },
    });

    return res.json(result.loan);
  } catch (error) {
    return next(error);
  }
}

export async function removePayment(req, res, next) {
  try {
    const existingLoan = await getLoanById(req.workspaceId, req.params.loanId);

    if (!existingLoan) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const existingContainer = await getContainerById(req.workspaceId, existingLoan.containerId);

    if (!isAllowedContainerForUser(req.user.email, existingContainer)) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const result = await deletePayment(req.workspaceId, req.params.loanId, req.params.paymentId);

    if (!result) {
      return res.status(404).json({ message: "Payment not found." });
    }

    await logAuditEvent(req, {
      action: "payment.delete",
      targetType: "loan",
      targetId: result.loan.id,
      summary: `Deleted payment from ${result.loan.loanName}`,
      metadata: {
        loanName: result.loan.loanName,
        paymentId: req.params.paymentId,
        amount: Number(result.payment?.amount || 0),
        paymentDate: result.payment?.paymentDate || "",
      },
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function putLoan(req, res, next) {
  const validationError = validateLoanPayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const container = await getContainerById(req.workspaceId, req.body.containerId);

    if (!container || !isAllowedContainerForUser(req.user.email, container)) {
      return res.status(404).json({ message: "Container not found." });
    }

    const loan = await updateLoan(req.workspaceId, req.params.loanId, { ...req.body, createdBy: req.user.uid });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found." });
    }

    await logAuditEvent(req, {
      action: "loan.update",
      targetType: "loan",
      targetId: loan.id,
      summary: `Updated loan ${loan.loanName}`,
      metadata: {
        loanName: loan.loanName,
        containerId: loan.containerId,
      },
    });

    return res.json(loan);
  } catch (error) {
    return next(error);
  }
}

export async function removeLoan(req, res, next) {
  try {
    const existingLoan = await getLoanById(req.workspaceId, req.params.loanId);

    if (!existingLoan) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const existingContainer = await getContainerById(req.workspaceId, existingLoan.containerId);

    if (!isAllowedContainerForUser(req.user.email, existingContainer)) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const deleted = await deleteLoan(req.workspaceId, req.params.loanId);

    if (!deleted) {
      return res.status(404).json({ message: "Loan not found." });
    }

    if (existingLoan) {
      await logAuditEvent(req, {
        action: "loan.delete",
        targetType: "loan",
        targetId: existingLoan.id,
        summary: `Deleted loan ${existingLoan.loanName}`,
        metadata: {
          loanName: existingLoan.loanName,
        },
      });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function postRecalculateSchedules(req, res, next) {
  try {
    if (String(req.user.email || "").trim().toLowerCase() === "mariefcabasa@gmail.com") {
      return res.status(403).json({ message: "This account can only access the Faith container." });
    }

    const updatedLoans = await recalculateLoanSchedules(req.workspaceId);
    await logAuditEvent(req, {
      action: "loan.recalculate-schedules",
      targetType: "workspace",
      targetId: req.workspaceId,
      summary: `Recalculated ${updatedLoans.length} loan schedule(s)`,
      metadata: {
        updatedCount: updatedLoans.length,
      },
    });
    return res.json({
      updatedCount: updatedLoans.length,
      updatedLoans,
    });
  } catch (error) {
    return next(error);
  }
}
