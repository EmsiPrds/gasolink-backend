"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const jobs_1 = require("./jobs");
async function main() {
    await (0, db_1.connectDb)();
    app_1.app.listen(env_1.env.PORT, () => {
        console.log(`Gasolink API listening on :${env_1.env.PORT}`);
        (0, jobs_1.startJobs)();
    });
}
main().catch((err) => {
    console.error("Fatal startup error", err);
    process.exit(1);
});
