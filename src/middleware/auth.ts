import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { fail } from "../utils/apiResponse";
import { httpStatus } from "../utils/httpStatus";

type JwtPayload = {
  sub: string;
  role: string;
  email: string;
  name: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(httpStatus.unauthorized).json(
      fail({
        code: "UNAUTHORIZED",
        message: "Missing auth token",
      }),
    );
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    return next();
  } catch {
    return res.status(httpStatus.unauthorized).json(
      fail({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      }),
    );
  }
}

