import type { Request, Response } from "express";
import { ok } from "../utils/apiResponse";
import { httpStatus } from "../utils/httpStatus";
import {
  buildDoePreviewFromRaw,
  commitDoePreview,
  createDoeRawFromLink,
  createDoeRawFromUpload,
} from "../services/doeAdminIngestionService";
import { RawScrapedSource } from "../models/RawScrapedSource";

export async function uploadDoePdf(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(httpStatus.badRequest).json({ ok: false, error: "Missing DOE file upload" });
  }

  const note = typeof req.body?.note === "string" ? req.body.note : undefined;

  try {
    console.log("[admin_doe] uploadDoePdf start", {
      adminId: req.user?.sub,
      originalFilename: file.originalname,
      path: file.path,
    });

    const preview = await createDoeRawFromUpload({
      adminId: req.user?.sub ?? "unknown",
      localPath: file.path,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      note,
    });

    console.log("[admin_doe] uploadDoePdf success", {
      rawSourceId: preview.rawSourceId,
      rows: preview.rows.length,
    });

    return res.status(httpStatus.created).json(ok(preview));
  } catch (err) {
    console.error("[admin_doe] uploadDoePdf error", err);
    const message = err instanceof Error ? err.message : String(err);
    return res
      .status(httpStatus.internalServerError)
      .json({ ok: false, error: `Failed to process DOE upload: ${message}` });
  }
}

export async function submitDoeLink(req: Request, res: Response) {
  const url = String(req.body?.url ?? "").trim();
  const note = typeof req.body?.note === "string" ? req.body.note : undefined;
  if (!url) {
    return res.status(httpStatus.badRequest).json({ ok: false, error: "Missing DOE URL" });
  }

  try {
    console.log("[admin_doe] submitDoeLink start", { adminId: req.user?.sub, url });

    const preview = await createDoeRawFromLink({
      adminId: req.user?.sub ?? "unknown",
      url,
      note,
    });

    console.log("[admin_doe] submitDoeLink success", {
      rawSourceId: preview.rawSourceId,
      rows: preview.rows.length,
    });

    return res.status(httpStatus.created).json(ok(preview));
  } catch (err) {
    console.error("[admin_doe] submitDoeLink error", err);
    const message = err instanceof Error ? err.message : String(err);
    return res
      .status(httpStatus.internalServerError)
      .json({ ok: false, error: `Failed to process DOE link: ${message}` });
  }
}

export async function previewDoeRaw(req: Request, res: Response) {
  const rawSourceId = String(req.params.rawSourceId);
  try {
    console.log("[admin_doe] previewDoeRaw", { rawSourceId });
    const preview = await buildDoePreviewFromRaw(rawSourceId);
    return res.json(ok(preview));
  } catch (err) {
    console.error("[admin_doe] previewDoeRaw error", err);
    const message = err instanceof Error ? err.message : String(err);
    return res
      .status(httpStatus.internalServerError)
      .json({ ok: false, error: `Failed to build DOE preview: ${message}` });
  }
}

export async function commitDoePreviewEndpoint(req: Request, res: Response) {
  const rawSourceId = String(req.params.rawSourceId);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  try {
    console.log("[admin_doe] commitDoePreview start", { rawSourceId, rows: rows.length });
    const result = await commitDoePreview({ rawSourceId, rows });
    console.log("[admin_doe] commitDoePreview success", result);
    return res.json(ok(result));
  } catch (err) {
    console.error("[admin_doe] commitDoePreview error", err);
    const message = err instanceof Error ? err.message : String(err);
    return res
      .status(httpStatus.internalServerError)
      .json({ ok: false, error: `Failed to commit DOE preview: ${message}` });
  }
}

export async function listDoeUploads(_req: Request, res: Response) {
  const items = await RawScrapedSource.find({
    isManualAdminSource: true,
    sourceName: "DOE",
  })
    .sort({ scrapedAt: -1 })
    .limit(200)
    .lean();

  return res.json(ok({ items }));
}

export async function getDoeUploadDetails(req: Request, res: Response) {
  const rawSourceId = String(req.params.rawSourceId);
  const item = await RawScrapedSource.findById(rawSourceId).lean();
  if (!item) {
    return res.status(httpStatus.notFound).json({ ok: false, error: "DOE upload not found" });
  }
  const preview = await buildDoePreviewFromRaw(rawSourceId).catch(() => null);
  return res.json(ok({ item, preview }));
}

