const fs = require('fs');
const path = require('path');

// .env faylini o'qish
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx < 0) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  });
  return env;
}

const env = loadEnv();

module.exports = {
  apps: [
    {
      name: 'eva-api',
      script: './artifacts/api-server/dist/index.mjs',
      cwd: __dirname,
      env: {
        NODE_ENV:       env.NODE_ENV       || 'production',
        PORT:           env.PORT           || '3200',
        DATABASE_URL:   env.DATABASE_URL   || '',
        SESSION_SECRET: env.SESSION_SECRET || 'change-me',
        UPLOADS_DIR:    env.UPLOADS_DIR    || path.join(__dirname, 'uploads'),
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/www/wwwlogs/eva-api-error.log',
      out_file:   '/www/wwwlogs/eva-api-out.log',
    },
  ],
};
