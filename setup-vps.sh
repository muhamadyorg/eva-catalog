#!/bin/bash
# VPS Setup Script — eva.muhamadyorg.uz
# Ishlatish: bash setup-vps.sh

set -e
BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
DIR="/www/wwwroot/eva.muhamadyorg.uz"

echo -e "${BLUE}╔══════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Eva Catalog — VPS Setup       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════╝${NC}"

# ── 1. Node.js ──────────────────────────────────────
echo -e "\n${BLUE}[1/7] Node.js versiyasi...${NC}"
NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}XATO: Node.js 18+ kerak! Mavjud: $(node --version 2>/dev/null || echo 'yo'"'"'q')${NC}"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
  echo "  apt-get install -y nodejs"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# ── 2. pnpm ─────────────────────────────────────────
echo -e "\n${BLUE}[2/7] pnpm...${NC}"
if ! command -v pnpm &>/dev/null; then
  echo "pnpm o'rnatilmoqda..."
  npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm $(pnpm --version)${NC}"

# ── 3. .env ─────────────────────────────────────────
echo -e "\n${BLUE}[3/7] .env fayl...${NC}"
cd "$DIR"
if [ ! -f .env ]; then
  echo -e "${RED}XATO: .env fayl topilmadi!${NC}"
  echo ""
  echo "Quyidagi .env faylini yarating: $DIR/.env"
  echo "──────────────────────────────────────────"
  echo "DATABASE_URL=postgresql://eva_user:PAROLINGIZ@localhost:5432/eva_catalog"
  echo "SESSION_SECRET=kamida40belgilikrandomstring12345678901234"
  echo "PORT=3100"
  echo "NODE_ENV=production"
  echo "UPLOADS_DIR=$DIR/uploads"
  echo "──────────────────────────────────────────"
  exit 1
fi
grep -q "DATABASE_URL" .env || { echo -e "${RED}XATO: DATABASE_URL yo'q!${NC}"; exit 1; }
grep -q "UPLOADS_DIR" .env || echo "UPLOADS_DIR=$DIR/uploads" >> .env
echo -e "${GREEN}✓ .env topildi${NC}"
set -a; source .env; set +a

# ── 4. Uploads papkasi ───────────────────────────────
echo -e "\n${BLUE}[4/7] Uploads papkasi...${NC}"
mkdir -p "$DIR/uploads"
chmod 755 "$DIR/uploads"
echo -e "${GREEN}✓ $DIR/uploads${NC}"

# ── 5. Dependency'lar ───────────────────────────────
echo -e "\n${BLUE}[5/7] Dependency'lar o'rnatilmoqda...${NC}"
pnpm install 2>&1 | tail -3
echo -e "${GREEN}✓ Tayyor${NC}"

# ── 6. Build ────────────────────────────────────────
echo -e "\n${BLUE}[6/7] Build...${NC}"
echo "  → API server..."
pnpm --filter @workspace/api-server run build 2>&1 | tail -3
echo -e "${GREEN}  ✓ API server${NC}"
echo "  → Frontend..."
pnpm --filter @workspace/shop-catalog run build 2>&1 | tail -3
echo -e "${GREEN}  ✓ Frontend${NC}"

# ── 7. Database ─────────────────────────────────────
echo -e "\n${BLUE}[7/7] Database jadvallar yaratilmoqda...${NC}"

node --input-type=module << 'MIGRATION'
// pg ni api-server node_modules dan import qilamiz
import { createRequire } from 'module';
const req = createRequire('/www/wwwroot/eva.muhamadyorg.uz/artifacts/api-server/package.json');
const pg = req('pg');
const bcrypt = req('bcrypt');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
console.log('  Baza ulandi ✓');

// role enum
await client.query(`DO $$ BEGIN
  CREATE TYPE role AS ENUM ('admin','manager','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

// session jadvali
await client.query(`
  CREATE TABLE IF NOT EXISTS session (
    sid     VARCHAR NOT NULL PRIMARY KEY,
    sess    JSON NOT NULL,
    expire  TIMESTAMP(6) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
`);

// users
await client.query(`
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          role NOT NULL DEFAULT 'user',
    is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
    session_token TEXT,
    display_name  TEXT,
    location      TEXT,
    phone         TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// catalogs
await client.query(`
  CREATE TABLE IF NOT EXISTS catalogs (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    name_ru    TEXT,
    name_en    TEXT,
    parent_id  INTEGER REFERENCES catalogs(id) ON DELETE CASCADE,
    image_url  TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_public  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// catalog_permissions
await client.query(`
  CREATE TABLE IF NOT EXISTS catalog_permissions (
    id         SERIAL PRIMARY KEY,
    catalog_id INTEGER NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(catalog_id, user_id)
  );
`);

// products
await client.query(`
  CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    product_id  TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    name_ru     TEXT,
    name_en     TEXT,
    price       NUMERIC(12,2) NOT NULL,
    catalog_id  INTEGER NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
    image_url   TEXT,
    images      JSONB NOT NULL DEFAULT '[]',
    attributes  JSONB NOT NULL DEFAULT '[]',
    size_ranges JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// settings
await client.query(`
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// cart_items
await client.query(`
  CREATE TABLE IF NOT EXISTS cart_items (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity       INTEGER NOT NULL DEFAULT 1,
    selected_color TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// orders
await client.query(`
  CREATE TABLE IF NOT EXISTS orders (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    guest_name     TEXT,
    guest_phone    TEXT,
    guest_location TEXT,
    items          JSONB NOT NULL DEFAULT '[]',
    total_price    NUMERIC(12,2),
    status         TEXT NOT NULL DEFAULT 'new',
    notes          TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// conversations
await client.query(`
  CREATE TABLE IF NOT EXISTS conversations (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// chat_messages
await client.query(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    type            TEXT NOT NULL DEFAULT 'text',
    content         TEXT,
    file_url        TEXT,
    file_name       TEXT,
    file_size       INTEGER,
    duration        INTEGER,
    is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// Admin foydalanuvchi
const { rows } = await client.query("SELECT id FROM users WHERE username='admin'");
if (rows.length === 0) {
  const hash = await bcrypt.hash('admin123', 10);
  await client.query(
    "INSERT INTO users (username, password_hash, display_name, role) VALUES ('admin',$1,'Administrator','admin')",
    [hash]
  );
  console.log('  Admin yaratildi: admin / admin123');
} else {
  console.log('  Admin allaqachon mavjud');
}

await client.end();
console.log('  ✓ Baza tayyor');
MIGRATION

# ── PM2 ─────────────────────────────────────────────
echo -e "\n${BLUE}PM2 ishga tushirilmoqda...${NC}"
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi
pm2 delete eva-api 2>/dev/null || true
pm2 start "$DIR/artifacts/api-server/dist/index.mjs" \
  --name "eva-api" \
  --cwd "$DIR"
pm2 save
pm2 startup 2>/dev/null | tail -1 || true
echo -e "${GREEN}✓ PM2: eva-api ishlamoqda${NC}"

# ── Test ─────────────────────────────────────────────
echo -e "\n${BLUE}API tekshirilmoqda...${NC}"
sleep 2
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/health 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ]; then
  echo -e "${GREEN}✓ API ishlayabti (HTTP 200)${NC}"
else
  echo -e "${YELLOW}API hali ishga tushmagan yoki boshqa port (HTTP $HTTP)${NC}"
  echo "Loglarni ko'rish: pm2 logs eva-api"
fi

# ── Yakuniy ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup muvaffaqiyatli yakunlandi!     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "  Admin login : admin"
echo "  Admin parol : admin123"
echo "  Frontend    : $DIR/artifacts/shop-catalog/dist/"
echo "  Uploads     : $DIR/uploads/"
echo ""
echo -e "${YELLOW}Nginx config uchun DEPLOY.md faylini o'qing!${NC}"
echo ""
echo "Foydali buyruqlar:"
echo "  pm2 logs eva-api       — serverning loglarini ko'rish"
echo "  pm2 restart eva-api    — serverni qayta ishga tushirish"
echo "  pm2 status             — holatni ko'rish"
