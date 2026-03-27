"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const jobs_1 = require("./jobs");
const http_1 = require("http");
const socketServer_1 = require("./realtime/socketServer");
async function main() {
    await (0, db_1.connectDb)();
    const httpServer = (0, http_1.createServer)(app_1.app);
    (0, socketServer_1.initSocketServer)(httpServer);
    httpServer.listen(env_1.env.PORT, () => {
        const baseUrl = env_1.env.NODE_ENV === "production"
            ? `https://api.gasolink.app:${env_1.env.PORT}`
            : `http://localhost:${env_1.env.PORT}`;
        console.log("");
        console.log("🚀 Gasolink API development server");
        console.log("----------------------------------");
        console.log(`Environment: ${env_1.env.NODE_ENV}`);
        console.log(`Port:       ${env_1.env.PORT}`);
        console.log(`Base URL:   ${baseUrl}`);
        console.log(`Socket.IO:  ${baseUrl}/socket.io`);
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
