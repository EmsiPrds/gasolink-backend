"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forecastRouter = void 0;
const express_1 = require("express");
const forecastController_1 = require("../controllers/forecastController");
exports.forecastRouter = (0, express_1.Router)();
exports.forecastRouter.get("/", forecastController_1.getForecast);
