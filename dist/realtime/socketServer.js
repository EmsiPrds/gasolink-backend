"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = initSocketServer;
exports.emitPipelineEvent = emitPipelineEvent;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
let ioInstance = null;
function extractToken(socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim())
        return authToken.trim();
    const header = socket.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
        return header.slice("Bearer ".length).trim();
    }
    return null;
}
function initSocketServer(httpServer) {
    const corsOrigins = env_1.env.CORS_ORIGIN.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const io = new socket_io_1.Server(httpServer, {
        path: "/socket.io",
        cors: {
            origin: corsOrigins,
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });
    io.use((socket, next) => {
        const token = extractToken(socket);
        if (!token)
            return next(new Error("Missing auth token"));
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            socket.data.user = payload;
            return next();
        }
        catch {
            return next(new Error("Invalid or expired token"));
        }
    });
    io.on("connection", (socket) => {
        const role = socket.data.user?.role;
        socket.join("authenticated");
        if (role === "admin")
            socket.join("admin");
        socket.emit("realtime:connected", {
            ok: true,
            at: new Date().toISOString(),
            role,
        });
    });
    ioInstance = io;
    return io;
}
function emitPipelineEvent(event, payload, adminOnly = false) {
    if (!ioInstance)
        return;
    ioInstance.to(adminOnly ? "admin" : "authenticated").emit(event, payload);
}
