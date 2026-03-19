import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { apiRouter } from "./routes";
import { env } from "./config/env";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser clients / same-origin
      if (corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/", (_req, res) => {
  return res.redirect("/api/health");
});

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

