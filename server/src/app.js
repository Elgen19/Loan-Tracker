import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import authRoutes from "./routes/authRoutes.js";
import { rateLimit } from "./middleware/rateLimit.js";
import containerRoutes from "./routes/containerRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json());
app.use("/api", rateLimit({ windowMs: 60_000, maxRequests: 180 }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/containers", containerRoutes);
app.use("/api/loans", loanRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    message: error.message || "Something went wrong.",
  });
});

export default app;
