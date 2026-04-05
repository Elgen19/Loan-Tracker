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
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors({ origin: true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, maxRequests: 180 }));

app.get(["/health", "/api/health"], (req, res) => {
  res.json({ status: "ok" });
});

app.use(["/auth", "/api/auth"], authRoutes);
app.use(["/containers", "/api/containers"], containerRoutes);
app.use(["/loans", "/api/loans"], loanRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    message: error.message || "Something went wrong.",
  });
});

export default app;
