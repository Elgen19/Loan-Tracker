export function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function getStatusLabel(status) {
  switch (status) {
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    default:
      return "Active";
  }
}

export function calculateActualMonthlyDue(monthlyPayment, paymentFrequency) {
  const payment = Number(monthlyPayment || 0);
  switch (paymentFrequency) {
    case "twice per month":
      return payment * 2;
    case "weekly":
      return payment * 4;
    case "once per month":
    case "other":
    default:
      return payment;
  }
}

