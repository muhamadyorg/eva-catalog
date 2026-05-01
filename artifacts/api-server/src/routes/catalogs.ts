import { Router } from "express";
import { db, catalogsTable, productsTable, usersTable, catalogPermissionsTable } from "@workspace/db";
import { eq, isNull, count, and, inArray } from "drizzle-orm";
import { CreateCatalogBody, UpdateCatalogBody, MoveCatalogBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { broadcast } from "../lib/ws.js";
import { translateFromUz } from "../lib/translate.js";

const router = Router();

async function catalogWithCounts(id: number) {
  const [cat] = await db.select().from(catalogsTable).where(eq(catalogsTable.id, id));
  if (!cat) return null;
  const [{ childCount }] = await db
    .select({ childCount: count() })
    .from(catalogsTable)
    .where(eq(catalogsTable.parentId, id));
  const [{ productCount }] = await db
    .select({ productCount: count() })
    .from(productsTable)
    .where(eq(productsTable.catalogId, id));
  return { ...cat, childCount: Number(childCount), productCount: Number(productCount) };
}

router.get("/", requireAuth, async (req, res) => {
  const parentId = req.query.parentId !== undefined ? Number(req.query.parentId) : null;
  const sessionRole = req.session?.role as string | undefined;
  const isPrivileged = sessionRole === "admin" || sessionRole === "manager";

  let catalogs;
  if (parentId === null || isNaN(parentId as number)) {
    catalogs = await db.select().from(catalogsTable).where(isNull(catalogsTable.parentId)).orderBy(catalogsTable.sortOrder, catalogsTable.name);
  } else {
    catalogs = await db.select().from(catalogsTable).where(eq(catalogsTable.parentId, parentId as number)).orderBy(catalogsTable.sortOrder, catalogsTable.name);
  }

  // Apply permission filter for root catalogs only (parentId is null)
  let filtered = catalogs;
  if ((parentId === null || isNaN(parentId as number)) && !isPrivileged) {
    const userId = req.session?.userId as number | undefined;
    if (userId) {
      const permissions = await db
        .select({ catalogId: catalogPermissionsTable.catalogId })
        .from(catalogPermissionsTable)
        .where(eq(catalogPermissionsTable.userId, userId));
      const permittedIds = new Set(permissions.map((p) => p.catalogId));
      filtered = catalogs.filter((cat) => cat.isPublic || permittedIds.has(cat.id));
    }
  }

  const withCounts = await Promise.all(
    filtered.map(async (cat) => {
      const [{ childCount }] = await db.select({ childCount: count() }).from(catalogsTable).where(eq(catalogsTable.parentId, cat.id));
      const [{ productCount }] = await db.select({ productCount: count() }).from(productsTable).where(eq(productsTable.catalogId, cat.id));
      return { ...cat, childCount: Number(childCount), productCount: Number(productCount) };
    })
  );
  res.json(withCounts);
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { name, parentId, imageUrl, sortOrder } = parsed.data;
  const [cat] = await db
    .insert(catalogsTable)
    .values({ name, parentId: parentId ?? null, imageUrl: imageUrl ?? null, sortOrder: sortOrder ?? 0 })
    .returning();

  translateFromUz(name).then(({ ru, en }) =>
    db.update(catalogsTable).set({ nameRu: ru, nameEn: en }).where(eq(catalogsTable.id, cat.id))
      .then(() => catalogWithCounts(cat.id).then(updated => updated && broadcast({ type: "catalog_updated", catalog: updated })))
  ).catch(() => {});

  const result = await catalogWithCounts(cat.id);
  broadcast({ type: "catalog_created", catalog: result });
  res.status(201).json(result);
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const result = await catalogWithCounts(id);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.imageUrl !== undefined) update.imageUrl = parsed.data.imageUrl;
  if (parsed.data.sortOrder !== undefined) update.sortOrder = parsed.data.sortOrder;
  if (parsed.data.isPublic !== undefined) update.isPublic = parsed.data.isPublic;
  await db.update(catalogsTable).set(update).where(eq(catalogsTable.id, id));

  if (parsed.data.name !== undefined) {
    translateFromUz(parsed.data.name).then(({ ru, en }) =>
      db.update(catalogsTable).set({ nameRu: ru, nameEn: en }).where(eq(catalogsTable.id, id))
        .then(() => catalogWithCounts(id).then(updated => updated && broadcast({ type: "catalog_updated", catalog: updated })))
    ).catch(() => {});
  }

  const result = await catalogWithCounts(id);
  broadcast({ type: "catalog_updated", catalog: result });
  res.json(result);
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(catalogsTable).where(eq(catalogsTable.id, id));
  broadcast({ type: "catalog_deleted", id });
  res.status(204).send();
});

router.post("/:id/move", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = MoveCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const newParentId = (parsed.data as { newParentId?: number | null }).newParentId ?? null;
  await db.update(catalogsTable).set({ parentId: newParentId }).where(eq(catalogsTable.id, id));
  const result = await catalogWithCounts(id);
  broadcast({ type: "catalog_moved", catalog: result });
  res.json(result);
});

router.get("/:id/breadcrumb", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const breadcrumb: { id: number; name: string; nameRu: string | null; nameEn: string | null }[] = [];
  let currentId: number | null = id;
  while (currentId !== null) {
    const [cat] = await db.select().from(catalogsTable).where(eq(catalogsTable.id, currentId));
    if (!cat) break;
    breadcrumb.unshift({ id: cat.id, name: cat.name, nameRu: cat.nameRu ?? null, nameEn: cat.nameEn ?? null });
    currentId = cat.parentId ?? null;
  }
  res.json(breadcrumb);
});

// Permissions management (admin only)
router.get("/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  const catalogId = Number(req.params.id);

  // Get all non-admin/manager users
  const allUsers = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(eq(usersTable.isBlocked, false));

  // Get existing permissions for this catalog
  const existingPermissions = await db
    .select({ userId: catalogPermissionsTable.userId })
    .from(catalogPermissionsTable)
    .where(eq(catalogPermissionsTable.catalogId, catalogId));
  const permittedUserIds = new Set(existingPermissions.map((p) => p.userId));

  const result = allUsers
    .filter((u) => u.role === "user")
    .map((u) => ({
      userId: u.id,
      username: u.username,
      displayName: u.displayName ?? null,
      role: u.role,
      hasAccess: permittedUserIds.has(u.id),
    }));

  res.json(result);
});

router.put("/:id/permissions/:userId", requireAuth, requireAdmin, async (req, res) => {
  const catalogId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const { hasAccess } = req.body as { hasAccess: boolean };

  if (hasAccess) {
    await db
      .insert(catalogPermissionsTable)
      .values({ catalogId, userId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(catalogPermissionsTable)
      .where(and(eq(catalogPermissionsTable.catalogId, catalogId), eq(catalogPermissionsTable.userId, userId)));
  }

  res.json({ ok: true });
});

export default router;
