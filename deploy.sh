#!/bin/bash
# =============================================================
#  SHOP CATALOG — AQLLI INSTALLER v2
#  Yangi serverga ham, mavjud serverga ham ishlaydi
#  BT Panel / aaPanel / oddiy Ubuntu/Debian server
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }
fail()  { echo -e "${RED}❌ $1${NC}"; exit 1; }
ask()   { echo -e "${CYAN}${BOLD}❓ $1${NC}"; }
step()  { echo -e "\n${BLUE}${BOLD}[$1] $2${NC}"; }
title() { echo -e "${GREEN}── $1${NC}"; }

REPO_URL="https://github.com/muhamadyorg/test4.git"
PM2_APP_NAME="shop-catalog-api"
API_PORT=4773
WWWROOT="/www/wwwroot"
NODE_VERSION=20
# Vite build uchun PORT majburiy (dev server port, build da ishlatilmaydi)
VITE_BUILD_PORT=3000

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║      SHOP CATALOG — AQLLI INSTALLER v2       ║${NC}"
echo -e "${BLUE}${BOLD}║   github.com/muhamadyorg/test4               ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── ROOT TEKSHIRISH ───────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  fail "Root huquqi kerak! Qayta ishga tushiring: sudo bash deploy.sh"
fi

# ─── set -e ni xavfsiz o'chirish funksiyasi ───────────────────
# Ba'zi buyruqlar xato bersa ham davom etsin uchun
run_safe() { "$@" || true; }

# =============================================================
# 1. O'RNATISH PAPKASINI TANLASH
# =============================================================
step "1/9" "O'rnatish papkasi aniqlanmoqda..."
echo ""

DEPLOY_DIR=""
SELECTED_DOMAIN=""

if [ -d "$WWWROOT" ]; then
  mapfile -t DOMAINS < <(ls -d "$WWWROOT"/*/ 2>/dev/null | xargs -I{} basename {} | sort)

  if [ ${#DOMAINS[@]} -gt 0 ]; then
    echo -e "${BLUE}${WWWROOT} ichidagi papkalar:${NC}"
    echo ""
    for i in "${!DOMAINS[@]}"; do
      idx=$((i+1))
      DPATH="$WWWROOT/${DOMAINS[$i]}"
      if [ -d "$DPATH/.git" ]; then
        BRANCH=$(run_safe git -C "$DPATH" branch --show-current 2>/dev/null || echo "?")
        echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${GREEN}(git: $BRANCH)${NC}"
      elif [ "$(ls -A "$DPATH" 2>/dev/null)" ]; then
        echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${YELLOW}(fayllar bor)${NC}"
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

if [ -z "$DEPLOY_DIR" ]; then
  ask "O'rnatish papkasini kiriting (masalan: /opt/shop-catalog yoki /www/wwwroot/mysite.com):"
  read -r DEPLOY_DIR
  DEPLOY_DIR="${DEPLOY_DIR:-/opt/shop-catalog}"
  SELECTED_DOMAIN=$(basename "$DEPLOY_DIR")
fi

mkdir -p "$DEPLOY_DIR"
ok "Papka: $DEPLOY_DIR"
ENV_FILE="$DEPLOY_DIR/.env"

# =============================================================
# 2. REPO KLONLASH YOKI YANGILASH
# =============================================================
step "2/9" "Kod tayyorlanmoqda..."

if [ -d "$DEPLOY_DIR/.git" ]; then
  info "Allaqachon mavjud — git pull..."
  cd "$DEPLOY_DIR"
  git pull origin main 2>/dev/null || git pull 2>/dev/null || warn "git pull ishlamadi, mavjud kod ishlatiladi"
  ok "Kod yangilandi"
else
  EXISTING=$(ls -A "$DEPLOY_DIR" 2>/dev/null | grep -v "^\.env$" | wc -l)
  if [ "$EXISTING" -gt 0 ]; then
    warn "$DEPLOY_DIR ichida boshqa fayllar bor."
    ask "Shu papkaga clone qilamizmi? (ha/yoq)"
    read -r CLONE_CONFIRM
    if [[ ! "$CLONE_CONFIRM" =~ ^[Hh][Aa]?$ ]]; then
      fail "Bekor qilindi."
    fi
    BACKUP_OLD="${DEPLOY_DIR}_old_$(date +%Y%m%d_%H%M%S)"
    mv "$DEPLOY_DIR" "$BACKUP_OLD"
    mkdir -p "$DEPLOY_DIR"
    [ -f "$BACKUP_OLD/.env" ] && cp "$BACKUP_OLD/.env" "$DEPLOY_DIR/.env" && info ".env zaxiradan qaytarildi"
  fi
  info "Klonlanmoqda: $REPO_URL"
  git clone "$REPO_URL" "$DEPLOY_DIR" || fail "git clone ishlamadi! Internetni tekshiring."
  ok "Repo klonlandi"
fi

cd "$DEPLOY_DIR"

# =============================================================
# 3. .ENV FAYLI
# =============================================================
step "3/9" ".env fayli tekshirilmoqda..."

if [ -f "$ENV_FILE" ]; then
  ok ".env mavjud — ishlatilmoqda"
  set -a; source "$ENV_FILE"; set +a
  [ -z "${DATABASE_URL:-}" ] && fail ".env da DATABASE_URL yo'q! $ENV_FILE ni tekshiring."
  ok "DATABASE_URL o'qildi"
  DB_NAME=$(node -e "try{const u=new URL(process.env.DATABASE_URL);console.log(u.pathname.replace('/','')||'shop_catalog')}catch(e){console.log('shop_catalog')}" 2>/dev/null || echo "shop_catalog")
  DB_USER=$(node -e "try{const u=new URL(process.env.DATABASE_URL);console.log(u.username||'shop_user')}catch(e){console.log('shop_user')}" 2>/dev/null || echo "shop_user")
else
  warn ".env topilmadi: $ENV_FILE"
  echo ""
  ask ".env fayl yaratishga ruxsat berasizmi? (ha/yoq)"
  read -r ENV_CONFIRM
  if [[ ! "$ENV_CONFIRM" =~ ^[Hh][Aa]?$ ]]; then
    echo ""
    warn "Ruxsat berilmadi. Qo'lda yarating:"
    echo -e "  DATABASE_URL=postgresql://shop_user:PAROL@localhost:5432/shop_catalog"
    echo -e "  SESSION_SECRET=\$(openssl rand -hex 32)"
    echo -e "  PORT=$API_PORT"
    echo -e "  NODE_ENV=production"
    exit 0
  fi

  DB_NAME="shop_catalog"
  DB_USER="shop_user"

  # PostgreSQL kerak bo'lsa o'rnatish
  if ! command -v psql &>/dev/null; then
    info "PostgreSQL o'rnatilmoqda..."
    apt-get update -qq && apt-get install -y postgresql postgresql-contrib 2>/dev/null || true
    systemctl start postgresql 2>/dev/null || service postgresql start 2>/dev/null || true
    sleep 3
  fi
  pg_isready -q 2>/dev/null || { systemctl start postgresql 2>/dev/null || true; sleep 3; }

  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | tr -d '[:space:]' || echo "")
  if [ "$USER_EXISTS" = "1" ]; then
    warn "DB user '$DB_USER' allaqachon mavjud."
    ask "Yangi parol o'rnatamizmi? (ha/yoq)"
    read -r RESET_PASS
    if [[ "$RESET_PASS" =~ ^[Hh][Aa]?$ ]]; then
      DB_PASS=$(openssl rand -hex 16)
      sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null
    else
      DB_PASS="PAROLNI_KIRITING"
    fi
  else
    DB_PASS=$(openssl rand -hex 16)
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';" 2>/dev/null || true
  fi

  SESSION_SECRET_VAL=$(openssl rand -hex 32)
  {
    echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo "SESSION_SECRET=${SESSION_SECRET_VAL}"
    echo "PORT=${API_PORT}"
    echo "NODE_ENV=production"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env yaratildi"

  [ "$DB_PASS" = "PAROLNI_KIRITING" ] && { warn "⛔ $ENV_FILE ga DATABASE_URL yozing va qaytadan ishga tushiring!"; exit 1; }
  set -a; source "$ENV_FILE"; set +a
fi

# =============================================================
# 4. DASTURLAR O'RNATISH
# =============================================================
step "4/9" "Dasturlar tekshirilmoqda..."

apt_install() {
  apt-get install -y "$1" 2>/dev/null || yum install -y "$1" 2>/dev/null || true
}

# Git
command -v git &>/dev/null || { info "git..."; apt_install git; }
ok "git: $(git --version | head -1)"

# curl
command -v curl &>/dev/null || apt_install curl

# Node.js
if ! command -v node &>/dev/null; then
  info "Node.js $NODE_VERSION o'rnatilmoqda..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>/dev/null
  apt_install nodejs
fi
ok "Node.js: $(node -v)"

# pnpm
if ! command -v pnpm &>/dev/null; then
  info "pnpm..."; npm install -g pnpm@latest 2>/dev/null || fail "pnpm o'rnatilmadi"
fi
ok "pnpm: $(pnpm -v)"

# PM2
if ! command -v pm2 &>/dev/null; then
  info "PM2..."; npm install -g pm2 2>/dev/null || fail "PM2 o'rnatilmadi"
fi
ok "PM2: $(pm2 -v)"

# PostgreSQL
if ! command -v psql &>/dev/null; then
  info "PostgreSQL o'rnatilmoqda..."
  apt-get update -qq 2>/dev/null
  apt_install postgresql
  apt_install postgresql-contrib
fi
ok "PostgreSQL: $(psql --version | head -1)"

pg_isready -q 2>/dev/null || { systemctl start postgresql 2>/dev/null || service postgresql start 2>/dev/null || true; sleep 3; }

# Nginx
command -v nginx &>/dev/null || { info "Nginx..."; apt_install nginx; }
ok "Nginx: $(nginx -v 2>&1 | head -1)"

# Build tools (bcrypt va boshqa native modullar uchun)
apt_install build-essential 2>/dev/null || true

# =============================================================
# 5. DATABASE
# =============================================================
step "5/9" "Database tekshirilmoqda..."

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | tr -d '[:space:]' || echo "")
if [ "$DB_EXISTS" = "1" ]; then
  ok "Database '$DB_NAME' mavjud ✅ — ma'lumotlar saqlanadi"
else
  info "'$DB_NAME' yaratilmoqda..."
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME" 2>/dev/null || \
  fail "Database yaratilmadi! Qo'lda: sudo -u postgres createdb -O $DB_USER $DB_NAME"
  ok "Database '$DB_NAME' yaratildi"
fi
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true

# =============================================================
# 6. KUTUBXONALAR
# =============================================================
step "6/9" "Kutubxonalar o'rnatilmoqda..."
cd "$DEPLOY_DIR"
pnpm approve-builds --yes 2>/dev/null || true
pnpm install --frozen-lockfile 2>/dev/null || pnpm install || fail "pnpm install bajarib bo'lmadi"
ok "Kutubxonalar tayyor"

# =============================================================
# 7. DATABASE SCHEMA
# =============================================================
step "7/9" "Database schema yangilanmoqda..."
cd "$DEPLOY_DIR"
set -a; source "$ENV_FILE"; set +a

cd "$DEPLOY_DIR/lib/db"
DATABASE_URL="$DATABASE_URL" pnpm run push-force 2>/dev/null || \
DATABASE_URL="$DATABASE_URL" pnpm run push 2>/dev/null || \
warn "Schema push ishlamadi — mavjud schema ishlatiladi"
cd "$DEPLOY_DIR"
ok "Schema yangilandi"

# Admin user yaratish (yo'q bo'lsa)
sudo -u postgres psql -d "$DB_NAME" -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM users WHERE username = 'admin') THEN
    INSERT INTO users (username, password_hash, role, created_at)
    VALUES ('admin', crypt('admin123', gen_salt('bf')), 'admin', NOW());
  END IF;
END \$\$;" 2>/dev/null | grep -i notice || true

# =============================================================
# 8. BUILD
# =============================================================
step "8/9" "Build qilinmoqda..."
cd "$DEPLOY_DIR"
set -a; source "$ENV_FILE"; set +a

# ── API Server ──
info "  → API server build..."
NODE_ENV=production pnpm --filter @workspace/api-server run build 2>&1 | tail -5
API_DIST="$DEPLOY_DIR/artifacts/api-server/dist/index.mjs"
[ -f "$API_DIST" ] || fail "API build muvaffaqiyatsiz! $API_DIST topilmadi."
ok "  API server ✅"

# ── Frontend ──
info "  → Frontend build..."
# PORT va BASE_PATH majburiy — Vite config tekshiradi
PORT=$VITE_BUILD_PORT BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/shop-catalog run build 2>&1 | tail -5

FRONTEND_DIST="$DEPLOY_DIR/artifacts/shop-catalog/dist/public"

# Build natijasini TEKSHIRISH — oq ekran sababini oldini olish
if [ ! -f "$FRONTEND_DIST/index.html" ]; then
  echo ""
  warn "⛔ Frontend build muvaffaqiyatsiz! $FRONTEND_DIST/index.html topilmadi."
  warn "Sabab: Vite build xatosi."
  warn "Qo'lda tekshirish:"
  warn "  cd $DEPLOY_DIR"
  warn "  PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/shop-catalog run build"
  warn ""
  warn "API server baribir ishga tushiriladi."
  warn "Nginx statik fayllar o'rniga API ga to'liq proxy qilinadi."
  FRONTEND_BUILD_OK=false
else
  ok "  Frontend ✅ — $(ls $FRONTEND_DIST/*.html $FRONTEND_DIST/**/*.html 2>/dev/null | wc -l) html fayl"
  FRONTEND_BUILD_OK=true
fi

# uploads papkasi
mkdir -p "$DEPLOY_DIR/artifacts/api-server/uploads"
chown -R www-data:www-data "$DEPLOY_DIR/artifacts/api-server/uploads" 2>/dev/null || true
chown -R www-data:www-data "$DEPLOY_DIR" 2>/dev/null || true

# =============================================================
# 9. PM2 ISHGA TUSHIRISH
# =============================================================
step "9/9" "PM2 sozlanmoqda..."
mkdir -p "$DEPLOY_DIR/logs"

DB_URL_VAL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
SESSION_VAL=$(grep -E "^SESSION_SECRET=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r')

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
    min_uptime: '5s',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '${DEPLOY_DIR}/logs/error.log',
    out_file: '${DEPLOY_DIR}/logs/out.log',
    merge_logs: true,
  }]
};
fs.writeFileSync('${DEPLOY_DIR}/ecosystem.config.cjs', 'module.exports=' + JSON.stringify(cfg, null, 2));
" || fail "ecosystem.config.cjs yaratilmadi"

pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
pm2 start "$DEPLOY_DIR/ecosystem.config.cjs" || fail "PM2 ishga tushmadi!"
pm2 save
pm2 startup 2>/dev/null | grep "^sudo" | bash 2>/dev/null || true

# PM2 haqiqatdan ishga tushganini tekshirish
sleep 5
PM2_STATUS=$(pm2 jlist 2>/dev/null | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const app=d.find(a=>a.name==='${PM2_APP_NAME}');
console.log(app?app.pm2_env.status:'not_found');
" 2>/dev/null || echo "unknown")

if [ "$PM2_STATUS" = "online" ]; then
  ok "PM2 ishlamoqda: $PM2_APP_NAME (online)"
else
  warn "PM2 holati: $PM2_STATUS"
  warn "Loglarni tekshiring: pm2 logs $PM2_APP_NAME --lines 30"
fi

# API health check
sleep 2
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_PORT/api/healthz" 2>/dev/null || echo "000")
if [ "$API_HEALTH" = "200" ]; then
  ok "API ishlayapti: http://localhost:$API_PORT/api/healthz → $API_HEALTH"
else
  warn "API health check: $API_HEALTH (PM2 hali ishga tushmagan bo'lishi mumkin, 10s kuting)"
fi

# =============================================================
# NGINX CONFIG — xavfsiz, to'liq yangi
# =============================================================
echo -e "\n${BLUE}${BOLD}[+] Nginx sozlanmoqda...${NC}"

NGINX_WRITE_PATH=""
NGINX_CONF_FOUND=""

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

[ -z "$NGINX_WRITE_PATH" ] && NGINX_WRITE_PATH="/etc/nginx/sites-available/shop-catalog"

# Mavjud configdan listen va server_name saqlash (SSL ni yo'qotmaslik)
LISTEN_LINES="    listen 80;"
SERVER_NAME_LINE="    server_name ${SELECTED_DOMAIN:-localhost} www.${SELECTED_DOMAIN:-localhost};"
SSL_EXTRA=""

if [ -n "$NGINX_CONF_FOUND" ]; then
  info "Mavjud config topildi: $NGINX_CONF_FOUND"
  BACKUP_PATH="${NGINX_CONF_FOUND}.bak.$(date +%Y%m%d_%H%M%S)"
  cp "$NGINX_CONF_FOUND" "$BACKUP_PATH"
  ok "Zaxira: $BACKUP_PATH"

  EXTRACTED_LISTEN=$(grep -E "^\s*listen\s" "$NGINX_CONF_FOUND" 2>/dev/null | head -6 | sed 's/^[[:space:]]*/    /' || true)
  [ -n "$EXTRACTED_LISTEN" ] && LISTEN_LINES="$EXTRACTED_LISTEN"

  EXTRACTED_SN=$(grep -E "^\s*server_name\s" "$NGINX_CONF_FOUND" 2>/dev/null | head -1 | sed 's/^[[:space:]]*/    /' || true)
  [ -n "$EXTRACTED_SN" ] && SERVER_NAME_LINE="$EXTRACTED_SN"

  SSL_EXTRA=$(grep -E "^\s*(ssl_certificate|ssl_certificate_key|include.*ssl|ssl_protocols|ssl_ciphers|ssl_session)" \
    "$NGINX_CONF_FOUND" 2>/dev/null | sed 's/^[[:space:]]*/    /' || true)
fi

# Nginx config yozish
# 2 xil holat: frontend build muvaffaqiyatli yoki yo'q
{
cat <<NGINXHDR
# Shop Catalog — deploy.sh tomonidan yaratildi $(date +%Y-%m-%d\ %H:%M:%S)
server {
$LISTEN_LINES
$SERVER_NAME_LINE

NGINXHDR

[ -n "$SSL_EXTRA" ] && echo "$SSL_EXTRA" && echo ""

cat <<NGINXCOMMON
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
    client_max_body_size 50M;

    # ── API (backend proxy) ────────────────────────────────────
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
        proxy_buffering off;
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
        proxy_buffering off;
    }

NGINXCOMMON

if [ "$FRONTEND_BUILD_OK" = "true" ]; then
cat <<NGINXSTATIC
    # ── Yuklangan rasmlar ──────────────────────────────────────
    location /api/uploads/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
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

    # ── manifest.json ──────────────────────────────────────────
    location = /manifest.json {
        root $FRONTEND_DIST;
        add_header Cache-Control "no-cache";
        expires 0;
    }

    # ── Statik fayllar (hash-li — 1 yil kesh) ─────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)\$ {
        root $FRONTEND_DIST;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files \$uri =404;
    }

    # ── Frontend SPA ───────────────────────────────────────────
    # try_files: avval fayl, keyin papka, keyin index.html
    # Bu SPA routing uchun muhim (admin/, /login, /catalog/1 va h.k.)
    location / {
        root $FRONTEND_DIST;
        index index.html;
        try_files \$uri \$uri/ /index.html =200;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
    }
NGINXSTATIC
else
cat <<NGINXPROXY
    # ── Frontend build topilmadi — hamma narsa API ga ─────────
    # (frontend qayta build qilinishi kerak)
    location / {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
NGINXPROXY
fi

echo "}"
} > "$NGINX_WRITE_PATH"

ok "Nginx config yozildi: $NGINX_WRITE_PATH"

# Standart Ubuntu: symlink yaratish
if [[ "$NGINX_WRITE_PATH" == /etc/nginx/sites-available/* ]]; then
  SYMLINK="/etc/nginx/sites-enabled/$(basename "$NGINX_WRITE_PATH")"
  ln -sf "$NGINX_WRITE_PATH" "$SYMLINK"
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
fi

# Config sintaksisini TEKSHIRISH
echo ""
info "nginx -t bilan tekshirilmoqda..."
NGINX_TEST=$(nginx -t 2>&1 || true)
if echo "$NGINX_TEST" | grep -q "syntax is ok"; then
  ok "Nginx config to'g'ri ✅"
  nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || \
  systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null
  ok "Nginx qayta yuklandi"
else
  echo "$NGINX_TEST"
  warn "Nginx config XATO! Eski config tiklanmoqda..."
  if [ -n "${BACKUP_PATH:-}" ] && [ -f "$BACKUP_PATH" ]; then
    cp "$BACKUP_PATH" "$NGINX_WRITE_PATH"
    nginx -s reload 2>/dev/null || true
    warn "Eski config tiklandi: $BACKUP_PATH"
  fi
  warn "Qo'lda tekshirish: nginx -t && nano $NGINX_WRITE_PATH"
fi

# =============================================================
# SSL (ixtiyoriy)
# =============================================================
if [ "${USE_SSL:-false}" = "true" ] && [ -n "$SELECTED_DOMAIN" ]; then
  echo -e "\n${BLUE}${BOLD}[+] SSL sozlanmoqda...${NC}"
  command -v certbot &>/dev/null || apt_install certbot && apt_install python3-certbot-nginx 2>/dev/null || true
  certbot --nginx -d "$SELECTED_DOMAIN" -d "www.$SELECTED_DOMAIN" \
    --non-interactive --agree-tos --email "admin@$SELECTED_DOMAIN" 2>/dev/null && \
    ok "SSL o'rnatildi" || warn "SSL qo'lda: certbot --nginx -d $SELECTED_DOMAIN"
fi

# =============================================================
# YAKUNIY HEALTH CHECK
# =============================================================
echo ""
echo -e "${BLUE}${BOLD}── Yakuniy tekshiruv ──────────────────────────────${NC}"

# API health
sleep 3
HC=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_PORT/api/healthz" 2>/dev/null || echo "000")
if [ "$HC" = "200" ]; then
  ok "API: http://localhost:$API_PORT/api/healthz → $HC ✅"
else
  warn "API health: $HC — loglarni tekshiring: pm2 logs $PM2_APP_NAME"
fi

# Nginx health
NC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:80/" 2>/dev/null || echo "000")
if [[ "$NC_CODE" =~ ^(200|301|302|304)$ ]]; then
  ok "Nginx: http://localhost → $NC_CODE ✅"
else
  warn "Nginx: localhost → $NC_CODE — nginx -t bilan tekshiring"
fi

# =============================================================
# YAKUNIY HISOBOT
# =============================================================
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║      🎉 O'RNATISH MUVAFFAQIYATLI!            ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

pm2 status "$PM2_APP_NAME" 2>/dev/null | grep -E "name|online|status" || true

echo ""
ok "Sayt:       http://$SELECTED_DOMAIN"
ok "API:        http://localhost:$API_PORT/api"
ok "DB:         $DB_NAME"
ok "Fayllar:    $DEPLOY_DIR"
echo ""
echo -e "  ${YELLOW}${BOLD}Admin login:  admin${NC}"
echo -e "  ${YELLOW}${BOLD}Admin parol:  admin123  ← kirganingizda o'zgartiring!${NC}"
echo ""
echo -e "  ${CYAN}Yangilash:     cd $DEPLOY_DIR && git pull && sudo bash deploy.sh${NC}"
echo -e "  ${CYAN}Loglar:        pm2 logs $PM2_APP_NAME${NC}"
echo -e "  ${CYAN}Qayta yuklash: pm2 restart $PM2_APP_NAME${NC}"
echo -e "  ${CYAN}SSL:           sudo USE_SSL=true bash $DEPLOY_DIR/deploy.sh${NC}"
echo ""

if [ "$FRONTEND_BUILD_OK" = "false" ]; then
  echo -e "${RED}${BOLD}⚠️  DIQQAT: Frontend build ishlamadi!${NC}"
  echo -e "  Qo'lda bajaring:"
  echo -e "  ${YELLOW}cd $DEPLOY_DIR && PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/shop-catalog run build${NC}"
  echo -e "  Keyin: sudo bash $DEPLOY_DIR/deploy.sh"
  echo ""
fi

# Oxirgi loglar
pm2 logs "$PM2_APP_NAME" --lines 8 --nostream 2>/dev/null || true
