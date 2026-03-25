"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const EnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().int().positive().default(5000),
    MONGODB_URI: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(20),
    CORS_ORIGIN: zod_1.z.string().min(1).default("http://localhost:5173"),
    SEED_ADMIN_EMAIL: zod_1.z.string().email().optional(),
    SEED_ADMIN_PASSWORD: zod_1.z.string().min(8).optional(),
    // Queue/Workers
    REDIS_URL: zod_1.z.string().min(1).optional(),
    // Source selection
    SOURCES_MODE: zod_1.z.enum(["all", "doe_only"]).optional().default("all"),
    // Schedules (cron strings)
    SCHEDULE_GLOBAL_FETCH: zod_1.z.string().min(1).optional(),
    SCHEDULE_PH_OFFICIAL: zod_1.z.string().min(1).optional(),
    SCHEDULE_PH_COMPANY: zod_1.z.string().min(1).optional(),
    SCHEDULE_PH_OBSERVED: zod_1.z.string().min(1).optional(),
    SCHEDULE_RECONCILE: zod_1.z.string().min(1).optional(),
    SCHEDULE_DATA_QUALITY: zod_1.z.string().min(1).optional(),
    SCHEDULE_AI_ESTIMATION: zod_1.z.string().min(1).optional(),
    // Groq AI
    GROQ_API_KEY: zod_1.z.string().optional(),
    GROQ_MODEL: zod_1.z.string().default("llama-3.3-70b-versatile"),
    GROQ_FALLBACK_MODEL: zod_1.z.string().default("llama-3.1-8b-instant"),
    // OpenRouter (Alternative)
    OPENROUTER_API_KEY: zod_1.z.string().optional(),
    OPENROUTER_MODEL: zod_1.z.string().default("deepseek/deepseek-chat"),
    // AI Provider selection: "groq", "openrouter", or "openai"
    AI_PROVIDER: zod_1.z.enum(["groq", "openrouter", "openai"]).default("groq"),
    // OpenAI (Alternative)
    OPENAI_API_KEY: zod_1.z.string().optional(),
    OPENAI_MODEL: zod_1.z.string().default("gpt-4o-mini"),
    // Search API (Serper.dev)
    SERPER_API_KEY: zod_1.z.string().optional(),
});
exports.env = EnvSchema.parse(process.env);
