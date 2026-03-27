import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

type JwtPayload = {
  sub: string;
  role: string;
  email: string;
  name: string;
};

let ioInstance: Server | null = null;

function extractToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) return authToken.trim();

  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  return null;
}

export function initSocketServer(httpServer: HttpServer): Server {
  const corsOrigins = env.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.user = payload;
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const role = socket.data.user?.role;
    socket.join("authenticated");
    if (role === "admin") socket.join("admin");

    socket.emit("realtime:connected", {
      ok: true,
      at: new Date().toISOString(),
      role,
    });
  });

  ioInstance = io;
  return io;
}

export function emitPipelineEvent(event: string, payload: unknown, adminOnly = false) {
  if (!ioInstance) return;
  ioInstance.to(adminOnly ? "admin" : "authenticated").emit(event, payload);
}

