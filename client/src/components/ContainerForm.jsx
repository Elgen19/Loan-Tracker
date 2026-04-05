import React from "react";

const initialState = {
  name: "",
  description: "",
};

const fieldClassName =
  "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20";
const labelClassName = "grid gap-2 text-sm font-semibold text-slate-700";
const sectionClassName = "rounded-3xl border border-white/70 bg-white/90 p-4 shadow-glass backdrop-blur sm:rounded-[28px] sm:p-6";

export default function ContainerForm({ onSubmit, isSubmitting, onCancel }) {
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
    await onSubmit(formData);
    setFormData(initialState);
  }

  return (
    <section className={sectionClassName}>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">New Container</p>
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">Create a loan container</h2>
      </div>
      <form className="mt-4 grid gap-3 sm:mt-5 sm:gap-4" onSubmit={handleSubmit}>
        <label className={labelClassName}>
          Container name
          <input className={fieldClassName} name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Personal Loans" required />
        </label>
        <label className={labelClassName}>
          Description
          <textarea
            className="min-h-[88px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20 sm:min-h-[96px]"
            name="description"
            rows="3"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional note about this group"
          />
        </label>
        <div className="flex flex-col gap-2 sm:gap-3 md:flex-row">
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-70 md:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Create container"}
          </button>
          <button
            type="button"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-slate-200 disabled:cursor-wait disabled:opacity-70 md:w-auto"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
