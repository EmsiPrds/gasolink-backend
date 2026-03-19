"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const apiResponse_1 = require("../utils/apiResponse");
const httpStatus_1 = require("../utils/httpStatus");
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(httpStatus_1.httpStatus.unauthorized).json((0, apiResponse_1.fail)({
            code: "UNAUTHORIZED",
            message: "Missing auth token",
        }));
    }
    const token = header.slice("Bearer ".length).trim();
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.user = payload;
        return next();
    }
    catch {
        return res.status(httpStatus_1.httpStatus.unauthorized).json((0, apiResponse_1.fail)({
            code: "UNAUTHORIZED",
            message: "Invalid or expired token",
        }));
    }
}
