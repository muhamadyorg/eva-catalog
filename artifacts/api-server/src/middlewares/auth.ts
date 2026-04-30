import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Tizimga kiring" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId || req.session?.role !== "admin") {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }
  next();
}

export function requireCanManageProducts(req: Request, res: Response, next: NextFunction) {
  const role = req.session?.role;
  if (!req.session?.userId || (role !== "admin" && role !== "manager")) {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }
  next();
}

export async function checkSession(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    next();
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Foydalanuvchi topilmadi" });
      return;
    }
    if (user.isBlocked) {
      req.session.destroy(() => {});
      res.status(403).json({ error: "Akkaunt bloklangan. Admin bilan bog'laning." });
      return;
    }
    if (user.sessionToken && user.sessionToken !== req.sessionID) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Sessiya boshqa qurilmada ochilgan. Qayta kiring." });
      return;
    }
  } catch {
    next();
    return;
  }
  next();
}
