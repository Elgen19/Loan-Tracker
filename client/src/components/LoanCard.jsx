import { formatCurrency, formatDate, getStatusLabel } from "../utils";

function getProofUrls(proofImages) {
  return Array.isArray(proofImages)
    ? proofImages
        .map((proofImage) => (typeof proofImage === "string" ? proofImage : proofImage?.url || ""))
        .filter(Boolean)
    : [];
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
      <path d="M4 17.25V20h2.75L17.8 8.94l-2.75-2.75L4 17.25zm15.71-9.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-1.79z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
      <path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2h4v2H4V6h4l1-2z" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
      <path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm2 .25v2h14V7a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1Zm14 4H5v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6ZM7 13h4v2H7v-2Z" />
    </svg>
  );
}

function ProofIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
      <path d="M19 5H5a2 2 0 0 0-2 2v10.5A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5V8l-2-3ZM5 7h13.3l.7 1.05V17.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V7Zm2 8 2.2-2.7a1 1 0 0 1 1.55 0l1.54 1.89 2.14-2.54a1 1 0 0 1 1.52.02L18 15H7Zm1.75-4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
    </svg>
  );
}

export default function LoanCard({
  loan,
  onOpenPaymentModal,
  onEditPayment,
  onViewPaymentProofs,
  onEdit,
  onDelete,
  isDeleting,
  isExpanded,
  onToggle,
}) {
  const paidAmount = Number(loan.totalPayable) - Number(loan.remainingBalance);
  const progress = loan.totalPayable > 0 ? Math.min((paidAmount / loan.totalPayable) * 100, 100) : 0;

  return (
    <article
      className={`relative overflow-hidden rounded-[28px] border p-6 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${
        isExpanded
          ? "border-cyan-300/70 bg-gradient-to-br from-cyan-50 via-sky-50 to-white shadow-[0_22px_60px_rgba(20,94,129,0.18)]"
          : "border-sky-100 bg-gradient-to-br from-white via-sky-50/80 to-amber-50/40 shadow-glass"
      } rounded-3xl p-4 sm:rounded-[28px] sm:p-6`}
    >
      <div
        className={`pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-gradient-to-br transition ${
          isExpanded ? "from-cyan-200/50 to-transparent" : "from-sky-200/40 to-transparent"
        }`}
      />
      <button
        type="button"
        className="w-full text-left outline-none transition active:scale-[0.995]"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="flex flex-col justify-between gap-3 sm:gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{loan.loanType}</p>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-ink sm:text-xl">{loan.loanName}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold ${
                    loan.status === "paid"
                      ? "bg-blue-50 text-blue-700"
                      : loan.status === "overdue"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {getStatusLabel(loan.status)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              {isExpanded ? (
                <>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slateblue transition hover:-translate-y-0.5 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(loan);
                    }}
                    aria-label={`Edit ${loan.loanName}`}
                    title="Edit loan"
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-wait disabled:opacity-70"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(loan);
                    }}
                    disabled={isDeleting}
                    aria-label={`Delete ${loan.loanName}`}
                    title="Delete loan"
                  >
                    <DeleteIcon />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-3">
          <div>
            <span className="text-sm text-slate-500">Remaining balance</span>
            <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{formatCurrency(loan.remainingBalance)}</strong>
          </div>
          <div>
            <span className="text-sm text-slate-500">Monthly payment</span>
            <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{formatCurrency(loan.monthlyPayment)}</strong>
          </div>
          <div>
            <span className="text-sm text-slate-500">Next billing date</span>
            <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">
              {loan.loanType === "fixed" ? formatDate(loan.nextDueDate) : "Not applicable"}
            </strong>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:mt-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">Paid off</span>
            <span className="text-sm font-semibold text-slate-600">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-amber to-yellow-300 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </button>

      {isExpanded ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-4">
            <div>
              <span className="text-sm text-slate-500">Principal</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{formatCurrency(loan.principal)}</strong>
            </div>
            <div>
              <span className="text-sm text-slate-500">Monthly payment</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{formatCurrency(loan.monthlyPayment)}</strong>
            </div>
            <div>
              <span className="text-sm text-slate-500">Interest cost</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{formatCurrency(loan.interestCost)}</strong>
            </div>
            <div>
              <span className="text-sm text-slate-500">Total payable</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{formatCurrency(loan.totalPayable)}</strong>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4">
            <div>
              <span className="text-sm text-slate-500">Paid so far</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{formatCurrency(paidAmount)}</strong>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 sm:mt-4 sm:gap-4">
            <div>
              <span className="text-sm text-slate-500">Term</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{loan.loanType === "fixed" ? loan.termLabel : "Not applicable"}</strong>
            </div>
            <div>
              <span className="text-sm text-slate-500">First repayment date</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{loan.loanType === "fixed" ? formatDate(loan.firstRepaymentDate) : "Not applicable"}</strong>
            </div>
            <div>
              <span className="text-sm text-slate-500">Next due date</span>
              <strong className="mt-1 block text-base font-semibold text-ink sm:text-lg">{loan.loanType === "fixed" ? formatDate(loan.nextDueDate) : "Not applicable"}</strong>
            </div>
          </div>

          {loan.notes ? <p className="mt-4 text-sm leading-6 text-slate-600">{loan.notes}</p> : null}

          <div className="mt-4 rounded-3xl border border-sky-100 bg-white/80 p-4 shadow-sm sm:mt-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-ink">Payment history</h4>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slateblue text-white transition hover:-translate-y-0.5 hover:bg-[#334e77] focus:outline-none focus:ring-4 focus:ring-slate-200"
                onClick={() => onOpenPaymentModal(loan)}
                aria-label={`Add payment to ${loan.loanName}`}
                title="Add payment"
              >
                <PaymentIcon />
              </button>
            </div>
            {loan.payments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {loan.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-sky-100 bg-sky-50/90 px-4 py-3 transition hover:border-cyan-300 hover:bg-white"
                    onClick={() => onEditPayment(loan, payment)}
                  >
                    <strong className="text-sm font-semibold text-ink sm:text-base">{formatCurrency(payment.amount)}</strong>
                    <span className="text-sm text-slate-500">{formatDate(payment.paymentDate)}</span>
                    <p className="min-w-0 flex-1 text-sm text-slate-600">{payment.note || "Payment logged"}</p>
                    <div className="ml-auto flex items-center gap-2">
                      {getProofUrls(payment.proofImages).length > 0 ? (
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slateblue transition hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-200"
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewPaymentProofs(loan, payment, 0);
                          }}
                          aria-label={`View proof of payment for ${loan.loanName}`}
                          title="View proof of payment"
                        >
                          <ProofIcon />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
