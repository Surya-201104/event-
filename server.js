import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import cors from "cors";
import helmet from "helmet"; 
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";

connectDB();
const app = express();
app.use(helmet());
const normalizeOrigin = (value) =>
  (() => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    try {
      return new URL(raw).origin.toLowerCase();
    } catch {
      return raw.replace(/\/+$/, "").toLowerCase();
    }
  })();

const configuredOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(normalizeOrigin(origin)))
        return callback(null, true);

      console.warn("Blocked CORS request from origin:", origin);
      const corsError = new Error("Not allowed by CORS");
      corsError.status = 403;
      return callback(corsError);
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} -> ${req.method} ${req.originalUrl}`,
  );
  next();
});

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Event backend is running",
    health: "/api/health",
    events: "/api/events",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/support", supportRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error("Global Error:", err.message);

  res.status(err.status || 500).json({
    message: err.message || "Server Error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
