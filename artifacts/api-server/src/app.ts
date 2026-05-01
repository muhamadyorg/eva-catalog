import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import catalogsRouter from "./routes/catalogs.js";
import productsRouter from "./routes/products.js";
import usersRouter from "./routes/users.js";
import attributesRouter from "./routes/attributes.js";
import uploadsRouter, { UPLOADS_DIR } from "./routes/uploads.js";
import backupRouter from "./routes/backup.js";
import cartRouter from "./routes/cart.js";
import ordersRouter from "./routes/orders.js";
import chatRouter from "./routes/chat.js";
import { checkSession } from "./middlewares/auth.js";
import { logger } from "./lib/logger.js";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: "admin" | "manager" | "user";
  }
}

const app: Express = express();

// Nginx reverse proxy orqasida ishlash uchun
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : true;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "shop-catalog-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "true",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(checkSession);

app.use("/api", router);
app.use("/api/auth", authRouter);
app.use("/api/catalogs", catalogsRouter);
app.use("/api/products", productsRouter);
app.use("/api/users", usersRouter);
app.use("/api/attributes", attributesRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/uploads", express.static(UPLOADS_DIR));
app.use("/api/backup", backupRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/chat", chatRouter);

export default app;
