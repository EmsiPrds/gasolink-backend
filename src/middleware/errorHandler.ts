import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { fail } from "../utils/apiResponse";
import { httpStatus } from "../utils/httpStatus";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(httpStatus.badRequest).json(
      fail({
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      }),
    );
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  return res.status(httpStatus.internalServerError).json(
    fail({
      code: "INTERNAL_ERROR",
      message,
    }),
  );
}

