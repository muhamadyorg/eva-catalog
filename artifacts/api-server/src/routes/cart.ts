import { Router } from "express";
import { db, cartItemsTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    price: Number(p.price),
    images: (p.images as string[]) ?? [],
    attributes: (p.attributes as { key: string; value: string }[]) ?? [],
  };
}

async function getCartWithProducts(userId: number) {
  const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.userId, userId)).orderBy(cartItemsTable.createdAt);
  const result = [];
  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (product) {
      result.push({ ...item, product: formatProduct(product) });
    }
  }
  return result;
}

router.get("/", requireAuth, async (req, res) => {
  const items = await getCartWithProducts(req.session!.userId!);
  res.json(items);
});

router.post("/", requireAuth, async (req, res) => {
  const { productId, quantity, selectedColor } = req.body;
  if (!productId || !quantity) {
    res.status(400).json({ error: "productId va quantity kerak" });
    return;
  }
  const userId = req.session!.userId!;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, Number(productId)));
  if (!product) {
    res.status(404).json({ error: "Mahsulot topilmadi" });
    return;
  }
  const [existing] = await db.select().from(cartItemsTable).where(
    and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.productId, Number(productId)))
  );
  let item;
  if (existing && existing.selectedColor === (selectedColor ?? null)) {
    [item] = await db.update(cartItemsTable)
      .set({ quantity: existing.quantity + Number(quantity) })
      .where(eq(cartItemsTable.id, existing.id))
      .returning();
  } else {
    [item] = await db.insert(cartItemsTable)
      .values({ userId, productId: Number(productId), quantity: Number(quantity), selectedColor: selectedColor ?? null })
      .returning();
  }
  res.status(201).json({ ...item, product: formatProduct(product) });
});

router.put("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.session!.userId!;
  const { quantity, selectedColor } = req.body;
  const update: Record<string, unknown> = {};
  if (quantity !== undefined) update.quantity = Number(quantity);
  if (selectedColor !== undefined) update.selectedColor = selectedColor;
  const [item] = await db.update(cartItemsTable)
    .set(update)
    .where(and(eq(cartItemsTable.id, id), eq(cartItemsTable.userId, userId)))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Topilmadi" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
  res.json({ ...item, product: product ? formatProduct(product) : null });
});

router.delete("/", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  res.status(204).send();
});

router.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.session!.userId!;
  await db.delete(cartItemsTable).where(and(eq(cartItemsTable.id, id), eq(cartItemsTable.userId, userId)));
  res.status(204).send();
});

export default router;
