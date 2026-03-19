import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AdminUser } from "../models/AdminUser";
import { ok, fail } from "../utils/apiResponse";
import { httpStatus } from "../utils/httpStatus";
import { LoginBodySchema } from "../validators/authValidators";

export async function login(req: Request, res: Response) {
  const body = LoginBodySchema.parse(req.body);
  const user = await AdminUser.findOne({ email: body.email.toLowerCase() }).lean();
  if (!user) {
    return res.status(httpStatus.unauthorized).json(
      fail({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      }),
    );
  }

  const isValid = await bcrypt.compare(body.password, user.passwordHash);
  if (!isValid) {
    return res.status(httpStatus.unauthorized).json(
      fail({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      }),
    );
  }

  const token = jwt.sign(
    { sub: String(user._id), role: user.role, email: user.email, name: user.name },
    env.JWT_SECRET,
    { expiresIn: "12h" },
  );

  return res.json(
    ok({
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }),
  );
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return res.status(httpStatus.unauthorized).json(
      fail({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      }),
    );
  }
  return res.json(ok({ user: req.user }));
}

