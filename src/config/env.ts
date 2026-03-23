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

  // Source selection
  SOURCES_MODE: z.enum(["all", "doe_only"]).optional().default("all"),

  // Schedules (cron strings)
  SCHEDULE_GLOBAL_FETCH: z.string().min(1).optional(),
  SCHEDULE_PH_OFFICIAL: z.string().min(1).optional(),
  SCHEDULE_PH_COMPANY: z.string().min(1).optional(),
  SCHEDULE_PH_OBSERVED: z.string().min(1).optional(),
  SCHEDULE_RECONCILE: z.string().min(1).optional(),
  SCHEDULE_DATA_QUALITY: z.string().min(1).optional(),
  SCHEDULE_AI_ESTIMATION: z.string().min(1).optional(),

  // Groq AI
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_FALLBACK_MODEL: z.string().default("llama-3.1-8b-instant"),

  // OpenRouter (Alternative)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("deepseek/deepseek-chat"),

  // AI Provider selection: "groq", "openrouter", or "openai"
  AI_PROVIDER: z.enum(["groq", "openrouter", "openai"]).default("groq"),

  // OpenAI (Alternative)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // Search API (Serper.dev)
  SERPER_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

