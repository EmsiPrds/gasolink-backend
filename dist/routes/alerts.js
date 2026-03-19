"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertsRouter = void 0;
const express_1 = require("express");
const alertsController_1 = require("../controllers/alertsController");
exports.alertsRouter = (0, express_1.Router)();
exports.alertsRouter.get("/", alertsController_1.getAlerts);
