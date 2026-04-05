function normalizeToDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addMonthsKeepingDay(date, monthsToAdd) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const candidate = new Date(Date.UTC(year, month + monthsToAdd, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)).getUTCDate();
  candidate.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return candidate;
}

export function advanceDueDate(currentDueDate, paymentFrequency) {
  const dueDate = normalizeToDate(currentDueDate);

  if (!dueDate) {
    return "";
  }

  switch (paymentFrequency) {
    case "once per month":
      return toIsoDate(addMonthsKeepingDay(dueDate, 1));
    case "twice per month": {
      const next = new Date(dueDate);
      next.setUTCDate(next.getUTCDate() + 15);
      return toIsoDate(next);
    }
    case "weekly": {
      const next = new Date(dueDate);
      next.setUTCDate(next.getUTCDate() + 7);
      return toIsoDate(next);
    }
    default:
      return toIsoDate(addMonthsKeepingDay(dueDate, 1));
  }
}

export function getLoanStatus(dueDate, currentBalance) {
  if (Number(currentBalance) <= 0) {
    return "paid";
  }

  const parsedDueDate = normalizeToDate(dueDate);

  if (!parsedDueDate) {
    return "active";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedDueDate.setHours(0, 0, 0, 0);

  if (parsedDueDate < today) {
    return "overdue";
  }

  return "active";
}

export function summarizeLoans(loans) {
  return loans.reduce(
    (summary, loan) => {
      summary.totalBalance += Number(loan.remainingBalance || 0);
      summary.totalOriginalAmount += Number(loan.principal || 0);

      if (loan.status === "overdue") {
        summary.overdueCount += 1;
      }

      if (loan.status === "active") {
        summary.activeCount += 1;
      }

      if (loan.status === "paid") {
        summary.paidCount += 1;
      }

      return summary;
    },
    {
      totalBalance: 0,
      totalOriginalAmount: 0,
      overdueCount: 0,
      activeCount: 0,
      paidCount: 0,
    }
  );
}
