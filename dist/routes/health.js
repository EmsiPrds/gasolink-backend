"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const apiResponse_1 = require("../utils/apiResponse");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get("/", (_req, res) => {
    return res.json((0, apiResponse_1.ok)({ status: "ok" }));
});
