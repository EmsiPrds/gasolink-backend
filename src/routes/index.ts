import { Router } from "express";
import { healthRouter } from "./health";
import { globalRouter } from "./global";
import { phRouter } from "./ph";
import { companyRouter } from "./company";
import { insightsRouter } from "./insights";
import { alertsRouter } from "./alerts";
import { forecastRouter } from "./forecast";
import { authRouter } from "./auth";
import { adminRouter } from "./admin";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/global", globalRouter);
apiRouter.use("/ph", phRouter);
apiRouter.use("/company", companyRouter);
apiRouter.use("/insights", insightsRouter);
apiRouter.use("/alerts", alertsRouter);
apiRouter.use("/forecast", forecastRouter);
apiRouter.use("/admin", adminRouter);

