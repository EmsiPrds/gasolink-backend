"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyRouter = void 0;
const express_1 = require("express");
const companyController_1 = require("../controllers/companyController");
exports.companyRouter = (0, express_1.Router)();
exports.companyRouter.get("/", companyController_1.getCompanyPrices);
