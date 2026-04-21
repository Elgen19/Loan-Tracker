import React from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import ContainerForm from "./components/ContainerForm";
import AuthScreen from "./components/AuthScreen";
import LoanForm from "./components/LoanForm";
import LoanCard from "./components/LoanCard";
import PaymentForm from "./components/PaymentForm";
import {
  addPayment,
  claimLegacyData,
  createContainer,
  createLoan,
  deleteLoan,
  deletePayment as deletePaymentEntry,
  fetchContainers,
  fetchLoans,
  updateLoan,
  updatePayment as updatePaymentEntry,
} from "./api";
import { auth } from "./firebase";
import { formatCurrency, formatDate } from "./utils";

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
}

function shiftDateByFrequency(value, paymentFrequency, direction = -1) {
  const date = normalizeDate(value);

  if (!date) {
    return null;
  }

  const shiftedDate = new Date(date);

  switch (paymentFrequency) {
    case "weekly":
      shiftedDate.setDate(shiftedDate.getDate() + 7 * direction);
      break;
    case "twice per month":
      shiftedDate.setDate(shiftedDate.getDate() + 15 * direction);
      break;
    case "once per month":
    case "other":
    default:
      shiftedDate.setMonth(shiftedDate.getMonth() + direction);
      break;
  }

  shiftedDate.setHours(0, 0, 0, 0);
  return shiftedDate;
}

function getPaidAmountForCurrentCycle(loan) {
  const nextDueDate = normalizeDate(loan.nextDueDate);

  if (!nextDueDate) {
    return 0;
  }

  const cycleStart =
    shiftDateByFrequency(nextDueDate, loan.paymentFrequency, -1) ||
    normalizeDate(loan.firstRepaymentDate) ||
    nextDueDate;

  return (Array.isArray(loan.payments) ? loan.payments : []).reduce((sum, payment) => {
    const paymentDate = normalizeDate(payment.paymentDate);

    if (!paymentDate) {
      return sum;
    }

    const isWithinCycle = paymentDate.getTime() > cycleStart.getTime() && paymentDate.getTime() <= nextDueDate.getTime();
    return isWithinCycle ? sum + Number(payment.amount || 0) : sum;
  }, 0);
}

function getPaymentCycleDays(paymentFrequency) {
  switch (paymentFrequency) {
    case "weekly":
      return 7;
    case "twice per month":
      return 15;
    case "once per month":
    case "other":
    default:
      return 30;
  }
}

function getLoanProviderName(loanName) {
  return String(loanName || "").trim().toUpperCase();
}

function getEstimatedMissedDueCount(loan, daysPastDue) {
  return Math.max(1, Math.floor(daysPastDue / getPaymentCycleDays(loan.paymentFrequency)) + 1);
}

function calculateOverduePenalty(loan, daysPastDue) {
  const provider = getLoanProviderName(loan.loanName);
  const principal = Number(loan.principal || 0);
  const remainingBalance = Number(loan.remainingBalance || 0);
  const monthlyPayment = Number(loan.monthlyPayment || 0);
  const totalPayable = Number(loan.totalPayable || 0);
  const missedDueCount = getEstimatedMissedDueCount(loan, daysPastDue);

  if (provider.includes("GLOAN") || provider.includes("GGIVES")) {
    return principal * 0.01 * missedDueCount + remainingBalance * 0.0015 * daysPastDue;
  }

  if (provider.includes("JUANHAND")) {
    return remainingBalance * 0.0016 * daysPastDue;
  }

  if (provider.includes("BILLEASE")) {
    if (daysPastDue <= 2) {
      return 0;
    }

    const effectivePenaltyDays = Math.max(daysPastDue, 3);
    return Math.max(monthlyPayment * 0.05, 50 * effectivePenaltyDays);
  }

  if (provider.includes("TALA")) {
    return remainingBalance * 0.05;
  }

  if (provider.includes("PESO LOAN")) {
    const dailyRate = daysPastDue <= 14 ? 0.02 : 0.03;
    return remainingBalance * dailyRate * daysPastDue;
  }

  if (provider.includes("TONIK")) {
    return 500 * missedDueCount;
  }

  if (provider.includes("MAYA")) {
    return remainingBalance * 0.0017 * daysPastDue;
  }

  if (provider.includes("SLOAN")) {
    const monthlyRate = 0.025;
    return totalPayable * monthlyRate * (daysPastDue / 30);
  }

  return 0;
}

function getProofUrls(proofImages) {
  return Array.isArray(proofImages)
    ? proofImages
        .map((proofImage) => (typeof proofImage === "string" ? proofImage : proofImage?.url || ""))
        .filter(Boolean)
    : [];
}

function StatCard({ label, value }) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-4 shadow-glass backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl sm:rounded-[28px] sm:p-5">
      <div className="pointer-events-none absolute -bottom-10 -right-8 h-24 w-24 rounded-full bg-gradient-to-br from-amber/20 to-transparent" />
      <span className="block text-sm text-slate-500">{label}</span>
      <strong className="mt-2 block text-2xl font-semibold text-ink">{value}</strong>
    </article>
  );
}

function SummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
      <path d="M4 19h16v2H4v-2zm1-2h3V9H5v8zm5 0h4V3h-4v14zm6 0h3v-5h-3v5z" />
    </svg>
  );
}

function LoansIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
      <path d="M4 5h16v3H4V5Zm0 5h16v3H4v-3Zm0 5h10v3H4v-3Z" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[20px] w-[20px] fill-none stroke-current stroke-2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CarouselArrowIcon({ direction = "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-2">
      {direction === "left" ? (
        <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-sky-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-slateblue border-r-amber" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-ink">Loading your workspace</p>
        <p className="mt-1 text-sm text-slate-500">Please wait while we securely prepare your shared loan data.</p>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-2">
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SummarySection({ title, description, children }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-4 shadow-glass backdrop-blur sm:rounded-[28px] sm:p-6">
      <div className="pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full bg-gradient-to-br from-sky-100/70 to-transparent" />
      <div className="relative mb-5 border-b border-slate-100 pb-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Summary Section</p>
        <h3 className="text-lg font-semibold text-ink sm:text-xl">{title}</h3>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

function ContainerCard({ container, loanCount, totalBalance, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-4 text-left shadow-glass backdrop-blur transition duration-200 hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber/30 sm:rounded-[28px] sm:p-6"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-amber/20 to-transparent transition duration-200 group-hover:scale-110" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Loan Container</p>
          <h3 className="text-xl font-semibold text-ink sm:text-2xl">{container.name}</h3>
          {container.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{container.description}</p> : null}
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
          {loanCount} loan{loanCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="relative mt-5">
        <div>
          <span className="text-sm text-slate-500">Remaining balance</span>
          <strong className="mt-1 block text-xl font-semibold text-ink">{formatCurrency(totalBalance)}</strong>
        </div>
      </div>
    </button>
  );
}

function createNavigationState(selectedContainerId, selectedContainerView) {
  return {
    selectedContainerId,
    selectedContainerView,
  };
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function App() {
  const [user, setUser] = React.useState(null);
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const [containers, setContainers] = React.useState([]);
  const [loans, setLoans] = React.useState([]);
  const [selectedContainerId, setSelectedContainerId] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSavingLoan, setIsSavingLoan] = React.useState(false);
  const [isSavingContainer, setIsSavingContainer] = React.useState(false);
  const [submittingPaymentFor, setSubmittingPaymentFor] = React.useState("");
  const [deletingLoanId, setDeletingLoanId] = React.useState("");
  const [loanPendingDelete, setLoanPendingDelete] = React.useState(null);
  const [editingLoan, setEditingLoan] = React.useState(null);
  const [newLoanContainerId, setNewLoanContainerId] = React.useState("");
  const [isLoanModalOpen, setIsLoanModalOpen] = React.useState(false);
  const [isContainerModalOpen, setIsContainerModalOpen] = React.useState(false);
  const [paymentModalState, setPaymentModalState] = React.useState(null);
  const [paymentProofViewer, setPaymentProofViewer] = React.useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = React.useState("");
  const [expandedLoanId, setExpandedLoanId] = React.useState("");
  const [selectedContainerView, setSelectedContainerView] = React.useState("loans");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [loanTypeFilter, setLoanTypeFilter] = React.useState("all");
  const [dueWindowDays, setDueWindowDays] = React.useState(7);
  const [dueMonthCarouselIndex, setDueMonthCarouselIndex] = React.useState(0);
  const [error, setError] = React.useState("");
  const hasInitializedHistoryRef = React.useRef(false);
  const isHandlingPopStateRef = React.useRef(false);
  const lastNavigationKeyRef = React.useRef("");

  const loadData = React.useCallback(async () => {
    if (!auth.currentUser) {
      setContainers([]);
      setLoans([]);
      setIsLoading(false);
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      const [loanData, containerData] = await Promise.all([fetchLoans(), fetchContainers()]);
      setLoans(loanData.loans);
      setContainers(containerData.containers);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setContainers([]);
        setLoans([]);
        setSelectedContainerId("");
        setIsAuthLoading(false);
        setIsLoading(false);
        return;
      }

      try {
        setError("");
        setIsAuthLoading(true);
        await claimLegacyData();
        await loadData();
      } catch (authError) {
        setError(authError.message);
      } finally {
        setIsAuthLoading(false);
      }
    });

    return unsubscribe;
  }, [loadData]);

  React.useEffect(() => {
    const handlePopState = (event) => {
      const nextState = event.state || createNavigationState("", "loans");

      isHandlingPopStateRef.current = true;
      setSelectedContainerId(nextState.selectedContainerId || "");
      setSelectedContainerView(nextState.selectedContainerView || "loans");
      setExpandedLoanId("");
      setSearchTerm("");
      setStatusFilter("all");
      setLoanTypeFilter("all");
      setDueWindowDays(7);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  React.useEffect(() => {
    const navigationState = createNavigationState(selectedContainerId, selectedContainerView);
    const navigationKey = `${navigationState.selectedContainerId}:${navigationState.selectedContainerView}`;

    if (!hasInitializedHistoryRef.current) {
      window.history.replaceState(navigationState, "");
      hasInitializedHistoryRef.current = true;
      lastNavigationKeyRef.current = navigationKey;
      return;
    }

    if (isHandlingPopStateRef.current) {
      isHandlingPopStateRef.current = false;
      lastNavigationKeyRef.current = navigationKey;
      return;
    }

    if (lastNavigationKeyRef.current !== navigationKey) {
      window.history.pushState(navigationState, "");
      lastNavigationKeyRef.current = navigationKey;
    }
  }, [selectedContainerId, selectedContainerView]);

  const selectedContainer = React.useMemo(() => {
    return containers.find((container) => container.id === selectedContainerId) || null;
  }, [containers, selectedContainerId]);

  const filteredLoans = React.useMemo(() => {
    const searchableLoans = selectedContainerId ? loans.filter((loan) => loan.containerId === selectedContainerId) : loans;

    return searchableLoans.filter((loan) => {
      const matchesStatus = statusFilter === "all" ? true : loan.status === statusFilter;
      const matchesLoanType = loanTypeFilter === "all" ? true : loan.loanType === loanTypeFilter;
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0
          ? true
          : `${loan.loanName} ${loan.loanType} ${loan.termLabel || ""} ${loan.notes || ""}`.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesLoanType && matchesSearch;
    });
  }, [loanTypeFilter, loans, searchTerm, selectedContainerId, statusFilter]);

  const summaryCards = React.useMemo(() => {
    return filteredLoans.reduce(
      (summary, loan) => {
        const principal = Number(loan.principal || 0);
        const totalPayable = Number(loan.totalPayable || 0);
        const remaining = Number(loan.remainingBalance || 0);
        const paid = Math.max(totalPayable - remaining, 0);

        summary.totalAmountPayable += totalPayable;
        summary.totalAmountPaid += paid;
        summary.totalRemainingBalance += remaining;
        summary.monthlyCashRequirement += Number(loan.monthlyPayment || 0);
        summary.totalPrincipalAmount += principal;

        return summary;
      },
      {
        totalAmountPayable: 0,
        totalAmountPaid: 0,
        totalRemainingBalance: 0,
        monthlyCashRequirement: 0,
        totalPrincipalAmount: 0,
      }
    );
  }, [filteredLoans]);

  const summaryInsights = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fixedLoans = filteredLoans.filter((loan) => loan.loanType === "fixed");
    const flexibleLoans = filteredLoans.filter((loan) => loan.loanType === "flexible");
    const overdueCount = filteredLoans.filter((loan) => loan.status === "overdue").length;

    const dueSoonLoans = fixedLoans
      .filter((loan) => {
        if (!loan.nextDueDate) {
          return false;
        }

        const dueDate = new Date(loan.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= dueWindowDays;
      })
      .sort((left, right) => new Date(left.nextDueDate).getTime() - new Date(right.nextDueDate).getTime());
    const dueSoonAmount = dueSoonLoans.reduce((sum, loan) => sum + Number(loan.monthlyPayment || 0), 0);

    const dueThisMonthLoans = fixedLoans.filter((loan) => {
      if (!loan.nextDueDate) {
        return false;
      }

      const dueDate = new Date(loan.nextDueDate);
      return dueDate.getFullYear() === today.getFullYear() && dueDate.getMonth() === today.getMonth();
    });

    const nextDueLoan = [...fixedLoans]
      .filter((loan) => loan.nextDueDate)
      .sort((left, right) => new Date(left.nextDueDate).getTime() - new Date(right.nextDueDate).getTime())[0];

    const averageMonthlyObligation =
      filteredLoans.length > 0 ? summaryCards.monthlyCashRequirement / filteredLoans.length : 0;

    const highestRemainingLoan = [...filteredLoans].sort(
      (left, right) => Number(right.remainingBalance || 0) - Number(left.remainingBalance || 0)
    )[0];

    const highestInterestLoan = [...filteredLoans].sort(
      (left, right) => Number(right.interestCost || 0) - Number(left.interestCost || 0)
    )[0];

    const lowestRemainingLoan = [...filteredLoans].sort(
      (left, right) => Number(left.remainingBalance || 0) - Number(right.remainingBalance || 0)
    )[0];

    const loansWithCompletion = filteredLoans.map((loan) => {
      const totalPayable = Number(loan.totalPayable || 0);
      const paid = Math.max(totalPayable - Number(loan.remainingBalance || 0), 0);
      const completionRate = totalPayable > 0 ? (paid / totalPayable) * 100 : 0;

      return {
        ...loan,
        paid,
        completionRate,
      };
    });

    const paymentActivity = filteredLoans
      .map((loan) => {
        const payments = Array.isArray(loan.payments) ? loan.payments : [];
        const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const latestPayment = [...payments]
          .filter((payment) => payment.paymentDate)
          .sort((left, right) => new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime())[0];

        return {
          ...loan,
          totalPaid,
          latestPaymentDate: latestPayment?.paymentDate || "",
        };
      })
      .filter((loan) => loan.totalPaid > 0)
      .sort((left, right) => right.totalPaid - left.totalPaid);

    const overdueLoans = fixedLoans
      .filter((loan) => loan.status === "overdue" && loan.nextDueDate)
      .map((loan) => {
        const dueDate = new Date(loan.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.max(Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)), 0);
        const estimatedPenalty = calculateOverduePenalty(loan, daysPastDue);
        const overdueAmount = Number(loan.monthlyPayment || 0) + estimatedPenalty;

        return {
          ...loan,
          daysPastDue,
          estimatedPenalty,
          overdueAmount,
        };
      })
      .sort((left, right) => right.daysPastDue - left.daysPastDue);

    const partiallyPaidLoans = fixedLoans
      .map((loan) => {
        const paidThisCycle = getPaidAmountForCurrentCycle(loan);
        const monthlyPayment = Number(loan.monthlyPayment || 0);

        return {
          ...loan,
          paidThisCycle,
          monthlyPayment,
          balanceToMeetMonthlyPayment: Math.max(monthlyPayment - paidThisCycle, 0),
        };
      })
      .filter((loan) => loan.nextDueDate && loan.monthlyPayment > 0 && loan.paidThisCycle > 0 && loan.paidThisCycle < loan.monthlyPayment)
      .sort((left, right) => new Date(left.nextDueDate || 0).getTime() - new Date(right.nextDueDate || 0).getTime());

    const completionRate =
      summaryCards.totalAmountPayable > 0 ? (summaryCards.totalAmountPaid / summaryCards.totalAmountPayable) * 100 : 0;

    const scheduleEndDate = new Date(today.getFullYear(), 11, 31);
    scheduleEndDate.setHours(0, 0, 0, 0);

    const restOfYearSchedule = fixedLoans.flatMap((loan) => {
      if (!loan.nextDueDate || Number(loan.termCount || 0) <= 0 || Number(loan.remainingBalance || 0) <= 0) {
        return [];
      }

      const scheduleItems = [];
      let dueDate = normalizeDate(loan.nextDueDate);

      for (let installmentIndex = 0; installmentIndex < Number(loan.termCount || 0) && dueDate; installmentIndex += 1) {
        if (dueDate.getTime() > scheduleEndDate.getTime()) {
          break;
        }

        if (dueDate.getTime() >= today.getTime()) {
          scheduleItems.push({
            loanId: loan.id,
            loanName: loan.loanName,
            monthlyPayment: Number(loan.monthlyPayment || 0),
            dueDate: dueDate.toISOString(),
            dueDay: dueDate.getDate(),
            monthLabel: formatMonthLabel(dueDate),
          });
        }

        dueDate = shiftDateByFrequency(dueDate, loan.paymentFrequency, 1);
      }

      return scheduleItems;
    });

    const restOfYearByLoan = fixedLoans
      .map((loan) => {
        const scheduledPayments = restOfYearSchedule.filter((item) => item.loanId === loan.id);

        return {
          ...loan,
          scheduledPayments,
          remainingYearTotal: scheduledPayments.reduce((sum, item) => sum + item.monthlyPayment, 0),
        };
      })
      .filter((loan) => loan.scheduledPayments.length > 0)
      .sort((left, right) => new Date(left.scheduledPayments[0].dueDate).getTime() - new Date(right.scheduledPayments[0].dueDate).getTime());

    const monthCursor = new Date(today.getFullYear(), today.getMonth(), 1);
    const dueByCycleMonthCards = [];

    while (monthCursor.getFullYear() === today.getFullYear()) {
      const monthLabel = formatMonthLabel(monthCursor);
      const fifteenth = restOfYearSchedule.filter((item) => item.monthLabel === monthLabel && item.dueDay >= 1 && item.dueDay <= 15);
      const thirtieth = restOfYearSchedule.filter((item) => item.monthLabel === monthLabel && item.dueDay >= 16);

      dueByCycleMonthCards.push({
        monthLabel,
        fifteenth,
        thirtieth,
        fifteenthTotal: fifteenth.reduce((sum, item) => sum + item.monthlyPayment, 0),
        thirtiethTotal: thirtieth.reduce((sum, item) => sum + item.monthlyPayment, 0),
      });

      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    let urgentAction = "No urgent payment actions right now.";

    if (overdueCount > 0) {
      urgentAction = `${overdueCount} overdue loan${overdueCount === 1 ? "" : "s"} need attention.`;
    } else if (dueSoonLoans.length > 0) {
      urgentAction = `${dueSoonLoans.length} loan${dueSoonLoans.length === 1 ? "" : "s"} due within ${dueWindowDays} day${
        dueWindowDays === 1 ? "" : "s"
      }.`;
    } else if (nextDueLoan) {
      urgentAction = `Next due is ${nextDueLoan.loanName} on ${nextDueLoan.nextDueDate}.`;
    }

    return {
      overdueCount,
      dueSoonCount: dueSoonLoans.length,
      dueSoonLoans,
      dueSoonAmount,
      dueThisMonthLoans,
      dueThisMonthAmount: dueThisMonthLoans.reduce((sum, loan) => sum + Number(loan.monthlyPayment || 0), 0),
      nextDueLoan,
      averageMonthlyObligation,
      highestRemainingLoan,
      highestInterestLoan,
      lowestRemainingLoan,
      loansWithCompletion,
      overdueLoans,
      partiallyPaidLoans,
      completionRate,
      fixedLoansCount: fixedLoans.length,
      flexibleLoansCount: flexibleLoans.length,
      paymentActivity,
      urgentAction,
      overduePenaltyTotal: overdueLoans.reduce((sum, loan) => sum + loan.estimatedPenalty, 0),
      overdueAmountTotal: overdueLoans.reduce((sum, loan) => sum + loan.overdueAmount, 0),
      restOfYearSchedule,
      restOfYearByLoan,
      restOfYearTotal: restOfYearSchedule.reduce((sum, item) => sum + item.monthlyPayment, 0),
      dueByCycleMonthCards,
    };
  }, [dueWindowDays, filteredLoans, summaryCards]);

  React.useEffect(() => {
    setDueMonthCarouselIndex((current) => {
      if (summaryInsights.dueByCycleMonthCards.length === 0) {
        return 0;
      }

      return Math.min(current, summaryInsights.dueByCycleMonthCards.length - 1);
    });
  }, [summaryInsights.dueByCycleMonthCards.length]);

  const containerCards = React.useMemo(() => {
    return containers.map((container) => {
      const containerLoans = loans.filter((loan) => loan.containerId === container.id);
      const totalBalance = containerLoans.reduce((sum, loan) => sum + Number(loan.remainingBalance || 0), 0);

      return {
        ...container,
        loanCount: containerLoans.length,
        totalBalance,
      };
    });
  }, [containers, loans]);

  async function handleSaveLoan(payload) {
    try {
      setError("");
      setIsSavingLoan(true);

      if (editingLoan) {
        await updateLoan(editingLoan.id, payload);
        setEditingLoan(null);
      } else {
        const createdLoan = await createLoan(payload);
        setExpandedLoanId(createdLoan.id);
        setSelectedContainerId(createdLoan.containerId);
      }

      setNewLoanContainerId("");
      setIsLoanModalOpen(false);
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingLoan(false);
    }
  }

  async function handleSaveContainer(payload) {
    try {
      setError("");
      setIsSavingContainer(true);
      const createdContainer = await createContainer(payload);
      setContainers((current) => [...current, createdContainer]);
      setSelectedContainerId(createdContainer.id);
      setIsContainerModalOpen(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingContainer(false);
    }
  }

  async function handleSavePayment(loanId, payload) {
    try {
      setError("");
      setSubmittingPaymentFor(loanId);
      if (paymentModalState?.payment) {
        await updatePaymentEntry(loanId, paymentModalState.payment.id, payload);
      } else {
        await addPayment(loanId, payload);
      }
      setPaymentModalState(null);
      await loadData();
    } catch (paymentError) {
      setError(paymentError.message);
    } finally {
      setSubmittingPaymentFor("");
    }
  }

  async function handleDeletePayment() {
    if (!paymentModalState?.loan || !paymentModalState?.payment) {
      return;
    }

    try {
      setError("");
      setDeletingPaymentId(paymentModalState.payment.id);
      await deletePaymentEntry(paymentModalState.loan.id, paymentModalState.payment.id);
      setPaymentModalState(null);
      await loadData();
    } catch (paymentError) {
      setError(paymentError.message);
    } finally {
      setDeletingPaymentId("");
    }
  }

  async function handleConfirmDeleteLoan() {
    if (!loanPendingDelete) {
      return;
    }

    try {
      setError("");
      setDeletingLoanId(loanPendingDelete.id);
      await deleteLoan(loanPendingDelete.id);

      if (editingLoan?.id === loanPendingDelete.id) {
        setEditingLoan(null);
        setIsLoanModalOpen(false);
      }

      if (expandedLoanId === loanPendingDelete.id) {
        setExpandedLoanId("");
      }

      setLoanPendingDelete(null);
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingLoanId("");
    }
  }

  function handleOpenNewLoanModal() {
    setEditingLoan(null);
    setNewLoanContainerId(selectedContainerId);
    setIsLoanModalOpen(true);
  }

  function handleOpenEditLoanModal(loan) {
    setEditingLoan(loan);
    setNewLoanContainerId("");
    setIsLoanModalOpen(true);
  }

  function handleCloseLoanModal() {
    if (isSavingLoan) {
      return;
    }

    setEditingLoan(null);
    setNewLoanContainerId("");
    setIsLoanModalOpen(false);
  }

  function handleRequestDeleteLoan(loan) {
    setLoanPendingDelete(loan);
  }

  function handleCloseDeleteModal() {
    if (deletingLoanId) {
      return;
    }

    setLoanPendingDelete(null);
  }

  function handleToggleLoan(loanId) {
    setExpandedLoanId((current) => (current === loanId ? "" : loanId));
  }

  function handleOpenContainerModal() {
    setIsContainerModalOpen(true);
  }

  function handleOpenPaymentModal(loan, payment = null) {
    setPaymentModalState({ loan, payment });
  }

  function handleOpenPaymentEditor(loan, payment) {
    setPaymentModalState({ loan, payment });
  }

  function handleOpenPaymentProofViewer(loan, payment, startIndex = 0) {
    const proofUrls = getProofUrls(payment.proofImages);

    if (proofUrls.length === 0) {
      return;
    }

    setPaymentProofViewer({
      loanName: loan.loanName,
      proofImages: proofUrls,
      index: startIndex,
    });
  }

  function handleClosePaymentModal() {
    if (submittingPaymentFor || deletingPaymentId) {
      return;
    }

    setPaymentModalState(null);
  }

  function handleClosePaymentProofViewer() {
    setPaymentProofViewer(null);
  }

  function handleShiftPaymentProof(direction) {
    setPaymentProofViewer((current) => {
      if (!current) {
        return current;
      }

      const total = current.proofImages.length;
      const nextIndex = (current.index + direction + total) % total;
      return {
        ...current,
        index: nextIndex,
      };
    });
  }

  function handleCloseContainerModal() {
    if (isSavingContainer) {
      return;
    }

    setIsContainerModalOpen(false);
  }

  function handleOpenContainerPage(containerId) {
    setSelectedContainerId(containerId);
    setSelectedContainerView("loans");
    setExpandedLoanId("");
    setSearchTerm("");
    setStatusFilter("all");
    setLoanTypeFilter("all");
    setDueWindowDays(7);
  }

  function handleBackToContainers() {
    setSelectedContainerId("");
    setSelectedContainerView("loans");
    setExpandedLoanId("");
    setSearchTerm("");
    setStatusFilter("all");
    setLoanTypeFilter("all");
    setDueWindowDays(7);
  }

  const loanFormInitialValues = editingLoan || (newLoanContainerId ? { containerId: newLoanContainerId } : null);

  async function handleSignOut() {
    await signOut(auth);
  }

  if (isAuthLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
        <div className="w-full rounded-[28px] border border-white/70 bg-white/90 px-6 py-8 shadow-glass backdrop-blur">
          <LoadingIndicator />
        </div>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-glass backdrop-blur">
        <div className="min-w-0">
          <p className="font-semibold text-ink">Signed in</p>
          <p className="truncate text-slate-500">{user.email}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-full bg-slate-100 px-4 font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-slate-200"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {!selectedContainer ? (
        <section className="grid gap-4 sm:gap-5">
          <div className="mb-1 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-ink sm:text-3xl">Choose a container</h2>
            </div>
            <button
              type="button"
              className="hidden h-12 items-center justify-center rounded-full bg-amber px-6 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-amber/30 sm:inline-flex"
              onClick={handleOpenContainerModal}
            >
              Create container
            </button>
          </div>

          {isLoading ? <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-glass sm:rounded-[28px] sm:p-6">Loading containers...</div> : null}

          {!isLoading && containers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6 text-center shadow-glass sm:rounded-[28px] sm:p-10">
              <h3 className="text-lg font-semibold text-ink sm:text-xl">Create your first container</h3>
              <p className="mt-2 text-sm text-slate-500">Start by creating a container like Personal Loans, Business Loans, or Family Borrowing.</p>
            </div>
          ) : null}

          {!isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {containerCards.map((container) => (
                <ContainerCard
                  key={container.id}
                  container={container}
                  loanCount={container.loanCount}
                  totalBalance={container.totalBalance}
                  onOpen={() => handleOpenContainerPage(container.id)}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="grid gap-4 sm:gap-5">
          <div className="mb-1 flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slateblue text-white transition hover:-translate-y-0.5 hover:bg-[#334e77] focus:outline-none focus:ring-4 focus:ring-slate-200"
                onClick={handleBackToContainers}
                aria-label="Back to containers"
                title="Back to containers"
              >
                <BackIcon />
              </button>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Container</p>
                <h2 className="truncate text-xl font-semibold text-ink sm:text-3xl">{selectedContainer.name}</h2>
                {selectedContainer.description ? <p className="mt-1 hidden text-sm text-slate-500 sm:block">{selectedContainer.description}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2 sm:gap-3">
              <button
                type="button"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition focus:outline-none focus:ring-4 sm:h-12 sm:w-auto sm:gap-2 sm:px-5 ${
                  selectedContainerView === "summaries"
                    ? "bg-slateblue text-white focus:ring-slate-200"
                    : "bg-slate-100 text-ink hover:-translate-y-0.5 hover:bg-slate-200 focus:ring-slate-200"
                }`}
                onClick={() =>
                  setSelectedContainerView((current) => {
                    const nextView = current === "summaries" ? "loans" : "summaries";

                    if (nextView === "summaries") {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }

                    return nextView;
                  })
                }
                aria-label={selectedContainerView === "summaries" ? "Show loans" : "View summaries"}
                title={selectedContainerView === "summaries" ? "Show loans" : "View summaries"}
              >
                {selectedContainerView === "summaries" ? <LoansIcon /> : <SummaryIcon />}
                <span className="hidden sm:inline">{selectedContainerView === "summaries" ? "Show loans" : "View summaries"}</span>
              </button>
              {selectedContainerView === "loans" ? (
                <button
                  type="button"
                  className="hidden h-12 items-center justify-center rounded-full bg-amber px-6 text-sm font-semibold text-ink shadow-lg shadow-amber/20 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-amber/30 sm:inline-flex"
                  onClick={handleOpenNewLoanModal}
                >
                  Add loan to {selectedContainer.name}
                </button>
              ) : null}
            </div>
          </div>
          {selectedContainer.description ? <p className="mt-1 text-sm text-slate-500 sm:hidden">{selectedContainer.description}</p> : null}

          {selectedContainerView === "loans" ? (
            <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-glass backdrop-blur sm:rounded-[28px] sm:p-5">
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Search loans
                  <input
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20"
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={`Search loans in ${selectedContainer.name}`}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:contents">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Status
                    <select
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="overdue">Overdue</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Loan type
                    <select
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20"
                      value={loanTypeFilter}
                      onChange={(event) => setLoanTypeFilter(event.target.value)}
                    >
                      <option value="all">All types</option>
                      <option value="fixed">Fixed</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white via-sky-50/60 to-amber-50/40 p-4 shadow-glass backdrop-blur sm:rounded-[28px] sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-amber/20 to-transparent" />
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Summaries</p>
                  <h3 className="text-xl font-semibold text-ink sm:text-3xl">Summary dashboard for {selectedContainer.name}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    A cleaner view of what matters most: upcoming dues, remaining yearly commitments, payment progress,
                    and overdue exposure. The sections below adapt to the loan-type filter so flexible loans stay free of fixed-only due logic.
                  </p>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Loan type
                  <select
                    className="h-11 min-w-[180px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20"
                    value={loanTypeFilter}
                    onChange={(event) => setLoanTypeFilter(event.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="fixed">Fixed</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {isLoading ? <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-glass sm:rounded-[28px] sm:p-6">Loading loans...</div> : null}

          {!isLoading && filteredLoans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6 text-center shadow-glass sm:rounded-[28px] sm:p-10">
              <h3 className="text-lg font-semibold text-ink sm:text-xl">No loans in this container</h3>
              <p className="mt-2 text-sm text-slate-500">Add a loan here to keep everything inside {selectedContainer.name} organized.</p>
            </div>
          ) : null}

          {!isLoading && selectedContainerView === "loans" ? (
            <div className="grid gap-4">
              {filteredLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onOpenPaymentModal={handleOpenPaymentModal}
                  onEditPayment={handleOpenPaymentEditor}
                  onViewPaymentProofs={handleOpenPaymentProofViewer}
                  onEdit={handleOpenEditLoanModal}
                  onDelete={handleRequestDeleteLoan}
                  isDeleting={deletingLoanId === loan.id}
                  isExpanded={expandedLoanId === loan.id}
                  onToggle={() => handleToggleLoan(loan.id)}
                />
              ))}
            </div>
          ) : null}

          {!isLoading && selectedContainerView === "summaries" ? (
            <div className="grid gap-4 sm:gap-5">
              <SummarySection title="Financial Snapshot" description="Core totals for the loans currently visible under your active filters.">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
                  <StatCard label="Total amount payable" value={formatCurrency(summaryCards.totalAmountPayable)} />
                  <StatCard label="Total amount paid so far" value={formatCurrency(summaryCards.totalAmountPaid)} />
                  <StatCard label="Total remaining balance" value={formatCurrency(summaryCards.totalRemainingBalance)} />
                  <StatCard label="Monthly cash requirement" value={formatCurrency(summaryCards.monthlyCashRequirement)} />
                  <StatCard label="Total principal amount" value={formatCurrency(summaryCards.totalPrincipalAmount)} />
                </div>
              </SummarySection>

              {loanTypeFilter !== "flexible" ? (
                <SummarySection
                  title={`Due In The Next ${dueWindowDays} Day${dueWindowDays === 1 ? "" : "s"}`}
                  description="Use the selector to focus on the most urgent dues first, whether they are due tomorrow, within 3 days, or within the week."
                >
                  <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      Due range
                      <select
                        className="h-11 min-w-[160px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20"
                        value={dueWindowDays}
                        onChange={(event) => setDueWindowDays(Number(event.target.value))}
                      >
                        <option value={1}>1 day</option>
                        <option value={3}>3 days</option>
                        <option value={7}>7 days</option>
                      </select>
                    </label>
                    <div className="rounded-[24px] border border-amber-100 bg-amber-50/70 px-5 py-4">
                      <p className="text-sm text-slate-500">Total amount needed</p>
                      <strong className="mt-1 block text-2xl font-semibold text-ink">{formatCurrency(summaryInsights.dueSoonAmount)}</strong>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {summaryInsights.dueSoonLoans.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No loans are due within the next {dueWindowDays} day{dueWindowDays === 1 ? "" : "s"}.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {summaryInsights.dueSoonLoans.map((loan) => (
                          <div key={loan.id} className="rounded-[24px] border border-sky-100 bg-sky-50/80 p-4">
                            <div className="grid gap-2">
                              <div>
                                <p className="font-semibold text-ink">{loan.loanName}</p>
                                <p className="text-sm text-slate-500">Due {formatDate(loan.nextDueDate)}</p>
                              </div>
                              <strong className="text-base font-semibold text-slateblue">{formatCurrency(loan.monthlyPayment)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SummarySection>
              ) : null}

              {loanTypeFilter !== "flexible" ? (
                <>
                  <SummarySection title="Due This Month" description="This section totals loans whose current due date falls within the current month.">
                    <div className="mb-5 rounded-[24px] border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-4">
                      <p className="text-sm text-slate-500">Total due this month</p>
                      <strong className="mt-1 block text-2xl font-semibold text-ink">{formatCurrency(summaryInsights.dueThisMonthAmount)}</strong>
                    </div>
                    <div className="grid gap-3">
                      {summaryInsights.dueThisMonthLoans.length === 0 ? (
                        <p className="text-sm text-slate-500">No loans due this month under the current filter.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {summaryInsights.dueThisMonthLoans.map((loan) => (
                            <div key={loan.id} className="rounded-[24px] border border-sky-100 bg-sky-50/70 p-4">
                              <div className="grid gap-2">
                                <div>
                                  <p className="font-semibold text-ink">{loan.loanName}</p>
                                  <p className="text-sm text-slate-500">Due {formatDate(loan.nextDueDate)}</p>
                                </div>
                                <strong className="text-base font-semibold text-slateblue">{formatCurrency(loan.monthlyPayment)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SummarySection>

                  <SummarySection
                    title="15th And 30th Due Board"
                    description="Browse each month to see which loans fall within the 1st to 15th window and which ones fall within the 16th to month-end window."
                  >
                    {summaryInsights.dueByCycleMonthCards.length === 0 ? (
                      <p className="text-sm text-slate-500">No scheduled 15th or 30th dues for the rest of the year.</p>
                    ) : (
                      <>
                        <div className="mb-5 flex items-center justify-between gap-3 rounded-[24px] border border-amber-100 bg-gradient-to-r from-amber-50 to-white px-4 py-3">
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm transition hover:bg-slate-100"
                            onClick={() =>
                              setDueMonthCarouselIndex((current) =>
                                current === 0 ? summaryInsights.dueByCycleMonthCards.length - 1 : current - 1
                              )
                            }
                            aria-label="Previous due month"
                          >
                            <CarouselArrowIcon direction="left" />
                          </button>
                          <div className="text-center">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Due Calendar</p>
                            <h4 className="text-lg font-semibold text-ink">
                              {summaryInsights.dueByCycleMonthCards[dueMonthCarouselIndex]?.monthLabel}
                            </h4>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm transition hover:bg-slate-100"
                            onClick={() =>
                              setDueMonthCarouselIndex((current) =>
                                current === summaryInsights.dueByCycleMonthCards.length - 1 ? 0 : current + 1
                              )
                            }
                            aria-label="Next due month"
                          >
                            <CarouselArrowIcon direction="right" />
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {[
                            {
                              title: "1st to 15th due board",
                              items: summaryInsights.dueByCycleMonthCards[dueMonthCarouselIndex]?.fifteenth || [],
                              total: summaryInsights.dueByCycleMonthCards[dueMonthCarouselIndex]?.fifteenthTotal || 0,
                              tone: "border-sky-100 bg-sky-50/70",
                            },
                            {
                              title: "16th to month-end due board",
                              items: summaryInsights.dueByCycleMonthCards[dueMonthCarouselIndex]?.thirtieth || [],
                              total: summaryInsights.dueByCycleMonthCards[dueMonthCarouselIndex]?.thirtiethTotal || 0,
                              tone: "border-amber-100 bg-amber-50/70",
                            },
                          ].map((cycleCard) => (
                            <div key={cycleCard.title} className={`rounded-[24px] border p-4 ${cycleCard.tone}`}>
                              <div className="mb-4 border-b border-white/80 pb-3">
                                <p className="text-sm text-slate-500">{cycleCard.title}</p>
                                <strong className="mt-1 block text-xl font-semibold text-ink">{formatCurrency(cycleCard.total)}</strong>
                              </div>
                              {cycleCard.items.length === 0 ? (
                                <p className="text-sm text-slate-500">No scheduled dues in this billing window for the selected month.</p>
                              ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {cycleCard.items.map((item) => (
                                    <div key={`${item.loanId}-${item.dueDate}`} className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
                                      <p className="font-semibold text-ink">{item.loanName}</p>
                                      <p className="text-sm text-slate-500">Due {formatDate(item.dueDate)}</p>
                                      <strong className="mt-1 block text-base font-semibold text-slateblue">{formatCurrency(item.monthlyPayment)}</strong>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </SummarySection>
                </>
              ) : null}

              {loanTypeFilter !== "flexible" ? (
                <SummarySection
                  title="Rest Of Year Payment Forecast"
                  description="This section projects the remaining scheduled payments for the rest of the year based on the current due date, payment frequency, and remaining loan term."
                >
                  <div className="mb-5 rounded-[24px] border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4">
                    <p className="text-sm text-slate-500">Total scheduled for the rest of the year</p>
                    <strong className="mt-1 block text-2xl font-semibold text-ink">{formatCurrency(summaryInsights.restOfYearTotal)}</strong>
                  </div>
                  {summaryInsights.restOfYearByLoan.length === 0 ? (
                    <p className="text-sm text-slate-500">No remaining fixed-loan payments scheduled for the rest of this year.</p>
                  ) : (
                    <div className="grid gap-3">
                      {summaryInsights.restOfYearByLoan.map((loan) => (
                        <div key={loan.id} className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="font-semibold text-ink">{loan.loanName}</p>
                              <p className="text-sm text-slate-500">
                                Monthly payment {formatCurrency(loan.monthlyPayment)} | Next due {formatDate(loan.scheduledPayments[0]?.dueDate)}
                              </p>
                            </div>
                            <div className="text-left md:text-right">
                              <p className="text-sm text-slate-500">Remaining this year</p>
                              <strong className="text-lg font-semibold text-emerald-700">{formatCurrency(loan.remainingYearTotal)}</strong>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {loan.scheduledPayments.map((item) => (
                              <div key={`${loan.id}-${item.dueDate}`} className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3">
                                <p className="text-sm font-semibold text-ink">{formatDate(item.dueDate)}</p>
                                <p className="text-sm text-slate-500">{item.monthLabel}</p>
                                <strong className="mt-1 block text-base font-semibold text-slateblue">{formatCurrency(item.monthlyPayment)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SummarySection>
              ) : null}

              <SummarySection title="Visual Snapshot" description="A quick visual read on portfolio mix and overall progress for the loans currently displayed.">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="text-base font-semibold text-ink">Completion by loan</h4>
                      <span className="text-sm text-slate-500">Based on paid vs total payable</span>
                    </div>
                    <div className="grid gap-4">
                      {summaryInsights.loansWithCompletion.length === 0 ? (
                        <p className="text-sm text-slate-500">No loan progress to show.</p>
                      ) : (
                        summaryInsights.loansWithCompletion.map((loan) => (
                          <div key={loan.id} className="grid gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-ink">{loan.loanName}</span>
                              <span className="text-sm text-slate-500">{loan.completionRate.toFixed(1)}%</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-slateblue to-amber"
                                style={{ width: `${Math.min(loan.completionRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
                    <h4 className="text-base font-semibold text-ink">Loan type mix</h4>
                    <p className="mt-1 text-sm text-slate-500">A simple split between fixed and flexible loans.</p>
                    <div className="mt-5 grid gap-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-ink">Fixed</span>
                          <span className="text-slate-500">{summaryInsights.fixedLoansCount}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-slateblue"
                            style={{
                              width: `${
                                filteredLoans.length > 0 ? (summaryInsights.fixedLoansCount / filteredLoans.length) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-ink">Flexible</span>
                          <span className="text-slate-500">{summaryInsights.flexibleLoansCount}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-amber"
                            style={{
                              width: `${
                                filteredLoans.length > 0 ? (summaryInsights.flexibleLoansCount / filteredLoans.length) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-medium text-ink">Urgent action</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{summaryInsights.urgentAction}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SummarySection>

              <SummarySection title="Balance Insights" description="These cards show which loans carry the heaviest and lightest remaining balances right now.">
                <div className="grid gap-3 sm:gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-1">
                    <StatCard label="Average monthly obligation" value={formatCurrency(summaryInsights.averageMonthlyObligation)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:col-span-2">
                  <StatCard
                    label="Highest remaining balance"
                    value={
                      summaryInsights.highestRemainingLoan
                        ? `${summaryInsights.highestRemainingLoan.loanName}: ${formatCurrency(summaryInsights.highestRemainingLoan.remainingBalance)}`
                        : "No data"
                    }
                  />
                  <StatCard
                    label="Lowest remaining balance"
                    value={
                      summaryInsights.lowestRemainingLoan
                        ? `${summaryInsights.lowestRemainingLoan.loanName}: ${formatCurrency(summaryInsights.lowestRemainingLoan.remainingBalance)}`
                        : "No data"
                    }
                  />
                  </div>
                </div>
              </SummarySection>

              <SummarySection
                title="Payment Activity"
                description="This section totals what has already been paid per loan, shows what balance is left, and surfaces the latest payment date for quick follow-up."
              >
                <div className="grid gap-3">
                  {summaryInsights.paymentActivity.length === 0 ? (
                    <p className="text-sm text-slate-500">No recorded payments yet under the current filter.</p>
                  ) : (
                    summaryInsights.paymentActivity.map((loan) => (
                      <div key={loan.id} className="rounded-[24px] border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-ink">{loan.loanName}</p>
                            <p className="text-sm text-slate-500">
                              Latest payment {loan.latestPaymentDate ? formatDate(loan.latestPaymentDate) : "No payment date"}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm md:text-right">
                            <div>
                              <p className="text-slate-500">Paid so far</p>
                              <strong className="text-base font-semibold text-slateblue">{formatCurrency(loan.totalPaid)}</strong>
                            </div>
                            <div>
                              <p className="text-slate-500">Remaining balance</p>
                              <strong className="text-base font-semibold text-ink">{formatCurrency(loan.remainingBalance)}</strong>
                            </div>
                            <div>
                              <p className="text-slate-500">Loan type</p>
                              <strong className="text-base font-semibold text-ink">
                                {loan.loanType === "fixed" ? "Fixed" : "Flexible"}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SummarySection>

              {loanTypeFilter !== "flexible" ? (
                <>
                  <SummarySection title="Interest Exposure" description="A comparison of how much interest each visible loan is carrying.">
                    <div className="grid gap-3">
                      {filteredLoans.length === 0 ? (
                        <p className="text-sm text-slate-500">No loan interest data to show.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {filteredLoans.map((loan) => (
                            <div key={loan.id} className="rounded-[24px] border border-amber-100 bg-amber-50/70 p-4">
                              <div className="grid gap-2">
                                <div>
                                  <p className="font-semibold text-ink">{loan.loanName}</p>
                                  <p className="text-sm text-slate-500">{loan.loanType === "fixed" ? loan.termLabel : "Flexible agreement"}</p>
                                </div>
                                <strong className="text-base font-semibold text-slateblue">{formatCurrency(loan.interestCost)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SummarySection>

                  <SummarySection
                    title="Overdue Loans"
                    description="These loans are already past due. This section combines the overdue installment with estimated lender-specific penalties so you can see the current overdue exposure more clearly."
                  >
                    <div className="mb-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 p-4">
                        <p className="text-sm text-slate-500">Estimated overdue total</p>
                        <strong className="mt-1 block text-2xl font-semibold text-rose-700">{formatCurrency(summaryInsights.overdueAmountTotal)}</strong>
                      </div>
                      <div className="rounded-[24px] border border-orange-200 bg-orange-50/80 p-4">
                        <p className="text-sm text-slate-500">Estimated penalties</p>
                        <strong className="mt-1 block text-2xl font-semibold text-orange-700">{formatCurrency(summaryInsights.overduePenaltyTotal)}</strong>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {summaryInsights.overdueLoans.length === 0 ? (
                        <p className="text-sm text-slate-500">No overdue loans under the current filter.</p>
                      ) : (
                        summaryInsights.overdueLoans.map((loan) => (
                          <div key={loan.id} className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-4">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="font-semibold text-ink">{loan.loanName}</p>
                                <p className="text-sm text-rose-700">
                                  Due {formatDate(loan.nextDueDate)} • {loan.daysPastDue} day{loan.daysPastDue === 1 ? "" : "s"} overdue
                                </p>
                              </div>
                              <div className="grid gap-3 text-sm md:grid-cols-3 md:text-right">
                                <div>
                                  <p className="text-slate-500">Installment due</p>
                                  <strong className="text-base font-semibold text-ink">{formatCurrency(loan.monthlyPayment)}</strong>
                                </div>
                                <div>
                                  <p className="text-slate-500">Penalty</p>
                                  <strong className="text-base font-semibold text-orange-700">{formatCurrency(loan.estimatedPenalty)}</strong>
                                </div>
                                <div>
                                  <p className="text-slate-500">Overdue total</p>
                                  <strong className="text-base font-semibold text-rose-700">{formatCurrency(loan.overdueAmount)}</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Penalties are estimated from the configured lender rules. For SLOAN, the app currently uses the lower 2.5% monthly rate as a conservative estimate.
                    </p>
                  </SummarySection>

                  <SummarySection
                    title="Partially Paid Loans"
                    description="These are fixed loans with a payment logged for the current cycle, but the total paid so far still has not reached the required monthly payment."
                  >
                    <div className="grid gap-3">
                      {summaryInsights.partiallyPaidLoans.length === 0 ? (
                        <p className="text-sm text-slate-500">No partially paid fixed loans under the current filter.</p>
                      ) : (
                        summaryInsights.partiallyPaidLoans.map((loan) => (
                          <div key={loan.id} className="rounded-[24px] border border-amber-100 bg-amber-50/70 p-4">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-semibold text-ink">{loan.loanName}</p>
                                <p className="text-sm text-slate-500">Due {formatDate(loan.nextDueDate)}</p>
                              </div>
                              <div className="grid gap-3 text-sm md:grid-cols-3 md:text-right">
                                <div>
                                  <p className="text-slate-500">Paid this cycle</p>
                                  <strong className="text-base font-semibold text-slateblue">{formatCurrency(loan.paidThisCycle)}</strong>
                                </div>
                                <div>
                                  <p className="text-slate-500">Monthly payment</p>
                                  <strong className="text-base font-semibold text-ink">{formatCurrency(loan.monthlyPayment)}</strong>
                                </div>
                                <div>
                                  <p className="text-slate-500">Still needed</p>
                                  <strong className="text-base font-semibold text-rose-700">
                                    {formatCurrency(loan.balanceToMeetMonthlyPayment)}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </SummarySection>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      {!selectedContainer ? (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber text-ink shadow-xl shadow-amber/30 transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber/30 sm:hidden"
          onClick={handleOpenContainerModal}
          aria-label="Create container"
          title="Create container"
        >
          <AddIcon />
        </button>
      ) : null}

      {selectedContainerView === "loans" && selectedContainer ? (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber text-ink shadow-xl shadow-amber/30 transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber/30 sm:hidden"
          onClick={handleOpenNewLoanModal}
          aria-label={`Add loan to ${selectedContainer.name}`}
          title="Add loan"
        >
          <AddIcon />
        </button>
      ) : null}

      {isLoanModalOpen ? (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/45 p-3 backdrop-blur-sm sm:p-6" onClick={handleCloseLoanModal}>
          <div className="scrollbar-hide my-auto w-full max-w-3xl overflow-y-auto rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <LoanForm
              onSubmit={handleSaveLoan}
              isSubmitting={isSavingLoan}
              initialValues={loanFormInitialValues}
              containers={containers}
              submitLabel={editingLoan ? "Save changes" : "Add loan"}
              title={editingLoan ? "Edit loan details" : "Add loan details"}
              eyebrow={editingLoan ? "Editing Loan" : "New Loan"}
              onCancel={handleCloseLoanModal}
            />
          </div>
        </div>
      ) : null}

      {isContainerModalOpen ? (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/45 p-3 backdrop-blur-sm sm:p-6" onClick={handleCloseContainerModal}>
          <div className="scrollbar-hide my-auto w-full max-w-xl overflow-y-auto rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <ContainerForm onSubmit={handleSaveContainer} isSubmitting={isSavingContainer} onCancel={handleCloseContainerModal} />
          </div>
        </div>
      ) : null}

      {paymentModalState ? (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/45 p-3 backdrop-blur-sm sm:p-6" onClick={handleClosePaymentModal}>
          <div className="scrollbar-hide my-auto w-full max-w-3xl overflow-y-auto rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <section className="rounded-3xl border border-white/70 bg-white/95 p-4 shadow-glass backdrop-blur sm:rounded-[28px] sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                    {paymentModalState.payment ? "Edit Payment" : "Add Payment"}
                  </p>
                  <h2 className="text-xl font-semibold text-ink sm:text-2xl">{paymentModalState.loan.loanName}</h2>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink transition hover:-translate-y-0.5 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-70"
                  onClick={handleClosePaymentModal}
                  disabled={Boolean(submittingPaymentFor || deletingPaymentId)}
                  aria-label="Close payment modal"
                  title="Close"
                >
                  <CloseIcon />
                </button>
              </div>
              <PaymentForm
                loanId={paymentModalState.loan.id}
                initialValues={paymentModalState.payment}
                onSubmit={handleSavePayment}
                isSubmitting={submittingPaymentFor === paymentModalState.loan.id}
                submitLabel={paymentModalState.payment ? "Save payment" : "Add payment"}
                onDelete={paymentModalState.payment ? handleDeletePayment : null}
                isDeleting={deletingPaymentId === paymentModalState.payment?.id}
              />
            </section>
          </div>
        </div>
      ) : null}

      {paymentProofViewer ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm sm:p-6" onClick={handleClosePaymentProofViewer}>
          <div className="w-full max-w-4xl rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <section className="rounded-[28px] border border-white/70 bg-white/95 p-4 shadow-glass backdrop-blur sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Proof of Payment</p>
                  <h2 className="text-xl font-semibold text-ink sm:text-2xl">{paymentProofViewer.loanName}</h2>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink transition hover:-translate-y-0.5 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200"
                  onClick={handleClosePaymentProofViewer}
                  aria-label="Close proof viewer"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="grid gap-4">
                <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                  <img
                    src={paymentProofViewer.proofImages[paymentProofViewer.index]}
                    alt={`Proof of payment ${paymentProofViewer.index + 1}`}
                    className="max-h-[70vh] w-full object-contain"
                  />
                  {paymentProofViewer.proofImages.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/75 text-white transition hover:bg-ink"
                        onClick={() => handleShiftPaymentProof(-1)}
                        aria-label="Previous proof image"
                      >
                        <CarouselArrowIcon direction="left" />
                      </button>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/75 text-white transition hover:bg-ink"
                        onClick={() => handleShiftPaymentProof(1)}
                        aria-label="Next proof image"
                      >
                        <CarouselArrowIcon direction="right" />
                      </button>
                    </>
                  ) : null}
                </div>
                {paymentProofViewer.proofImages.length > 1 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {paymentProofViewer.proofImages.map((proofImage, index) => (
                      <button
                        key={`${proofImage.slice(0, 16)}-${index}`}
                        type="button"
                        className={`overflow-hidden rounded-2xl border transition ${
                          paymentProofViewer.index === index ? "border-slateblue ring-2 ring-slate-200" : "border-slate-200"
                        }`}
                        onClick={() => setPaymentProofViewer((current) => (current ? { ...current, index } : current))}
                      >
                        <img src={proofImage} alt={`Proof thumbnail ${index + 1}`} className="h-20 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {loanPendingDelete ? (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/45 p-3 backdrop-blur-sm sm:p-6" onClick={handleCloseDeleteModal}>
          <div className="scrollbar-hide my-auto w-full max-w-lg overflow-y-auto rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-glass backdrop-blur">
              <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-rose-100 to-transparent" />
              <div className="relative mb-5 grid place-items-center">
                <div className="absolute h-24 w-24 rounded-full bg-gradient-to-br from-rose-200/60 to-transparent" />
                <div className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-rose-100 to-white text-2xl font-extrabold text-rose-700 shadow-sm">
                  !
                </div>
              </div>
              <div className="relative grid gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Delete Loan</p>
                <h2 className="text-2xl font-semibold text-ink">Remove {loanPendingDelete.loanName}?</h2>
                <p className="text-sm leading-6 text-slate-500">This will permanently delete the loan details and payment history for this entry.</p>
              </div>
              <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70"
                  onClick={handleConfirmDeleteLoan}
                  disabled={deletingLoanId === loanPendingDelete.id}
                >
                  {deletingLoanId === loanPendingDelete.id ? "Deleting..." : "Delete loan"}
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-slate-200 disabled:cursor-wait disabled:opacity-70"
                  onClick={handleCloseDeleteModal}
                  disabled={Boolean(deletingLoanId)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
