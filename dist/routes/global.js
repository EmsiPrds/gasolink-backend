"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalRouter = void 0;
const express_1 = require("express");
const globalController_1 = require("../controllers/globalController");
exports.globalRouter = (0, express_1.Router)();
exports.globalRouter.get("/latest", globalController_1.getGlobalLatest);
exports.globalRouter.get("/history", globalController_1.getGlobalHistory);
