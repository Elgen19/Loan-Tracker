import React from "react";
import { formatCurrency, calculateActualMonthlyDue } from "../utils";

const initialState = {
  containerId: "",
  loanName: "",
  loanType: "fixed",
  principal: "",
  termCount: "",
  paymentFrequency: "once per month",
  monthlyPayment: "",
  totalPayable: "",
  firstRepaymentDate: "",
  nextDueDate: "",
  remainingBalance: "",
  notes: "",
  fundingSource: "self",
  linkedLoanIds: [],
  linkedLoanConfigs: {},
};

function buildFormState(loan) {
  if (!loan) {
    return initialState;
  }

  // Support backward compatibility for linkedLoanId
  const linkedLoanIds = loan.linkedLoanIds || (loan.linkedLoanId ? [loan.linkedLoanId] : []);

  return {
    containerId: loan.containerId || "",
    loanName: loan.loanName || "",
    principal: String(loan.principal ?? ""),
    termCount: loan.termCount ? String(loan.termCount) : "",
    paymentFrequency: loan.paymentFrequency || "once per month",
    monthlyPayment: String(loan.monthlyPayment ?? ""),
    totalPayable: String(loan.totalPayable ?? ""),
    firstRepaymentDate: loan.firstRepaymentDate || "",
    nextDueDate: loan.nextDueDate || "",
    remainingBalance: String(loan.remainingBalance ?? ""),
    loanType: loan.loanType || "fixed",
    notes: loan.notes || "",
    fundingSource: loan.fundingSource || "self",
    linkedLoanIds: linkedLoanIds,
    linkedLoanConfigs: loan.linkedLoanConfigs || {},
  };
}

const fieldClassName =
  "h-11 w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white px-3 text-[13px] text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20 sm:px-4 sm:text-sm";
const labelClassName = "grid min-w-0 gap-2 text-sm font-semibold text-slate-700";
const sectionClassName = "rounded-3xl border border-white/70 bg-white/90 p-4 shadow-glass backdrop-blur sm:rounded-[28px] sm:p-6";

function LoadingState({ title, description }) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-[24px] border border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
      <div>
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slateblue" />
        <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function roundToTwo(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export default function LoanForm({
  onSubmit,
  isSubmitting,
  initialValues = null,
  submitLabel = "Add loan",
  title = "Add loan details",
  eyebrow = "New Loan",
  onCancel,
  containers = [],
  loans = [],
}) {
  const [formData, setFormData] = React.useState(() => buildFormState(initialValues));
  const principalValue = Number(formData.principal || 0);
  const isFixedLoan = formData.loanType === "fixed";
  const termCountValue = Number(formData.termCount || 0);
  const totalPayableValue = roundToTwo(isFixedLoan ? Number(formData.monthlyPayment || 0) * termCountValue : Number(formData.totalPayable || 0));
  const interestCost = roundToTwo(Math.max(totalPayableValue - principalValue, 0));
  const agreementOptions = ["once per month", "twice per month", "weekly", "other"];

  React.useEffect(() => {
    setFormData(buildFormState(initialValues));
  }, [initialValues]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => {
      const updated = {
        ...current,
        [name]: value,
      };

      if (name === "loanType") {
        if (value === "flexible") {
          updated.firstRepaymentDate = "";
          updated.nextDueDate = "";
          updated.termCount = "";
          updated.paymentFrequency = "once per month";
        } else {
          updated.fundingSource = "self";
          updated.linkedLoanIds = [];
          updated.linkedLoanConfigs = {};
        }
      }

      if (name === "fundingSource" && value === "self") {
        updated.linkedLoanIds = [];
        updated.linkedLoanConfigs = {};
      }

      return updated;
    });
  }

  function calculateTotalFromLinks(ids, configs) {
    const selectedLoans = loans.filter((l) => ids.includes(l.id));
    return selectedLoans.reduce((sum, l) => {
      const mode = configs?.[l.id] || "monthly";
      if (mode === "installment") {
        return sum + Number(l.monthlyPayment || 0);
      }
      return sum + calculateActualMonthlyDue(l.monthlyPayment, l.paymentFrequency);
    }, 0);
  }

  function handleLinkToggle(loanId) {
    setFormData((current) => {
      const alreadyLinked = current.linkedLoanIds.includes(loanId);
      const updatedIds = alreadyLinked
        ? current.linkedLoanIds.filter((id) => id !== loanId)
        : [...current.linkedLoanIds, loanId];

      const updatedConfigs = { ...current.linkedLoanConfigs };
      if (alreadyLinked) {
        delete updatedConfigs[loanId];
      } else {
        updatedConfigs[loanId] = "monthly"; // default to monthly
      }

      const totalMonthlyDue = calculateTotalFromLinks(updatedIds, updatedConfigs);

      return {
        ...current,
        linkedLoanIds: updatedIds,
        linkedLoanConfigs: updatedConfigs,
        principal: String(totalMonthlyDue || ""),
        remainingBalance: String(totalMonthlyDue || ""),
      };
    });
  }

  function handleConfigChange(loanId, configType) {
    setFormData((current) => {
      const updatedConfigs = {
        ...current.linkedLoanConfigs,
        [loanId]: configType,
      };

      const totalMonthlyDue = calculateTotalFromLinks(current.linkedLoanIds, updatedConfigs);

      return {
        ...current,
        linkedLoanConfigs: updatedConfigs,
        principal: String(totalMonthlyDue || ""),
        remainingBalance: String(totalMonthlyDue || ""),
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({
      ...formData,
      principal: Number(formData.principal),
      termCount: isFixedLoan ? Number(formData.termCount) : 0,
      monthlyPayment: isFixedLoan ? Number(formData.monthlyPayment) : 0,
      totalPayable: isFixedLoan ? totalPayableValue : principalValue,
      interestCost: isFixedLoan ? interestCost : 0,
      remainingBalance: isFixedLoan ? Number(formData.remainingBalance) : principalValue,
      fundingSource: isFixedLoan ? "self" : formData.fundingSource,
      linkedLoanIds: (!isFixedLoan && formData.fundingSource === "linked") ? formData.linkedLoanIds : [],
      linkedLoanConfigs: (!isFixedLoan && formData.fundingSource === "linked") ? formData.linkedLoanConfigs : {},
    });

    if (!initialValues) {
      setFormData(initialState);
    }
  }

  return (
    <section className={sectionClassName}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
          <h2 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
        </div>
      </div>
      {isSubmitting ? (
        <div className="mt-4 sm:mt-5">
          <LoadingState
            title={initialValues ? "Updating loan information" : "Saving loan information"}
            description="Please wait while the app updates the loan details and refreshes the schedule."
          />
        </div>
      ) : (
      <form className="mt-4 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 sm:mt-5 sm:gap-4" onSubmit={handleSubmit}>
        <label className={labelClassName}>
          Loan type
          <select className={fieldClassName} name="loanType" value={formData.loanType} onChange={handleChange}>
            <option value="fixed">Fixed</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
        {!isFixedLoan ? (
          <>
            <label className={labelClassName}>
              Funding Source
              <select className={fieldClassName} name="fundingSource" value={formData.fundingSource} onChange={handleChange}>
                <option value="self">My own funds (Self-funded)</option>
                <option value="linked">Borrowed funds (Linked to Fixed loan)</option>
              </select>
            </label>
            {formData.fundingSource === "linked" ? (
              <div className="col-span-2 rounded-2xl border border-sky-100 bg-sky-50/30 p-4">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Link Active Fixed Loans</span>
                {loans.filter((loan) => loan.loanType === "fixed" && loan.containerId === formData.containerId && loan.id !== initialValues?.id).length === 0 ? (
                  <div className="text-xs text-rose-500 font-normal py-1">
                    No active fixed loans in this container to link.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 max-h-[240px] overflow-y-auto pr-1">
                    {loans
                      .filter((loan) => loan.loanType === "fixed" && loan.containerId === formData.containerId && loan.id !== initialValues?.id)
                      .map((loan) => {
                        const isChecked = formData.linkedLoanIds.includes(loan.id);
                        const actualMonthlyDue = calculateActualMonthlyDue(loan.monthlyPayment, loan.paymentFrequency);
                        const displayMonthlyDue =
                          loan.paymentFrequency === "once per month" || !loan.paymentFrequency
                            ? `${formatCurrency(loan.monthlyPayment)} monthly due`
                            : `${formatCurrency(loan.monthlyPayment)} / ${loan.paymentFrequency} (${formatCurrency(actualMonthlyDue)} monthly due)`;

                        const hasDifferentAmounts = loan.paymentFrequency && loan.paymentFrequency !== "once per month" && loan.paymentFrequency !== "other";
                        const selectedConfig = formData.linkedLoanConfigs?.[loan.id] || "monthly";

                        return (
                          <div key={loan.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300">
                            <label className="flex cursor-pointer items-center gap-3">
                              <input
                                type="checkbox"
                                className="h-4.5 w-4.5 rounded border-slate-300 text-amber focus:ring-amber"
                                checked={isChecked}
                                onChange={() => handleLinkToggle(loan.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-ink sm:text-sm">{loan.loanName}</p>
                                <p className="text-[11px] text-slate-500">{displayMonthlyDue}</p>
                              </div>
                            </label>
                            {isChecked && hasDifferentAmounts && (
                              <div className="mt-2 pl-7 border-t border-slate-100 pt-2 flex flex-col gap-1.5">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Link Mode</span>
                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`link-amount-${loan.id}`}
                                    checked={selectedConfig === "installment"}
                                    onChange={() => handleConfigChange(loan.id, "installment")}
                                    className="h-3.5 w-3.5 text-amber focus:ring-amber"
                                  />
                                  <span>Pay per due (Installment): <strong>{formatCurrency(loan.monthlyPayment)}</strong></span>
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`link-amount-${loan.id}`}
                                    checked={selectedConfig === "monthly"}
                                    onChange={() => handleConfigChange(loan.id, "monthly")}
                                    className="h-3.5 w-3.5 text-amber focus:ring-amber"
                                  />
                                  <span>Full monthly amount: <strong>{formatCurrency(actualMonthlyDue)}</strong></span>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : null}
        <label className={labelClassName}>
          Loan name
          <input className={fieldClassName} name="loanName" value={formData.loanName} onChange={handleChange} required />
        </label>
        <label className={labelClassName}>
          Loaned amount
          <input className={fieldClassName} name="principal" type="number" min="0" step="0.01" value={formData.principal} onChange={handleChange} required />
        </label>
        {isFixedLoan ? (
          <>
            <label className={labelClassName}>
              Term
              <input className={fieldClassName} name="termCount" type="number" min="1" step="1" value={formData.termCount} onChange={handleChange} required={isFixedLoan} />
            </label>
            <label className={labelClassName}>
              Loan agreement
              <select className={fieldClassName} name="paymentFrequency" value={formData.paymentFrequency} onChange={handleChange} required={isFixedLoan}>
                {agreementOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {isFixedLoan ? (
          <>
            <label className={labelClassName}>
              Monthly payment
              <input className={fieldClassName} name="monthlyPayment" type="number" min="0" step="0.01" value={formData.monthlyPayment} onChange={handleChange} required />
            </label>
            <label className={labelClassName}>
              Total payable
              <input
                className={`${fieldClassName} bg-slate-50 text-slate-500`}
                name="totalPayable"
                type="number"
                min="0"
                step="0.01"
                value={totalPayableValue}
                onChange={handleChange}
                readOnly
                required
              />
            </label>
            <label className={labelClassName}>
              Interest cost
              <input className={`${fieldClassName} bg-slate-50 text-slate-500`} value={interestCost} readOnly />
            </label>
            <label className={labelClassName}>
              Remaining balance
              <input className={fieldClassName} name="remainingBalance" type="number" min="0" step="0.01" value={formData.remainingBalance} onChange={handleChange} required />
            </label>
          </>
        ) : null}
        {isFixedLoan ? (
          <>
            <label className={labelClassName}>
              First repayment date
              <input className={fieldClassName} name="firstRepaymentDate" type="date" value={formData.firstRepaymentDate} onChange={handleChange} required={isFixedLoan} />
            </label>
            <label className={labelClassName}>
              Next due date
              <input className={fieldClassName} name="nextDueDate" type="date" value={formData.nextDueDate} onChange={handleChange} required={isFixedLoan} />
            </label>
          </>
        ) : null}
        <label className={`${labelClassName} col-span-2`}>
          Notes
          <textarea
            className="min-h-[88px] w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20 sm:min-h-[96px] sm:px-4 sm:text-sm"
            name="notes"
            rows="3"
            value={formData.notes}
            onChange={handleChange}
          />
        </label>
        <div className="col-span-2 flex flex-col gap-2 sm:gap-3 md:flex-row">
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-70 md:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </button>
          {onCancel ? (
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-slate-200 disabled:cursor-wait disabled:opacity-70 md:w-auto"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      )}
    </section>
  );
}
