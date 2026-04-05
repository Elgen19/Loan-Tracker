import React from "react";

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
};

function buildFormState(loan) {
  if (!loan) {
    return initialState;
  }

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
  };
}

const fieldClassName =
  "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20";
const labelClassName = "grid gap-2 text-sm font-semibold text-slate-700";
const sectionClassName = "rounded-3xl border border-white/70 bg-white/90 p-4 shadow-glass backdrop-blur sm:rounded-[28px] sm:p-6";

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
    setFormData((current) => ({
      ...current,
      ...(name === "loanType" && value === "flexible"
        ? { firstRepaymentDate: "", nextDueDate: "", termCount: "", paymentFrequency: "once per month" }
        : null),
      [name]: value,
    }));
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
      <form className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4" onSubmit={handleSubmit}>
        <label className={labelClassName}>
          Container
          <select className={fieldClassName} name="containerId" value={formData.containerId} onChange={handleChange} required>
            <option value="">Select container</option>
            {containers.map((container) => (
              <option key={container.id} value={container.id}>
                {container.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Loan type
          <select className={fieldClassName} name="loanType" value={formData.loanType} onChange={handleChange}>
            <option value="fixed">Fixed</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
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
            className="min-h-[88px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20 sm:min-h-[96px]"
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
    </section>
  );
}
