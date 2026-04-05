import React from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

const inputClassName =
  "h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20";

export default function AuthScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (submissionError) {
      setError(submissionError.message || "Unable to authenticate.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.22),_transparent_28%),linear-gradient(160deg,_#f8fbff_0%,_#eef6ff_48%,_#fff8ee_100%)] px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[10%] h-48 w-48 rounded-full bg-sky-200/40 blur-3xl sm:h-72 sm:w-72" />
        <div className="absolute bottom-[8%] right-[-10%] h-56 w-56 rounded-full bg-amber-200/40 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute left-1/2 top-1/4 h-24 w-24 -translate-x-1/2 rounded-full border border-white/50 bg-white/20 backdrop-blur-sm sm:h-32 sm:w-32" />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <section className="relative w-full rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-glass backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-sky-100/40 blur-3xl" />
          <div className="relative">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Loan Tracker</p>
            <h1 className="text-3xl font-semibold text-ink">Secure sign in</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use the approved email and password to open the shared loan workspace.</p>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error} If this continues, please contact the administrator.
              </div>
            ) : null}

            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email
                <input className={inputClassName} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Password
                <input
                  className={inputClassName}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Please wait..." : "Sign in"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
