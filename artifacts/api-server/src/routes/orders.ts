import { Router } from "express";
import { db, ordersTable, cartItemsTable, productsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireCanManageProducts } from "../middlewares/auth.js";
import { broadcast } from "../lib/ws.js";

const router = Router();

function formatOrder(o: typeof ordersTable.$inferSelect) {
  return {
    ...o,
    totalPrice: o.totalPrice ? Number(o.totalPrice) : null,
    items: (o.items as object[]) ?? [],
  };
}

router.post("/", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const { guestName, guestPhone, notes } = req.body;

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  if (cartItems.length === 0) {
    res.status(400).json({ error: "Savat bo'sh" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  const orderItems = [];
  let total = 0;

  for (const ci of cartItems) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, ci.productId));
    if (!p) continue;
    const price = Number(p.price);
    total += price * ci.quantity;
    orderItems.push({
      productId: p.id,
      productName: p.name,
      productCode: p.productId,
      quantity: ci.quantity,
      selectedColor: ci.selectedColor ?? null,
      price,
      imageUrl: p.imageUrl ?? null,
    });
  }

  const [order] = await db.insert(ordersTable).values({
    userId,
    guestName: guestName || user?.username || null,
    guestPhone: guestPhone || null,
    items: orderItems,
    totalPrice: String(total),
    status: "new",
    notes: notes || null,
  }).returning();

  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));

  const result = formatOrder(order);
  broadcast({ type: "new_order", order: result });
  res.status(201).json(result);
});

router.get("/my", requireAuth, async (req, res) => {
  const userId = req.session!.userId!;
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, userId)).orderBy(ordersTable.createdAt);
  res.json(orders.map(formatOrder).reverse());
});

router.get("/", requireAuth, requireCanManageProducts, async (req, res) => {
  const { status } = req.query;
  let orders;
  if (status && typeof status === "string") {
    orders = await db.select().from(ordersTable).where(eq(ordersTable.status, status)).orderBy(ordersTable.createdAt);
  } else {
    orders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
  }
  res.json(orders.map(formatOrder).reverse());
});

router.put("/:id/status", requireAuth, requireCanManageProducts, async (req, res) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body;
  if (!status) {
    res.status(400).json({ error: "status kerak" });
    return;
  }
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (notes !== undefined) update.notes = notes;
  const [order] = await db.update(ordersTable).set(update).where(eq(ordersTable.id, id)).returning();
  if (!order) {
    res.status(404).json({ error: "Topilmadi" });
    return;
  }
  const result = formatOrder(order);
  broadcast({ type: "order_updated", order: result });
  res.json(result);
});

export default router;
