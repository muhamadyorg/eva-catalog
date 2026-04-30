import { Router } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    isBlocked: u.isBlocked,
    hasActiveSession: !!u.sessionToken,
    createdAt: u.createdAt,
  };
}

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(formatUser));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    res.status(400).json({ error: "username, password, role majburiy" });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ username, passwordHash: hash, role })
    .returning();
  res.status(201).json(formatUser(user));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { username, password, role } = req.body;
  const update: Record<string, unknown> = {};
  if (username) update.username = username;
  if (password) update.passwordHash = await bcrypt.hash(password, 10);
  if (role) update.role = role;
  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "Topilmadi" });
    return;
  }
  res.json(formatUser(user));
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session!.userId) {
    res.status(400).json({ error: "O'zingizni o'chira olmaysiz" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

router.post("/:id/block", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session!.userId) {
    res.status(400).json({ error: "O'zingizni bloklayolmaysiz" });
    return;
  }
  const { isBlocked } = req.body;
  if (typeof isBlocked !== "boolean") {
    res.status(400).json({ error: "isBlocked boolean bo'lishi kerak" });
    return;
  }
  const update: Record<string, unknown> = { isBlocked };
  if (isBlocked) {
    update.sessionToken = null;
  }
  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "Topilmadi" });
    return;
  }
  res.json(formatUser(user));
});

router.post("/:id/force-logout", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(usersTable).set({ sessionToken: null }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

export default router;
