import { z } from "zod";
import {
  AlertLevelValues,
  FuelTypeValues,
  InsightStatusValues,
  PriceStatusValues,
  RegionValues,
  UpdateLogStatusValues,
} from "../models/enums";

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

export const AdminPhPriceBodySchema = z.object({
  fuelType: z.enum(FuelTypeValues),
  price: z.number().finite(),
  weeklyChange: z.number().finite(),
  region: z.enum(RegionValues),
  source: z.string().min(1),
  status: z.enum(PriceStatusValues),
  updatedAt: z.coerce.date().optional(),
});

export const AdminCompanyPriceBodySchema = z.object({
  companyName: z.string().min(1),
  fuelType: z.enum(FuelTypeValues),
  price: z.number().finite(),
  region: z.enum(RegionValues),
  city: z.string().optional(),
  status: z.enum(PriceStatusValues),
  source: z.string().min(1),
  updatedAt: z.coerce.date().optional(),
});

export const AdminInsightBodySchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  category: z.string().min(1),
  status: z.enum(InsightStatusValues).optional(),
});

export const AdminAlertBodySchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  level: z.enum(AlertLevelValues).optional(),
  active: z.boolean().optional(),
});

export const AdminLogsQuerySchema = z.object({
  module: z.string().min(1).optional(),
  status: z.enum(UpdateLogStatusValues).optional(),
});

