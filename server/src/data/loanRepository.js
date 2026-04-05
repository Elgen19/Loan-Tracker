import { randomUUID } from "node:crypto";
import { getFirestore } from "../config/firebase.js";
import { advanceDueDate, getLoanStatus } from "../utils/loanStatus.js";

const COLLECTION_NAME = "loans";

function roundToTwo(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeLoanInput(input, workspaceId, createdBy, existingPayments = [], existingCreatedAt = null) {
  const principal = Number(input.principal);
  const loanType = input.loanType;
  const remainingBalance = loanType === "fixed" ? Number(input.remainingBalance) : Number(input.remainingBalance || principal);
  const monthlyPayment = loanType === "fixed" ? Number(input.monthlyPayment) : 0;
  const termCount = Number(input.termCount || 0);
  const now = new Date().toISOString();
  const totalPayable = roundToTwo(loanType === "fixed" ? monthlyPayment * termCount : Number(input.totalPayable || remainingBalance));
  const termLabel = loanType === "fixed" ? `${termCount} ${input.paymentFrequency}` : "Flexible agreement";
  const interestCost = roundToTwo(Math.max(totalPayable - principal, 0));

  return {
    loanName: input.loanName,
    workspaceId,
    createdBy,
    containerId: input.containerId,
    principal,
    termCount: loanType === "fixed" ? termCount : 0,
    paymentFrequency: loanType === "fixed" ? input.paymentFrequency : "",
    termLabel,
    monthlyPayment,
    totalPayable,
    interestCost,
    firstRepaymentDate: loanType === "fixed" ? input.firstRepaymentDate : "",
    nextDueDate: loanType === "fixed" ? input.nextDueDate : "",
    remainingBalance,
    loanType,
    notes: input.notes || "",
    payments: existingPayments,
    createdAt: existingCreatedAt || now,
    updatedAt: now,
    status: getLoanStatus(loanType === "fixed" ? input.nextDueDate : "", remainingBalance),
  };
}

function serializeLoan(doc) {
  const data = doc.data();
  const remainingBalance = Number(data.remainingBalance || 0);
  const totalPayable = Number(data.totalPayable || 0);
  const principal = Number(data.principal || 0);

  return {
    id: doc.id,
    ...data,
    principal,
    termCount: Number(data.termCount || 0),
    totalPayable,
    remainingBalance,
    monthlyPayment: Number(data.monthlyPayment || 0),
    interestCost: Number(data.interestCost || Math.max(totalPayable - principal, 0)),
    payments: Array.isArray(data.payments)
      ? data.payments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount || 0),
        }))
      : [],
    status: getLoanStatus(data.loanType === "fixed" ? data.nextDueDate : "", remainingBalance),
  };
}

function getLoanCollection() {
  return getFirestore().collection(COLLECTION_NAME);
}

export async function listLoans(userId) {
  const snapshot = await getLoanCollection().get();

  return snapshot.docs
    .map(serializeLoan)
    .filter((loan) => loan.workspaceId === userId)
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
}

export async function getLoanById(userId, loanId) {
  const doc = await getLoanCollection().doc(loanId).get();

  if (!doc.exists) {
    return null;
  }

  const loan = serializeLoan(doc);
  return loan.workspaceId === userId ? loan : null;
}

export async function createLoan(input, workspaceId, createdBy) {
  const payload = normalizeLoanInput(input, workspaceId, createdBy, []);
  const docRef = await getLoanCollection().add(payload);
  const createdDoc = await docRef.get();
  return serializeLoan(createdDoc);
}

export async function updateLoan(userId, loanId, input) {
  const docRef = getLoanCollection().doc(loanId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  const currentLoan = serializeLoan(doc);

  if (currentLoan.workspaceId !== userId) {
    return null;
  }

  const updatedLoan = normalizeLoanInput(input, userId, currentLoan.createdBy || input.createdBy || "", currentLoan.payments, currentLoan.createdAt);

  await docRef.update(updatedLoan);

  const updatedDoc = await docRef.get();
  return serializeLoan(updatedDoc);
}

export async function addPayment(userId, loanId, input) {
  const docRef = getLoanCollection().doc(loanId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  const existingLoan = serializeLoan(doc);

  if (existingLoan.workspaceId !== userId) {
    return null;
  }

  const paymentAmount = Number(input.amount);
  const updatedBalance = Math.max(existingLoan.remainingBalance - paymentAmount, 0);

  const nextPayment = {
    id: randomUUID(),
    amount: paymentAmount,
    paymentDate: input.paymentDate,
    note: input.note || "",
    createdAt: new Date().toISOString(),
  };

  const payments = [nextPayment, ...existingLoan.payments];
  const nextTermCount =
    existingLoan.loanType === "fixed" ? Math.max(Number(existingLoan.termCount || 0) - 1, 0) : Number(existingLoan.termCount || 0);
  const nextDueDate =
    existingLoan.loanType === "fixed" && updatedBalance > 0 ? advanceDueDate(existingLoan.nextDueDate, existingLoan.paymentFrequency) : "";
  const updatedLoan = {
    ...existingLoan,
    payments,
    remainingBalance: updatedBalance,
    termCount: nextTermCount,
    termLabel: existingLoan.loanType === "fixed" ? `${nextTermCount} ${existingLoan.paymentFrequency}` : existingLoan.termLabel,
    nextDueDate,
    updatedAt: new Date().toISOString(),
  };

  updatedLoan.status = getLoanStatus(updatedLoan.loanType === "fixed" ? updatedLoan.nextDueDate : "", updatedLoan.remainingBalance);

  await docRef.update({
    payments: updatedLoan.payments,
    remainingBalance: updatedLoan.remainingBalance,
    termCount: updatedLoan.termCount,
    termLabel: updatedLoan.termLabel,
    nextDueDate: updatedLoan.nextDueDate,
    updatedAt: updatedLoan.updatedAt,
    status: updatedLoan.status,
  });

  return updatedLoan;
}

export async function deleteLoan(userId, loanId) {
  const docRef = getLoanCollection().doc(loanId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return false;
  }

  const existingLoan = serializeLoan(doc);

  if (existingLoan.workspaceId !== userId) {
    return false;
  }

  await docRef.delete();
  return true;
}

export async function recalculateLoanSchedules(userId) {
  const snapshot = await getLoanCollection().where("workspaceId", "==", userId).get();
  const results = [];

  for (const doc of snapshot.docs) {
    const loan = serializeLoan(doc);

    if (loan.loanType !== "fixed" || !loan.firstRepaymentDate) {
      continue;
    }

    const sortedPayments = [...loan.payments].sort((left, right) => {
      return new Date(left.paymentDate).getTime() - new Date(right.paymentDate).getTime();
    });

    let expectedNextDueDate = loan.firstRepaymentDate;

    for (const payment of sortedPayments) {
      if (!payment.paymentDate) {
        continue;
      }

      expectedNextDueDate = advanceDueDate(expectedNextDueDate, loan.paymentFrequency);
    }

    if (Number(loan.remainingBalance) <= 0) {
      expectedNextDueDate = "";
    }

    const expectedStatus = getLoanStatus(expectedNextDueDate, loan.remainingBalance);

    const hasChanges =
      loan.nextDueDate !== expectedNextDueDate ||
      loan.status !== expectedStatus;

    if (!hasChanges) {
      continue;
    }

    const updatedAt = new Date().toISOString();

    await doc.ref.update({
      nextDueDate: expectedNextDueDate,
      status: expectedStatus,
      updatedAt,
    });

    results.push({
      id: loan.id,
      loanName: loan.loanName,
      nextDueDate: expectedNextDueDate,
      status: expectedStatus,
    });
  }

  return results;
}

export async function assignLoansToContainer(userId, containerId) {
  const snapshot = await getLoanCollection().get();
  const updatedLoans = [];

  for (const doc of snapshot.docs) {
    const loan = serializeLoan(doc);

    if (loan.workspaceId && loan.workspaceId !== userId) {
      continue;
    }

    if (loan.containerId) {
      continue;
    }

    const updatedAt = new Date().toISOString();
    await doc.ref.update({
      workspaceId: userId,
      createdBy: loan.createdBy || loan.userId || "",
      containerId,
      updatedAt,
    });

    updatedLoans.push({
      id: loan.id,
      loanName: loan.loanName,
    });
  }

  return updatedLoans;
}

export async function claimLegacyLoans(workspaceId, userId) {
  const snapshot = await getLoanCollection().get();
  const claimedLoans = [];

  for (const doc of snapshot.docs) {
    const loan = serializeLoan(doc);

    if (loan.workspaceId) {
      continue;
    }

    const updatedAt = new Date().toISOString();
    await doc.ref.update({
      workspaceId,
      createdBy: loan.createdBy || loan.userId || userId,
      updatedAt,
    });

    claimedLoans.push({
      id: loan.id,
      loanName: loan.loanName,
    });
  }

  return claimedLoans;
}
