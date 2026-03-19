"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.me = me;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const AdminUser_1 = require("../models/AdminUser");
const apiResponse_1 = require("../utils/apiResponse");
const httpStatus_1 = require("../utils/httpStatus");
const authValidators_1 = require("../validators/authValidators");
async function login(req, res) {
    const body = authValidators_1.LoginBodySchema.parse(req.body);
    const user = await AdminUser_1.AdminUser.findOne({ email: body.email.toLowerCase() }).lean();
    if (!user) {
        return res.status(httpStatus_1.httpStatus.unauthorized).json((0, apiResponse_1.fail)({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
        }));
    }
    const isValid = await bcrypt_1.default.compare(body.password, user.passwordHash);
    if (!isValid) {
        return res.status(httpStatus_1.httpStatus.unauthorized).json((0, apiResponse_1.fail)({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
        }));
    }
    const token = jsonwebtoken_1.default.sign({ sub: String(user._id), role: user.role, email: user.email, name: user.name }, env_1.env.JWT_SECRET, { expiresIn: "12h" });
    return res.json((0, apiResponse_1.ok)({
        token,
        user: {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role,
        },
    }));
}
async function me(req, res) {
    if (!req.user) {
        return res.status(httpStatus_1.httpStatus.unauthorized).json((0, apiResponse_1.fail)({
            code: "UNAUTHORIZED",
            message: "Not authenticated",
        }));
    }
    return res.json((0, apiResponse_1.ok)({ user: req.user }));
}
