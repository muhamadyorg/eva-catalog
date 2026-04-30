import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireCanManageProducts } from "../middlewares/auth.js";
import { broadcast } from "../lib/ws.js";
import { nanoid } from "nanoid";

const router = Router();

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    price: Number(p.price),
    images: (p.images as string[]) ?? [],
    attributes: (p.attributes as { key: string; value: string }[]) ?? [],
  };
}

router.get("/", requireAuth, async (req, res) => {
  const catalogId = Number(req.query.catalogId);
  if (isNaN(catalogId)) {
    res.status(400).json({ error: "catalogId kerak" });
    return;
  }
  const products = await db.select().from(productsTable).where(eq(productsTable.catalogId, catalogId)).orderBy(productsTable.name);
  res.json(products.map(formatProduct));
});

router.post("/", requireAuth, requireCanManageProducts, async (req, res) => {
  const { name, price, catalogId, imageUrl, images, attributes, productId } = req.body;
  if (!name || !price || !catalogId) {
    res.status(400).json({ error: "name, price, catalogId majburiy" });
    return;
  }
  const pid = productId || nanoid(10).toUpperCase();
  const [product] = await db
    .insert(productsTable)
    .values({
      productId: pid,
      name,
      price: String(price),
      catalogId: Number(catalogId),
      imageUrl: imageUrl ?? null,
      images: (images as string[]) ?? [],
      attributes: (attributes as { key: string; value: string }[]) ?? [],
    })
    .returning();
  const result = formatProduct(product);
  broadcast({ type: "product_created", product: result });
  res.status(201).json(result);
});

router.get("/bulk-delete", requireAuth, requireCanManageProducts, async (_req, res) => {
  res.status(405).json({ error: "POST ishlating" });
});

router.post("/bulk-delete", requireAuth, requireCanManageProducts, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids kerak" });
    return;
  }
  await db.delete(productsTable).where(inArray(productsTable.id, ids));
  broadcast({ type: "products_bulk_deleted", ids });
  res.status(204).send();
});

router.post("/bulk-move", requireAuth, requireCanManageProducts, async (req, res) => {
  const { ids, newCatalogId } = req.body;
  if (!Array.isArray(ids) || !newCatalogId) {
    res.status(400).json({ error: "ids va newCatalogId kerak" });
    return;
  }
  await db.update(productsTable).set({ catalogId: Number(newCatalogId) }).where(inArray(productsTable.id, ids));
  broadcast({ type: "products_bulk_moved", ids, newCatalogId });
  res.status(204).send();
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "Topilmadi" });
    return;
  }
  res.json(formatProduct(product));
});

router.put("/:id", requireAuth, requireCanManageProducts, async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, imageUrl, images, attributes, productId } = req.body;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) update.name = name;
  if (price !== undefined) update.price = String(price);
  if (imageUrl !== undefined) update.imageUrl = imageUrl;
  if (images !== undefined) update.images = images;
  if (attributes !== undefined) update.attributes = attributes;
  if (productId !== undefined) update.productId = productId;
  const [product] = await db.update(productsTable).set(update).where(eq(productsTable.id, id)).returning();
  if (!product) {
    res.status(404).json({ error: "Topilmadi" });
    return;
  }
  const result = formatProduct(product);
  broadcast({ type: "product_updated", product: result });
  res.json(result);
});

router.delete("/:id", requireAuth, requireCanManageProducts, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  broadcast({ type: "product_deleted", id });
  res.status(204).send();
});

router.post("/:id/move", requireAuth, requireCanManageProducts, async (req, res) => {
  const id = Number(req.params.id);
  const { newCatalogId } = req.body;
  if (!newCatalogId) {
    res.status(400).json({ error: "newCatalogId kerak" });
    return;
  }
  const [product] = await db
    .update(productsTable)
    .set({ catalogId: Number(newCatalogId), updatedAt: new Date() })
    .where(eq(productsTable.id, id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Topilmadi" });
    return;
  }
  const result = formatProduct(product);
  broadcast({ type: "product_moved", product: result });
  res.json(result);
});

export default router;
