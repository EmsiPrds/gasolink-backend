"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDailySnapshotJob = startDailySnapshotJob;
const node_cron_1 = __importDefault(require("node-cron"));
const MockGlobalPriceProvider_1 = require("../services/providers/MockGlobalPriceProvider");
const globalPriceService_1 = require("../services/globalPriceService");
const provider = new MockGlobalPriceProvider_1.MockGlobalPriceProvider();
function startDailySnapshotJob() {
    // Daily at 03:05 (PH time depends on server; adjust in production via timezone handling)
    node_cron_1.default.schedule("5 3 * * *", async () => {
        await (0, globalPriceService_1.refreshGlobalPrices)(provider, { trigger: "cron" });
    });
}
