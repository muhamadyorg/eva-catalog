# Shop Catalog — Workspace

## Overview

Ierarxik onlayn katalog boshqaruv tizimi. Admin ilovasi va foydalanuvchi ko'rish interfeysi.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Session-based (express-session + bcrypt)
- **Real-time**: WebSocket (ws library)
- **PWA**: manifest.json + service worker

## Features

- Ierarxik kataloglar (cheksiz ichma-ich papkalar)
- Mahsulotlar: product_id, nom, narx, **ko'p rasm** (multi-image gallery), dinamik atributlar, ranglar
- **Til tanlash (UZ/RU/EN)**: header'da til tugmasi; mahsulot/katalog nomlari MyMemory API orqali avtomatik tarjima qilinadi
- **ProductPanel**: Desktop (right panel) + Mobile (bottom sheet) — swipeable image gallery, thumbnails
- **Savat (Cart)**: foydalanuvchi savatga qo'shish, rang/miqdor tanlash, buyurtma berish
- **Buyurtmalar (Orders)**: admin/menejer uchun buyurtma holati boshqaruvi
- **Menejer roli**: mahsulot qo'shish/tahrirlash huquqi (katalog yaratmaydi)
- **Yagona sessiya**: login bo'lganda eski sessiya uzilib, faqat yangi qurilma ishlaydi
- **Foydalanuvchi bloklash**: admin foydalanuvchini bloklashi yoki tizimdan majburiy chiqarishi mumkin
- Admin: katalog/mahsulot yaratish, tahrirlash, o'chirish; bulk delete
- 3 xil ko'rinish hajmi (kichik/o'rta/katta)
- Dark mode default (toggle mavjud)
- Real-time yangilanishlar (WebSocket)
- PWA qo'llab-quvvatlash

## Translation System

- `artifacts/shop-catalog/src/i18n/translations.ts` — UI label translations (uz/ru/en)
- `artifacts/shop-catalog/src/components/lang-provider.tsx` — React context, `useLang()` hook
- `artifacts/api-server/src/lib/translate.ts` — `translateFromUz()` via MyMemory free API
- DB: `catalogs.name_ru`, `catalogs.name_en`, `products.name_ru`, `products.name_en`
- Translation triggered async on create/update — doesn't block the API response

## Default Credentials

- **Admin**: `admin` / `admin123`
- **User**: `user1` / `user123`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Deploy

```bash
# To'liq deploy:
sudo REPO_URL=https://github.com/your-username/repo.git DOMAIN=yourdomain.com bash deploy.sh

# SSL bilan:
sudo REPO_URL=... DOMAIN=... USE_SSL=true bash deploy.sh
```

## Artifacts

- `artifacts/shop-catalog` — React frontend (previewPath: `/`)
- `artifacts/api-server` — Express API + WebSocket (previewPath: `/api`, `/ws`)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
