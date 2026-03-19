"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const jobs_1 = require("./jobs");
async function main() {
    await (0, db_1.connectDb)();
    app_1.app.listen(env_1.env.PORT, () => {
        const baseUrl = env_1.env.NODE_ENV === "production"
            ? `https://api.gasolink.app:${env_1.env.PORT}`
            : `http://localhost:${env_1.env.PORT}`;
        console.log("");
        console.log("🚀 Gasolink API development server");
        console.log("----------------------------------");
        console.log(`Environment: ${env_1.env.NODE_ENV}`);
        console.log(`Port:       ${env_1.env.PORT}`);
        console.log(`Base URL:   ${baseUrl}`);
        console.log("");
        console.log("HTTP request logs (morgan) will appear below.");
        console.log("");
        (0, jobs_1.startJobs)();
    });
}
main().catch((err) => {
    console.error("Fatal startup error", err);
    process.exit(1);
});
