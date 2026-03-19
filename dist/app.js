"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const routes_1 = require("./routes");
const env_1 = require("./config/env");
const notFound_1 = require("./middleware/notFound");
const errorHandler_1 = require("./middleware/errorHandler");
exports.app = (0, express_1.default)();
exports.app.disable("x-powered-by");
exports.app.use((0, helmet_1.default)());
const corsOrigins = env_1.env.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
exports.app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        if (!origin)
            return cb(null, true); // non-browser clients / same-origin
        if (corsOrigins.includes(origin))
            return cb(null, true);
        return cb(null, false);
    },
    credentials: true,
}));
exports.app.use(express_1.default.json({ limit: "1mb" }));
exports.app.use((0, morgan_1.default)(env_1.env.NODE_ENV === "production" ? "combined" : "dev"));
exports.app.use((0, express_rate_limit_1.default)({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
}));
exports.app.get("/", (_req, res) => {
    return res.redirect("/api/health");
});
exports.app.use("/api", routes_1.apiRouter);
exports.app.use(notFound_1.notFound);
exports.app.use(errorHandler_1.errorHandler);
