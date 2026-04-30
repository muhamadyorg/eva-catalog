import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { logger } from "./logger.js";

interface ExtWebSocket extends WebSocket {
  userId?: number;
  userRole?: string;
}

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: ExtWebSocket, req: IncomingMessage) => {
    logger.info({ ip: req.socket.remoteAddress }, "WebSocket client connected");

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth" && msg.userId) {
          ws.userId = Number(msg.userId);
          ws.userRole = msg.role;
          ws.send(JSON.stringify({ type: "auth_ok" }));
        }
      } catch { /* ignore */ }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    ws.send(JSON.stringify({ type: "connected" }));
  });

  return wss;
}

export function broadcast(data: object) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

export function broadcastToUser(userId: number, data: object) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  (wss.clients as Set<ExtWebSocket>).forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(msg);
    }
  });
}

export function broadcastToManagers(data: object) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  (wss.clients as Set<ExtWebSocket>).forEach((client) => {
    if (client.readyState === WebSocket.OPEN && (client.userRole === "admin" || client.userRole === "manager")) {
      client.send(msg);
    }
  });
}
