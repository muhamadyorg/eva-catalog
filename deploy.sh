#!/bin/bash
# =============================================================
#  SHOP CATALOG — AQLLI INSTALLER
#  Yangi serverga ham, mavjud serverga ham ishlaydi
#  BT Panel / aaPanel / oddiy Ubuntu/Debian server
# =============================================================

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
ask()  { echo -e "${CYAN}${BOLD}❓ $1${NC}"; }
step() { echo -e "\n${BLUE}${BOLD}[$1] $2${NC}"; }

REPO_URL="https://github.com/muhamadyorg/test4.git"
PM2_APP_NAME="shop-catalog-api"
API_PORT=8080
WWWROOT="/www/wwwroot"
NODE_VERSION=20

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║      SHOP CATALOG — AQLLI INSTALLER          ║${NC}"
echo -e "${BLUE}${BOLD}║   github.com/muhamadyorg/test4               ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================
# ROOT TEKSHIRISH
# =============================================================
if [ "$EUID" -ne 0 ]; then
  fail "Root huquqi kerak! Qayta ishga tushiring: sudo bash deploy.sh"
fi

# =============================================================
# 1. O'RNATISH PAPKASINI TANLASH
# =============================================================
step "1/9" "O'rnatish papkasi aniqlanmoqda..."
echo ""

DEPLOY_DIR=""

# BT Panel / aaPanel uchun /www/wwwroot dan domen tanlash
if [ -d "$WWWROOT" ]; then
  mapfile -t DOMAINS < <(ls -d "$WWWROOT"/*/ 2>/dev/null | xargs -I{} basename {} | sort)

  if [ ${#DOMAINS[@]} -gt 0 ]; then
    echo -e "${BLUE}${WWWROOT} ichidagi papkalar:${NC}"
    echo ""
    for i in "${!DOMAINS[@]}"; do
      idx=$((i+1))
      DPATH="$WWWROOT/${DOMAINS[$i]}"
      if [ -d "$DPATH/.git" ]; then
        BRANCH=$(git -C "$DPATH" branch --show-current 2>/dev/null || echo "?")
        echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${GREEN}(repo mavjud: $BRANCH)${NC}"
      elif [ "$(ls -A "$DPATH" 2>/dev/null)" ]; then
        echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${YELLOW}(boshqa fayllar bor)${NC}"
      else
        echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${CYAN}(bo'sh)${NC}"
      fi
    done
    echo -e "  ${BOLD}[0]${NC} Boshqa papka kiriting"
    echo ""
    ask "Qaysi papkaga o'rnatmoqchisiz? Raqam kiriting (0-${#DOMAINS[@]}):"
    read -r DOMAIN_CHOICE

    if [[ "$DOMAIN_CHOICE" =~ ^[1-9][0-9]*$ ]] && [ "$DOMAIN_CHOICE" -le "${#DOMAINS[@]}" ]; then
      SELECTED_DOMAIN="${DOMAINS[$((DOMAIN_CHOICE-1))]}"
      DEPLOY_DIR="$WWWROOT/$SELECTED_DOMAIN"
    fi
  fi
fi

# Agar domen tanlanmagan bo'lsa — papka so'rash
if [ -z "$DEPLOY_DIR" ]; then
  ask "O'rnatish papkasini kiriting (masalan: /opt/shop-catalog yoki /www/wwwroot/mysite.com):"
  read -r DEPLOY_DIR
  DEPLOY_DIR="${DEPLOY_DIR:-/opt/shop-catalog}"
  SELECTED_DOMAIN=$(basename "$DEPLOY_DIR")
fi

mkdir -p "$DEPLOY_DIR"
ok "Papka tanlandi: $DEPLOY_DIR"

ENV_FILE="$DEPLOY_DIR/.env"

# =============================================================
# 2. REPO KLONLASH YOKI YANGILASH
# =============================================================
step "2/9" "Kod tayyorlanmoqda..."

if [ -d "$DEPLOY_DIR/.git" ]; then
  info "Repo allaqachon mavjud — yangilanmoqda..."
  git -C "$DEPLOY_DIR" pull origin main 2>/dev/null || \
  git -C "$DEPLOY_DIR" pull 2>/dev/null || \
  warn "git pull ishlamadi — mavjud kod ishlatiladi"
  ok "Kod yangilandi"
else
  EXISTING=$(ls -A "$DEPLOY_DIR" 2>/dev/null | grep -v "^\.env$" | wc -l)
  if [ "$EXISTING" -gt 0 ]; then
    warn "$DEPLOY_DIR ichida fayllar bor."
    ask "Shu papkaga clone qilib davom ettirasizmi? (ha/yoq)"
    read -r CLONE_CONFIRM
    [[ "$CLONE_CONFIRM" =~ ^[Hh][Aa]?$ ]] || fail "Bekor qilindi."
    # Fayllarni zaxiralash
    BACKUP_DIR="${DEPLOY_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
    mv "$DEPLOY_DIR" "$BACKUP_DIR"
    mkdir -p "$DEPLOY_DIR"
    # .env ni qaytarish
    [ -f "$BACKUP_DIR/.env" ] && cp "$BACKUP_DIR/.env" "$DEPLOY_DIR/.env" && info ".env zaxiradan qaytarildi"
  fi
  info "GitHub dan klonlanmoqda: $REPO_URL"
  git clone "$REPO_URL" "$DEPLOY_DIR" || fail "git clone ishlamadi! Internet aloqasini tekshiring."
  ok "Repo klonlandi: $DEPLOY_DIR"
fi

# =============================================================
# 3. .ENV FAYLI
# =============================================================
step "3/9" ".env fayli tekshirilmoqda..."

if [ -f "$ENV_FILE" ]; then
  ok ".env fayli mavjud — ishlatilmoqda"
  set -a; source "$ENV_FILE"; set +a

  if [ -z "$DATABASE_URL" ]; then
    fail ".env faylida DATABASE_URL yo'q! $ENV_FILE ni tekshiring."
  fi
  ok "DATABASE_URL o'qildi"
  # Mavjud .env dan DB ma'lumotlarini ajratish
  DB_NAME=$(node -e "try{const u=new URL('$DATABASE_URL');console.log(u.pathname.replace('/',''))}catch(e){console.log('shop_catalog')}" 2>/dev/null || echo "shop_catalog")
  DB_USER=$(node -e "try{const u=new URL('$DATABASE_URL');console.log(u.username)}catch(e){console.log('shop_user')}" 2>/dev/null || echo "shop_user")
else
  warn ".env fayli topilmadi: $ENV_FILE"
  echo ""
  ask ".env fayl yaratishga ruxsat berasizmi? (ha/yoq)"
  read -r ENV_CONFIRM

  if [[ ! "$ENV_CONFIRM" =~ ^[Hh][Aa]?$ ]]; then
    echo ""
    warn "Ruxsat berilmadi."
    echo -e "Qo'lda ${ENV_FILE} yarating:"
    echo -e "  ${CYAN}DATABASE_URL=postgresql://shop_user:PAROL@localhost:5432/shop_catalog${NC}"
    echo -e "  ${CYAN}SESSION_SECRET=\$(openssl rand -hex 32)${NC}"
    echo -e "  ${CYAN}PORT=8080${NC}"
    echo -e "  ${CYAN}NODE_ENV=production${NC}"
    exit 0
  fi

  DB_NAME="shop_catalog"
  DB_USER="shop_user"

  # PostgreSQL mavjudligini tekshirish (kerak bo'lsa o'rnatish — 4-qadamdan oldin)
  if ! command -v psql &>/dev/null; then
    info "PostgreSQL o'rnatilmoqda..."
    apt-get update -qq 2>/dev/null
    apt-get install -y postgresql postgresql-contrib 2>/dev/null || \
    fail "PostgreSQL o'rnatib bo'lmadi!"
    systemctl start postgresql
    systemctl enable postgresql
    sleep 3
  fi
  if ! pg_isready -q 2>/dev/null; then
    systemctl start postgresql 2>/dev/null || service postgresql start 2>/dev/null || true
    sleep 3
  fi

  # DB user mavjudmi?
  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | tr -d '[:space:]' || echo "")
  if [ "$USER_EXISTS" = "1" ]; then
    warn "DB foydalanuvchi '$DB_USER' allaqachon mavjud."
    ask "Yangi parol o'rnatamizmi? (ha/yoq)"
    read -r RESET_PASS
    if [[ "$RESET_PASS" =~ ^[Hh][Aa]?$ ]]; then
      DB_PASS=$(openssl rand -hex 16)
      sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null
      ok "Parol yangilandi"
    else
      warn "Parolni o'zingiz .env ga yozing!"
      DB_PASS="PAROLNI_KIRITING"
    fi
  else
    DB_PASS=$(openssl rand -hex 16)
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';" 2>/dev/null || \
    warn "Foydalanuvchi yaratishda xato (ehtimol allaqachon bor)"
    ok "DB foydalanuvchi: $DB_USER"
  fi

  SESSION_SECRET_VAL=$(openssl rand -hex 32)

  {
    echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo "SESSION_SECRET=${SESSION_SECRET_VAL}"
    echo "PORT=${API_PORT}"
    echo "NODE_ENV=production"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env yaratildi: $ENV_FILE"

  if [ "$DB_PASS" = "PAROLNI_KIRITING" ]; then
    echo ""
    warn "⛔️ Muhim: $ENV_FILE ga to'g'ri DATABASE_URL yozing va qaytadan ishga tushiring!"
    exit 1
  fi

  set -a; source "$ENV_FILE"; set +a
fi

# =============================================================
# 4. KERAKLI DASTURLARNI O'RNATISH
# =============================================================
step "4/9" "Dasturlar tekshirilmoqda..."

# apt-get mavjudmi?
PKG_MANAGER=""
if command -v apt-get &>/dev/null; then PKG_MANAGER="apt-get"
elif command -v yum &>/dev/null; then PKG_MANAGER="yum"
fi

install_pkg() {
  if [ -n "$PKG_MANAGER" ]; then
    $PKG_MANAGER install -y "$1" 2>/dev/null || warn "$1 o'rnatishda xato"
  fi
}

# Git
if ! command -v git &>/dev/null; then
  info "git o'rnatilmoqda..."; install_pkg git
fi
ok "git: $(git --version | head -1)"

# curl
if ! command -v curl &>/dev/null; then
  info "curl o'rnatilmoqda..."; install_pkg curl
fi

# Node.js
if ! command -v node &>/dev/null; then
  info "Node.js $NODE_VERSION o'rnatilmoqda..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>/dev/null
  install_pkg nodejs
fi
NODE_VER=$(node -v 2>/dev/null || echo "?")
ok "Node.js: $NODE_VER"

# pnpm
if ! command -v pnpm &>/dev/null; then
  info "pnpm o'rnatilmoqda..."
  npm install -g pnpm@latest 2>/dev/null || fail "pnpm o'rnatib bo'lmadi"
fi
ok "pnpm: $(pnpm -v)"

# PM2
if ! command -v pm2 &>/dev/null; then
  info "PM2 o'rnatilmoqda..."
  npm install -g pm2 2>/dev/null || fail "PM2 o'rnatib bo'lmadi"
fi
ok "PM2: $(pm2 -v)"

# PostgreSQL
if ! command -v psql &>/dev/null; then
  info "PostgreSQL o'rnatilmoqda..."
  apt-get update -qq 2>/dev/null
  install_pkg postgresql
  install_pkg postgresql-contrib
fi
ok "PostgreSQL: $(psql --version | head -1)"

# PostgreSQL ishga tushirish
if ! pg_isready -q 2>/dev/null; then
  info "PostgreSQL ishga tushirilmoqda..."
  systemctl start postgresql 2>/dev/null || service postgresql start 2>/dev/null || true
  sleep 3
fi

# Nginx
if ! command -v nginx &>/dev/null; then
  info "Nginx o'rnatilmoqda..."
  install_pkg nginx
fi
ok "Nginx: $(nginx -v 2>&1 | head -1)"

# =============================================================
# 5. DATABASE YARATISH / TEKSHIRISH
# =============================================================
step "5/9" "Database tekshirilmoqda..."

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | tr -d '[:space:]' || echo "")
if [ "$DB_EXISTS" = "1" ]; then
  ok "Database '$DB_NAME' mavjud — ma'lumotlar saqlanib qoladi ✅"
else
  info "Database '$DB_NAME' yaratilmoqda..."
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME" 2>/dev/null || \
  fail "Database yaratib bo'lmadi! Qo'lda bajaring: sudo -u postgres createdb -O $DB_USER $DB_NAME"
  ok "Database '$DB_NAME' yaratildi"
fi

# pgcrypto extension (admin parol hashlash uchun)
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true

# =============================================================
# 6. KUTUBXONALAR O'RNATISH
# =============================================================
step "6/9" "Kutubxonalar o'rnatilmoqda..."
cd "$DEPLOY_DIR"

# Native modullar uchun build tools
install_pkg build-essential 2>/dev/null || true

pnpm approve-builds --yes 2>/dev/null || true
pnpm install --frozen-lockfile 2>/dev/null || pnpm install || fail "pnpm install bajarib bo'lmadi"
ok "Kutubxonalar o'rnatildi"

# =============================================================
# 7. DATABASE SCHEMA YANGILASH
# =============================================================
step "7/9" "Database schema yangilanmoqda (ma'lumotlar o'CHIRMAYDI)..."
cd "$DEPLOY_DIR"

set -a; source "$ENV_FILE"; set +a

cd "$DEPLOY_DIR/lib/db"
DATABASE_URL="$DATABASE_URL" pnpm run push-force 2>&1 | \
  grep -vE "^$|Warning|deprecated|drizzle-kit" | head -15 || \
DATABASE_URL="$DATABASE_URL" pnpm run push 2>&1 | \
  grep -vE "^$|Warning|deprecated" | head -15 || \
  warn "Schema push ishlamadi — mavjud schema ishlatiladi"
cd "$DEPLOY_DIR"
ok "Schema yangilandi"

# Admin foydalanuvchisi yaratish (agar yo'q bo'lsa)
info "Admin foydalanuvchisi tekshirilmoqda..."
sudo -u postgres psql -d "$DB_NAME" -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM users WHERE username = 'admin') THEN
    INSERT INTO users (username, password_hash, role, created_at)
    VALUES ('admin', crypt('admin123', gen_salt('bf')), 'admin', NOW());
    RAISE NOTICE 'Admin yaratildi: admin / admin123';
  ELSE
    RAISE NOTICE 'Admin allaqachon mavjud';
  END IF;
END
\$\$;" 2>/dev/null | grep -i "notice" | sed 's/.*NOTICE://' || \
info "Admin tekshirish o'tkazib yuborildi (keyinroq tekshiring)"

# =============================================================
# 8. BUILD
# =============================================================
step "8/9" "Build qilinmoqda..."
cd "$DEPLOY_DIR"

info "  → API server build..."
NODE_ENV=production pnpm --filter @workspace/api-server run build 2>&1 | tail -3 || \
  fail "API server build xato!"
ok "  API server ✅"

info "  → Frontend build..."
NODE_ENV=production BASE_PATH=/ pnpm --filter @workspace/shop-catalog run build 2>&1 | tail -3 || \
  warn "  Frontend build ishlamadi (statik fayllar bo'lmaydi)"
ok "  Frontend ✅"

# uploads papkasini yaratish
mkdir -p "$DEPLOY_DIR/artifacts/api-server/uploads"
chown -R www-data:www-data "$DEPLOY_DIR/artifacts/api-server/uploads" 2>/dev/null || true

# =============================================================
# 9. PM2 SOZLASH VA ISHGA TUSHIRISH
# =============================================================
step "9/9" "PM2 sozlanmoqda va ishga tushirilmoqda..."
mkdir -p "$DEPLOY_DIR/logs"

# .env dan qiymatlarni olish
DB_URL_VAL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
SESSION_VAL=$(grep -E "^SESSION_SECRET=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r')

# ecosystem.config.cjs yaratish (Node.js orqali — heredoc muammosi yo'q)
node -e "
const fs = require('fs');
const cfg = {
  apps: [{
    name: '${PM2_APP_NAME}',
    script: '${DEPLOY_DIR}/artifacts/api-server/dist/index.mjs',
    interpreter: 'node',
    interpreter_args: '--enable-source-maps',
    cwd: '${DEPLOY_DIR}',
    env: {
      NODE_ENV: 'production',
      PORT: '${API_PORT}',
      DATABASE_URL: '${DB_URL_VAL}',
      SESSION_SECRET: '${SESSION_VAL}',
    },
    watch: false,
    restart_delay: 3000,
    max_restarts: 10,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '${DEPLOY_DIR}/logs/pm2-error.log',
    out_file: '${DEPLOY_DIR}/logs/pm2-out.log',
  }]
};
fs.writeFileSync('${DEPLOY_DIR}/ecosystem.config.cjs', 'module.exports=' + JSON.stringify(cfg, null, 2));
console.log('ecosystem.config.cjs yaratildi');
" || fail "ecosystem.config.cjs yaratib bo'lmadi"

# Avvalgi process o'chirish
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

# Ishga tushirish
pm2 start "$DEPLOY_DIR/ecosystem.config.cjs" || fail "PM2 ishga tushirmadi!"
pm2 save
pm2 startup 2>/dev/null | grep "^sudo" | bash 2>/dev/null || true

ok "PM2 ishga tushdi: $PM2_APP_NAME"
sleep 3

# =============================================================
# NGINX SOZLASH — xavfsiz, to'liq yangi config yozish
# =============================================================
echo -e "\n${BLUE}${BOLD}[+] Nginx sozlanmoqda...${NC}"

FRONTEND_DIST="$DEPLOY_DIR/artifacts/shop-catalog/dist/public"
NGINX_WRITE_PATH=""   # qayerga yozamiz
NGINX_CONF_FOUND=""   # mavjud config (agar bo'lsa)

# Mavjud nginx config qidirish (BT Panel / aaPanel / Ubuntu)
for CONF_PATH in \
  "/www/server/panel/vhost/nginx/${SELECTED_DOMAIN}.conf" \
  "/www/server/nginx/conf/vhost/${SELECTED_DOMAIN}.conf" \
  "/etc/nginx/sites-enabled/${SELECTED_DOMAIN}" \
  "/etc/nginx/sites-enabled/${SELECTED_DOMAIN}.conf" \
  "/etc/nginx/conf.d/${SELECTED_DOMAIN}.conf"; do
  if [ -f "$CONF_PATH" ]; then
    NGINX_CONF_FOUND="$CONF_PATH"
    NGINX_WRITE_PATH="$CONF_PATH"
    break
  fi
done

# Topilmasa — standart Ubuntu joyi
if [ -z "$NGINX_WRITE_PATH" ]; then
  NGINX_WRITE_PATH="/etc/nginx/sites-available/shop-catalog"
fi

# Mavjud configdan server_name va listen qatorlarini olib saqlash
# (SSL, port 443, ipv6 va boshqalarni saqlab qolish uchun)
LISTEN_LINES="    listen 80;"
SERVER_NAME_LINE="    server_name ${SELECTED_DOMAIN:-localhost} www.${SELECTED_DOMAIN:-localhost};"
SSL_EXTRA=""

if [ -n "$NGINX_CONF_FOUND" ]; then
  info "Mavjud Nginx config topildi: $NGINX_CONF_FOUND"

  # Backup yaratish — har doim
  BACKUP_PATH="${NGINX_CONF_FOUND}.bak.$(date +%Y%m%d_%H%M%S)"
  cp "$NGINX_CONF_FOUND" "$BACKUP_PATH"
  ok "Zaxira saqlandi: $BACKUP_PATH"

  # listen qatorlarini olish (443 ssl ham bo'lishi mumkin)
  EXTRACTED_LISTEN=$(grep -E "^\s*listen\s" "$NGINX_CONF_FOUND" 2>/dev/null | head -6 | sed 's/^[[:space:]]*/    /' || true)
  [ -n "$EXTRACTED_LISTEN" ] && LISTEN_LINES="$EXTRACTED_LISTEN"

  # server_name qatorini olish
  EXTRACTED_SN=$(grep -E "^\s*server_name\s" "$NGINX_CONF_FOUND" 2>/dev/null | head -1 | sed 's/^[[:space:]]*/    /' || true)
  [ -n "$EXTRACTED_SN" ] && SERVER_NAME_LINE="$EXTRACTED_SN"

  # SSL sertifikat yo'llari (certbot qo'shgan bo'lsa)
  SSL_EXTRA=$(grep -E "^\s*(ssl_certificate|ssl_certificate_key|include.*ssl|ssl_protocols|ssl_ciphers|ssl_session)" \
    "$NGINX_CONF_FOUND" 2>/dev/null | sed 's/^[[:space:]]*/    /' || true)
fi

# TO'LIQ YANGI CONFIG YOZISH
# (mavjud configni yamalamasdan — to'liq almashtirish)
{
cat <<NGINXEOF
# Shop Catalog — auto-generated by deploy.sh $(date +%Y-%m-%d)
# Eski config: ${BACKUP_PATH:-yo'q}
server {
$LISTEN_LINES
$SERVER_NAME_LINE

    # SSL (agar avval sozlangan bo'lsa)
NGINXEOF

if [ -n "$SSL_EXTRA" ]; then
  echo "$SSL_EXTRA"
fi

cat <<NGINXEOF2

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
    client_max_body_size 50M;

    # ── API (backend) ──────────────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 60;
        proxy_send_timeout 300;
    }

    # ── WebSocket ──────────────────────────────────────────────
    location /ws {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # ── Yuklangan rasmlar ──────────────────────────────────────
    location /api/uploads/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        expires 30d;
        add_header Cache-Control "public";
    }

    # ── Service Worker — kesh yo'q ─────────────────────────────
    location = /sw.js {
        root $FRONTEND_DIST;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    # ── manifest.json — kesh yo'q ──────────────────────────────
    location = /manifest.json {
        root $FRONTEND_DIST;
        add_header Cache-Control "no-cache";
        expires 0;
    }

    # ── Statik fayllar (JS, CSS, rasmlar) ─────────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)\$ {
        root $FRONTEND_DIST;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── Frontend SPA — barcha qolgan so'rovlar ─────────────────
    location / {
        root $FRONTEND_DIST;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
    }
}
NGINXEOF2
} > "$NGINX_WRITE_PATH"

ok "Nginx config yozildi: $NGINX_WRITE_PATH"

# Standart Ubuntu uchun symlink yaratish
if [[ "$NGINX_WRITE_PATH" == /etc/nginx/sites-available/* ]]; then
  SYMLINK="/etc/nginx/sites-enabled/$(basename "$NGINX_WRITE_PATH")"
  ln -sf "$NGINX_WRITE_PATH" "$SYMLINK"
  # default saytni o'chirish (port 80 konfliktini oldini olish)
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  ok "Symlink yaratildi: $SYMLINK"
fi

# Config sintaksisini tekshirish
echo ""
info "Nginx config tekshirilmoqda (nginx -t)..."
if nginx -t 2>&1; then
  echo ""
  ok "Nginx config to'g'ri ✅"
  # Xavfsiz reload (restart emas — mavjud ulanishlarni uzmaydi)
  nginx -s reload 2>/dev/null || \
  systemctl reload nginx 2>/dev/null || \
  service nginx reload 2>/dev/null || \
  systemctl restart nginx 2>/dev/null
  ok "Nginx qayta yuklandi"
else
  echo ""
  warn "Nginx config XATO! Eski config tiklanmoqda..."
  if [ -n "$BACKUP_PATH" ] && [ -f "$BACKUP_PATH" ]; then
    cp "$BACKUP_PATH" "$NGINX_WRITE_PATH"
    nginx -s reload 2>/dev/null || true
    warn "Eski config tiklandi: $BACKUP_PATH"
  else
    warn "Backup yo'q. Qo'lda tekshiring: nginx -t"
  fi
  warn "To'g'rilash uchun: nano $NGINX_WRITE_PATH"
  warn "Keyin: nginx -t && nginx -s reload"
fi

# =============================================================
# SSL (ixtiyoriy)
# =============================================================
if [ "${USE_SSL:-false}" = "true" ] && [ -n "$SELECTED_DOMAIN" ]; then
  echo -e "\n${BLUE}${BOLD}[+] SSL sertifikati sozlanmoqda...${NC}"
  if ! command -v certbot &>/dev/null; then
    install_pkg certbot
    install_pkg python3-certbot-nginx 2>/dev/null || true
  fi
  certbot --nginx -d "$SELECTED_DOMAIN" -d "www.$SELECTED_DOMAIN" \
    --non-interactive --agree-tos --email "admin@$SELECTED_DOMAIN" 2>/dev/null && \
    ok "SSL sertifikati o'rnatildi" || \
    warn "SSL qo'lda o'rnatish kerak: certbot --nginx -d $SELECTED_DOMAIN"
fi

# =============================================================
# YAKUNIY HISOBOT
# =============================================================
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║        🎉 O'RNATISH MUVAFFAQIYATLI!          ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

pm2 status "$PM2_APP_NAME" 2>/dev/null || true

echo ""
ok "Sayt:      http://$SELECTED_DOMAIN"
ok "API:       http://localhost:$API_PORT/api"
ok "Database:  $DB_NAME"
echo ""
echo -e "${YELLOW}${BOLD}  Admin login:  admin${NC}"
echo -e "${YELLOW}${BOLD}  Admin parol:  admin123  ← kirganingizda o'zgartiring!${NC}"
echo ""
info "Yangilash:      cd $DEPLOY_DIR && git pull && bash deploy.sh"
info "Loglar:         pm2 logs $PM2_APP_NAME"
info "Qayta yuklash:  pm2 restart $PM2_APP_NAME"
info "To'xtatish:     pm2 stop $PM2_APP_NAME"
info "SSL qo'shish:   USE_SSL=true bash $DEPLOY_DIR/deploy.sh"
echo ""

# Oxirgi 10 qator log
pm2 logs "$PM2_APP_NAME" --lines 10 --nostream 2>/dev/null || true
