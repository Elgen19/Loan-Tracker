/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "sans-serif"],
      },
      colors: {
        ink: "#14213d",
        amber: "#fca311",
        slateblue: "#274060",
      },
      boxShadow: {
        glass: "0 20px 60px rgba(20, 33, 61, 0.08)",
      },
      backgroundImage: {
        "page-glow":
          "radial-gradient(circle at top left, rgba(39, 64, 96, 0.08), transparent 35%), linear-gradient(180deg, #f8fafc 0%, #f1f5f9 60%, #e2e8f0 100%)",
      },
    },
  },
  plugins: [],
};
