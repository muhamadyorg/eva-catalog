# aaPanel Server Deploy Qo'llanmasi
# Domain: eva.muhamadyorg.uz → /www/wwwroot/eva.muhamadyorg.uz

## Talablar

- Node.js 20+
- pnpm
- PostgreSQL 15+
- PM2
- aaPanel (Nginx)

---

## 1-qadam: Node.js va pnpm o'rnatish

```bash
# Node.js 20 o'rnatish (aaPanel → App Store → Node.js yoki qo'lda)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# pnpm o'rnatish
npm install -g pnpm

# PM2 o'rnatish
npm install -g pm2
```

---

## 2-qadam: Kodni clone qilish

```bash
cd /www/wwwroot
git clone https://github.com/muhamadyorg/eva-catalog.git eva.muhamadyorg.uz
cd eva.muhamadyorg.uz
```

---

## 3-qadam: PostgreSQL bazasini sozlash

aaPanel → Databases → Add database:
- DB Name: `eva_catalog`
- Username: `eva_user`
- Password: o'zingiz belgilang (masalan: `StrongPass123`)

Yoki terminal orqali:
```bash
psql -U root -e "CREATE DATABASE eva_catalog; CREATE USER eva_user WITH PASSWORD 'StrongPass123'; GRANT ALL PRIVILEGES ON DATABASE eva_catalog TO eva_user;"
```

---

## 4-qadam: Environment variables sozlash

```bash
cat > /www/wwwroot/eva.muhamadyorg.uz/.env << 'EOF'
DATABASE_URL=postgresql://eva_user:StrongPass123@localhost:5432/eva_catalog
SESSION_SECRET=o'zingiz_yarating_uzun_random_string_shu_yergaed
PORT=3100
NODE_ENV=production
UPLOADS_DIR=/www/wwwroot/eva.muhamadyorg.uz/uploads
EOF

# Uploads papkasini yarating
mkdir -p /www/wwwroot/eva.muhamadyorg.uz/uploads
```

---

## 5-qadam: Dependency'larni o'rnatish va build qilish

```bash
cd /www/wwwroot/eva.muhamadyorg.uz

# Dependencylarni o'rnatish
pnpm install --frozen-lockfile

# API serverni build qilish
pnpm --filter @workspace/api-server run build

# Frontend (React) ni build qilish
pnpm --filter @workspace/shop-catalog run build
```

---

## 6-qadam: Bazaga migratsiya qilish

```bash
cd /www/wwwroot/eva.muhamadyorg.uz

# .env faylini yuklab, migratsiyani ishga tushirish
export $(cat .env | xargs)

node --input-type=module << 'EOF'
import pg from '/www/wwwroot/eva.muhamadyorg.uz/lib/db/node_modules/pg/lib/index.js';
import { readFileSync } from 'fs';

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const sql = readFileSync('/www/wwwroot/eva.muhamadyorg.uz/lib/db/src/migrate.sql', 'utf8');
await client.query(sql);
await client.end();
console.log('Migration done!');
EOF
```

**Agar migrate.sql bo'lmasa** — Drizzle push usuli:
```bash
cd /www/wwwroot/eva.muhamadyorg.uz
export $(cat .env | xargs)
pnpm --filter @workspace/db run db:push
```

---

## 7-qadam: PM2 bilan API serverni ishga tushirish

```bash
cd /www/wwwroot/eva.muhamadyorg.uz

pm2 start artifacts/api-server/dist/index.mjs \
  --name "eva-api" \
  --env-file /www/wwwroot/eva.muhamadyorg.uz/.env

# Serverda avtomatik ishga tushish
pm2 save
pm2 startup
```

---

## 8-qadam: aaPanel Nginx konfiguratsiyasi

aaPanel → Website → `eva.muhamadyorg.uz` → Config → nginx config'ni quyidagicha o'zgartiring:

```nginx
server {
    listen 80;
    server_name eva.muhamadyorg.uz;

    # Frontend static fayllar
    root /www/wwwroot/eva.muhamadyorg.uz/artifacts/shop-catalog/dist;
    index index.html;

    # Rasmlarni Nginx to'g'ridan xizmat qilsin (tez va ishonchli)
    location /api/uploads/ {
        alias /www/wwwroot/eva.muhamadyorg.uz/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Qolgan API so'rovlarini Node.js serverga yo'naltirish
    location /api/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket (real-time)
    location /ws {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # React SPA — barcha yo'llar index.html ga
    location /shop-catalog/ {
        try_files $uri $uri/ /shop-catalog/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**SSL uchun** aaPanel → Website → SSL → Let's Encrypt → Apply

---

## 9-qadam: Admin parolini sozlash

Birinchi marta ishga tushganda admin foydalanuvchi avtomatik yaratiladi:
- **Login:** `admin`
- **Parol:** `admin123`

**Muhim:** Birinchi kirishdan so'ng parolni o'zgartiring!

---

## Yangilanish (update)

Kodni yangilash kerak bo'lganda:

```bash
cd /www/wwwroot/eva.muhamadyorg.uz
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/shop-catalog run build
pm2 restart eva-api
```

---

## Muammo chiqsa

```bash
# PM2 loglarini ko'rish
pm2 logs eva-api

# Nginx loglarini ko'rish
tail -f /www/wwwlogs/eva.muhamadyorg.uz.error.log

# API serverning ishlayotganini tekshirish
curl http://127.0.0.1:3100/api/health
```
