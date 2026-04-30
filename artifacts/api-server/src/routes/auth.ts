import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";

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

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ma'lumotlar noto'g'ri" });
    return;
  }
  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) {
    res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: "Akkaunt bloklangan. Admin bilan bog'laning." });
    return;
  }

  req.session!.userId = user.id;
  req.session!.role = user.role;

  await db.update(usersTable)
    .set({ sessionToken: req.sessionID })
    .where(eq(usersTable.id, user.id));

  res.json({ user: formatUser({ ...user, sessionToken: req.sessionID }) });
});

router.post("/logout", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  await db.update(usersTable)
    .set({ sessionToken: null })
    .where(eq(usersTable.id, userId));
  req.session?.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session!.userId!));
  if (!user) {
    res.status(401).json({ error: "Topilmadi" });
    return;
  }
  res.json(formatUser(user));
});

router.post("/change-password", requireAuth, async (req, res) => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ma'lumotlar noto'g'ri" });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session!.userId!));
  if (!user) {
    res.status(401).json({ error: "Topilmadi" });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Joriy parol noto'g'ri" });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
