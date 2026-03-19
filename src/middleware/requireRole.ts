import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/apiResponse";
import { httpStatus } from "../utils/httpStatus";

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(httpStatus.unauthorized).json(
        fail({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        }),
      );
    }
    if (req.user.role !== role) {
      return res.status(httpStatus.forbidden).json(
        fail({
          code: "FORBIDDEN",
          message: "Not allowed",
        }),
      );
    }
    return next();
  };
}

