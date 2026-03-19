"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insightsRouter = void 0;
const express_1 = require("express");
const insightsController_1 = require("../controllers/insightsController");
exports.insightsRouter = (0, express_1.Router)();
exports.insightsRouter.get("/", insightsController_1.getInsights);
