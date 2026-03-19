import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import {
  adminSummary,
  createAlert,
  createCompanyPrice,
  createInsight,
  createPhPrice,
  deleteAlert,
  deleteCompanyPrice,
  deleteInsight,
  deletePhPrice,
  ingestionHealth,
  listAlerts,
  listCompanyPrices,
  listInsights,
  listLogs,
  listNormalizedRecords,
  listPublishedPrices,
  listPhPrices,
  listRawSources,
  refreshGlobalNow,
  triggerCollectors,
  triggerQuality,
  triggerReconcile,
  updateAlert,
  updateCompanyPrice,
  updateInsight,
  updatePhPrice,
} from "../controllers/adminController";
import {
  commitDoePreviewEndpoint,
  getDoeUploadDetails,
  listDoeUploads,
  submitDoeLink,
  uploadDoePdf,
} from "../controllers/adminDoeController";

export const adminRouter = Router();

const upload = multer({ dest: "uploads/" });

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/summary", adminSummary);

adminRouter.get("/ph-prices", listPhPrices);
adminRouter.post("/ph-prices", createPhPrice);
adminRouter.patch("/ph-prices/:id", updatePhPrice);
adminRouter.delete("/ph-prices/:id", deletePhPrice);

adminRouter.get("/company-prices", listCompanyPrices);
adminRouter.post("/company-prices", createCompanyPrice);
adminRouter.patch("/company-prices/:id", updateCompanyPrice);
adminRouter.delete("/company-prices/:id", deleteCompanyPrice);

adminRouter.get("/insights", listInsights);
adminRouter.post("/insights", createInsight);
adminRouter.patch("/insights/:id", updateInsight);
adminRouter.delete("/insights/:id", deleteInsight);

adminRouter.get("/alerts", listAlerts);
adminRouter.post("/alerts", createAlert);
adminRouter.patch("/alerts/:id", updateAlert);
adminRouter.delete("/alerts/:id", deleteAlert);

adminRouter.get("/logs", listLogs);

adminRouter.post("/global/refresh-now", refreshGlobalNow);

// Accuracy pipeline admin endpoints
adminRouter.get("/ingestion/health", ingestionHealth);
adminRouter.get("/ingestion/raw-sources", listRawSources);
adminRouter.get("/ingestion/normalized", listNormalizedRecords);
adminRouter.get("/ingestion/published", listPublishedPrices);
adminRouter.post("/ingestion/collect", triggerCollectors);
adminRouter.post("/ingestion/reconcile", triggerReconcile);
adminRouter.post("/ingestion/quality", triggerQuality);

// DOE manual ingestion (PDF upload / link)
adminRouter.post("/doe/upload", upload.single("pdf"), uploadDoePdf);
adminRouter.post("/doe/link", submitDoeLink);
adminRouter.get("/doe/uploads", listDoeUploads);
adminRouter.get("/doe/uploads/:rawSourceId", getDoeUploadDetails);
adminRouter.post("/doe/preview/:rawSourceId/commit", commitDoePreviewEndpoint);

