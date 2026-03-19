import { Router } from "express";
import { ok } from "../utils/apiResponse";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  return res.json(ok({ status: "ok" }));
});

