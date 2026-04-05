import React from "react";

const initialState = {
  amount: "",
  paymentDate: "",
  note: "",
};

const fieldClassName =
  "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20";

export default function PaymentForm({ loanId, onSubmit, isSubmitting }) {
  const [formData, setFormData] = React.useState(initialState);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit(loanId, {
      ...formData,
      amount: Number(formData.amount),
    });
    setFormData(initialState);
  }

  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Amount
        <input className={fieldClassName} name="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={handleChange} required />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Payment date
        <input className={fieldClassName} name="paymentDate" type="date" value={formData.paymentDate} onChange={handleChange} required />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Note
        <input className={fieldClassName} name="note" value={formData.note} onChange={handleChange} placeholder="Optional" />
      </label>
      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slateblue disabled:cursor-wait disabled:opacity-70 md:col-span-3 md:justify-self-end md:w-auto"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Adding..." : "Add payment"}
      </button>
    </form>
  );
}
