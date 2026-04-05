/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        amber: "#fca311",
        slateblue: "#274060",
      },
      boxShadow: {
        glass: "0 20px 60px rgba(20, 33, 61, 0.10)",
      },
      backgroundImage: {
        "page-glow":
          "radial-gradient(circle at top left, rgba(255, 196, 61, 0.35), transparent 28%), linear-gradient(180deg, #fff7e6 0%, #f5f7fb 55%, #edf2f7 100%)",
      },
    },
  },
  plugins: [],
};
