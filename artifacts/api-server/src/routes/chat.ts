import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db, conversationsTable, chatMessagesTable, usersTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth, requireCanManageProducts } from "../middlewares/auth.js";
import { broadcastToUser, broadcastToManagers } from "../lib/ws.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_UPLOADS_DIR = path.join(__dirname, "../../uploads/chat");
fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CHAT_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

function formatMsg(m: typeof chatMessagesTable.$inferSelect) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    type: m.type,
    content: m.isDeleted ? null : m.content,
    fileUrl: m.isDeleted ? null : m.fileUrl ? `/api/chat/files/${path.basename(m.fileUrl)}` : null,
    fileName: m.isDeleted ? null : m.fileName,
    fileSize: m.isDeleted ? null : m.fileSize,
    duration: m.isDeleted ? null : m.duration,
    isEdited: m.isEdited,
    isDeleted: m.isDeleted,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

router.use("/files", (req, res, next) => {
  const filePath = path.join(CHAT_UPLOADS_DIR, path.basename(req.path));
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    next();
  }
});

router.get("/conversations", requireAuth, requireCanManageProducts, async (req, res) => {
  const convs = await db.select({
    id: conversationsTable.id,
    userId: conversationsTable.userId,
    lastMessageAt: conversationsTable.lastMessageAt,
    createdAt: conversationsTable.createdAt,
    username: usersTable.username,
    displayName: usersTable.displayName,
    phone: usersTable.phone,
  })
    .from(conversationsTable)
    .leftJoin(usersTable, eq(conversationsTable.userId, usersTable.id))
    .orderBy(desc(conversationsTable.lastMessageAt));
  res.json(convs);
});

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const convId = Number(req.params.id);
  const userId = req.session!.userId!;
  const role = req.session!.role!;

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) { res.status(404).json({ error: "Topilmadi" }); return; }

  if (role === "user" && conv.userId !== userId) {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }

  const msgs = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, convId))
    .orderBy(chatMessagesTable.createdAt);
  res.json(msgs.map(formatMsg));
});

router.post("/conversations/:id/messages", requireAuth, upload.single("file"), async (req, res) => {
  const convId = Number(req.params.id);
  const userId = req.session!.userId!;
  const role = req.session!.role!;

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) { res.status(404).json({ error: "Topilmadi" }); return; }

  if (role === "user" && conv.userId !== userId) {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }

  const { content, type = "text", duration } = req.body;
  const file = req.file;

  const msgData: Parameters<typeof db.insert>[0] extends never ? never : {
    conversationId: number; senderId: number; type: string;
    content?: string; fileUrl?: string; fileName?: string; fileSize?: number; duration?: number;
  } = { conversationId: convId, senderId: userId, type: type || (file ? "file" : "text") };

  if (content) msgData.content = content;
  if (file) {
    msgData.fileUrl = file.path;
    msgData.fileName = file.originalname;
    msgData.fileSize = file.size;
    if (duration) msgData.duration = Number(duration);
  }

  const [msg] = await db.insert(chatMessagesTable).values(msgData as never).returning();

  await db.update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  const formatted = formatMsg(msg);

  if (role === "user") {
    broadcastToManagers({ type: "chat_message", message: formatted, conversationId: convId });
  } else {
    broadcastToUser(conv.userId, { type: "chat_message", message: formatted, conversationId: convId });
  }

  res.status(201).json(formatted);
});

router.patch("/messages/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.session!.userId!;
  const { content } = req.body;

  const [msg] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, id));
  if (!msg) { res.status(404).json({ error: "Topilmadi" }); return; }
  if (msg.senderId !== userId) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  if (msg.type !== "text") { res.status(400).json({ error: "Faqat matnli xabarlarni tahrirlash mumkin" }); return; }

  const [updated] = await db.update(chatMessagesTable)
    .set({ content, isEdited: true, updatedAt: new Date() })
    .where(eq(chatMessagesTable.id, id))
    .returning();

  const formatted = formatMsg(updated);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, msg.conversationId));
  if (conv) {
    const role = req.session!.role!;
    if (role === "user") {
      broadcastToManagers({ type: "message_edited", message: formatted });
    } else {
      broadcastToUser(conv.userId, { type: "message_edited", message: formatted });
    }
    broadcastToManagers({ type: "message_edited", message: formatted });
  }

  res.json(formatted);
});

router.delete("/messages/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.session!.userId!;
  const role = req.session!.role!;

  const [msg] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, id));
  if (!msg) { res.status(404).json({ error: "Topilmadi" }); return; }

  if (msg.senderId !== userId && role !== "admin") {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }

  const [updated] = await db.update(chatMessagesTable)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(chatMessagesTable.id, id))
    .returning();

  const formatted = formatMsg(updated);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, msg.conversationId));
  if (conv) {
    broadcastToUser(conv.userId, { type: "message_deleted", message: formatted });
    broadcastToManagers({ type: "message_deleted", message: formatted });
  }

  res.json(formatted);
});

router.get("/my", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  let [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.userId, userId));
  if (!conv) {
    [conv] = await db.insert(conversationsTable).values({ userId }).returning();
  }
  res.json(conv);
});

router.post("/my/messages", requireAuth, upload.single("file"), async (req, res) => {
  const userId = req.session!.userId!;

  let [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.userId, userId));
  if (!conv) {
    [conv] = await db.insert(conversationsTable).values({ userId }).returning();
  }

  const { content, type = "text", duration } = req.body;
  const file = req.file;

  const msgData: Record<string, unknown> = {
    conversationId: conv.id,
    senderId: userId,
    type: file ? (req.body.type || "file") : "text",
  };

  if (content) msgData.content = content;
  if (file) {
    msgData.fileUrl = file.path;
    msgData.fileName = file.originalname;
    msgData.fileSize = file.size;
    if (duration) msgData.duration = Number(duration);
  }

  const [msg] = await db.insert(chatMessagesTable).values(msgData as never).returning();

  await db.update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, conv.id));

  const formatted = formatMsg(msg);
  broadcastToManagers({ type: "chat_message", message: formatted, conversationId: conv.id });

  res.status(201).json(formatted);
});

router.get("/my/messages", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;

  let [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.userId, userId));
  if (!conv) {
    [conv] = await db.insert(conversationsTable).values({ userId }).returning();
  }

  const msgs = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, conv.id))
    .orderBy(chatMessagesTable.createdAt);

  res.json({ conversation: conv, messages: msgs.map(formatMsg) });
});

export default router;
