"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
const apiResponse_1 = require("../utils/apiResponse");
const httpStatus_1 = require("../utils/httpStatus");
function notFound(_req, res) {
    return res.status(httpStatus_1.httpStatus.notFound).json((0, apiResponse_1.fail)({
        code: "NOT_FOUND",
        message: "Route not found",
    }));
}
