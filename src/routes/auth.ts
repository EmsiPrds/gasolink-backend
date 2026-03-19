import { Router } from "express";
import { login, me } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", requireAuth, me);

