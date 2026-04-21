const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const rawTrustProxy = process.env.TRUST_PROXY;

module.exports = {
  cookieName: process.env.COOKIE_NAME || "inventory_session",
  databasePath: process.env.DATABASE_PATH || path.join(rootDir, "data", "inventory.sqlite"),
  defaultAdminName: process.env.ADMIN_FULL_NAME || "Administrator",
  defaultAdminPassword: process.env.ADMIN_PASSWORD || "Admin123!",
  defaultAdminUsername: process.env.ADMIN_USERNAME || "admin",
  maxImportBytes: Number(process.env.MAX_IMPORT_BYTES || 5 * 1024 * 1024),
  port: Number(process.env.PORT || 3000),
  rootDir,
  secureCookies: process.env.NODE_ENV === "production",
  sessionRefreshMs: Number(process.env.SESSION_REFRESH_MS || 1000 * 60 * 5),
  sessionTtlMs: Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8),
  startedAt: new Date().toISOString(),
  trustProxy: resolveTrustProxy(rawTrustProxy),
};

function resolveTrustProxy(value) {
  if (value === undefined) {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  const numericValue = Number.parseInt(normalizedValue, 10);

  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return value;
}
