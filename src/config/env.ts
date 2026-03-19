import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(20),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),

  // Queue/Workers
  REDIS_URL: z.string().min(1).optional(),

  // Schedules (cron strings)
  SCHEDULE_GLOBAL_FETCH: z.string().min(1).optional(),
  SCHEDULE_PH_OFFICIAL: z.string().min(1).optional(),
  SCHEDULE_PH_COMPANY: z.string().min(1).optional(),
  SCHEDULE_PH_OBSERVED: z.string().min(1).optional(),
  SCHEDULE_RECONCILE: z.string().min(1).optional(),
  SCHEDULE_DATA_QUALITY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

