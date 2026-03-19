"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const apiResponse_1 = require("../utils/apiResponse");
const httpStatus_1 = require("../utils/httpStatus");
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(httpStatus_1.httpStatus.unauthorized).json((0, apiResponse_1.fail)({
                code: "UNAUTHORIZED",
                message: "Not authenticated",
            }));
        }
        if (req.user.role !== role) {
            return res.status(httpStatus_1.httpStatus.forbidden).json((0, apiResponse_1.fail)({
                code: "FORBIDDEN",
                message: "Not allowed",
            }));
        }
        return next();
    };
}
