"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const apiResponse_1 = require("../utils/apiResponse");
const httpStatus_1 = require("../utils/httpStatus");
function errorHandler(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(httpStatus_1.httpStatus.badRequest).json((0, apiResponse_1.fail)({
            code: "VALIDATION_ERROR",
            message: "Invalid request",
            details: err.flatten(),
        }));
    }
    const message = err instanceof Error ? err.message : "Unexpected error";
    return res.status(httpStatus_1.httpStatus.internalServerError).json((0, apiResponse_1.fail)({
        code: "INTERNAL_ERROR",
        message,
    }));
}
