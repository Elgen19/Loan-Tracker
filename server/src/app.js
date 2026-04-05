import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import authRoutes from "./routes/authRoutes.js";
import { rateLimit } from "./middleware/rateLimit.js";
import containerRoutes from "./routes/containerRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";

dotenv.config();

const app = express();

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin || "*";

  res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return next();
});

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
