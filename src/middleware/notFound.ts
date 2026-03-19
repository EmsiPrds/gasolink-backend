import { Request, Response } from "express";
import { fail } from "../utils/apiResponse";
import { httpStatus } from "../utils/httpStatus";

export function notFound(_req: Request, res: Response) {
  return res.status(httpStatus.notFound).json(
    fail({
      code: "NOT_FOUND",
      message: "Route not found",
    }),
  );
}

