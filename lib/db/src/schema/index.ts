import {
  pgTable, serial, text, integer, numeric, timestamp,
  pgEnum, jsonb, boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["admin", "manager", "user"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("user"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  sessionToken: text("session_token"),
  displayName: text("display_name"),
  location: text("location"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const catalogsTable = pgTable("catalogs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameRu: text("name_ru"),
  nameEn: text("name_en"),
  parentId: integer("parent_id"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const catalogPermissionsTable = pgTable("catalog_permissions", {
  id: serial("id").primaryKey(),
  catalogId: integer("catalog_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  name: text("name").notNull(),
  nameRu: text("name_ru"),
  nameEn: text("name_en"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  catalogId: integer("catalog_id").notNull(),
  imageUrl: text("image_url"),
  images: jsonb("images").notNull().default([]),
  attributes: jsonb("attributes").notNull().default([]),
  sizeRanges: jsonb("size_ranges").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  selectedColor: text("selected_color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  guestName: text("guest_name"),
  guestPhone: text("guest_phone"),
  guestLocation: text("guest_location"),
  items: jsonb("items").notNull().default([]),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  type: text("type").notNull().default("text"),
  content: text("content"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  duration: integer("duration"),
  isEdited: boolean("is_edited").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertCatalogSchema = createInsertSchema(catalogsTable).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCartItemSchema = createInsertSchema(cartItemsTable).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type InsertCatalog = z.infer<typeof insertCatalogSchema>;
export type Catalog = typeof catalogsTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type CartItem = typeof cartItemsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type CatalogPermission = typeof catalogPermissionsTable.$inferSelect;
