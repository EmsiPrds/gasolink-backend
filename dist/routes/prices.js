"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricesRouter = void 0;
const express_1 = require("express");
const pricesController_1 = require("../controllers/pricesController");
exports.pricesRouter = (0, express_1.Router)();
exports.pricesRouter.post("/report", pricesController_1.reportPrice);
