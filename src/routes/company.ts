import { Router } from "express";
import { getCompanyPrices } from "../controllers/companyController";

export const companyRouter = Router();

companyRouter.get("/", getCompanyPrices);

