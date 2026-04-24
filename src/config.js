const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const rawTrustProxy = process.env.TRUST_PROXY;

module.exports = {
  autoBackupEnabled: parseBoolean(process.env.AUTO_BACKUP_ENABLED, true),
  autoBackupHour: clampInteger(process.env.AUTO_BACKUP_HOUR, 3, 0, 23),
  autoBackupIntervalMs: clampInteger(process.env.AUTO_BACKUP_INTERVAL_MS, 0, 0),
  autoBackupKeepDays: clampInteger(process.env.AUTO_BACKUP_KEEP_DAYS, 14, 1),
  appBaseUrl: process.env.APP_BASE_URL || "",
  attachmentsDir: process.env.ATTACHMENTS_DIR || path.join(rootDir, "data", "attachments"),
  backupsDir: process.env.BACKUPS_DIR || path.join(rootDir, "data", "backups"),
  cookieName: process.env.COOKIE_NAME || "inventory_session",
  databasePath: process.env.DATABASE_PATH || path.join(rootDir, "data", "inventory.sqlite"),
  defaultAdminName: process.env.ADMIN_FULL_NAME || "Administrator",
  defaultAdminPassword: process.env.ADMIN_PASSWORD || "qwerty2026",
  defaultAdminUsername: process.env.ADMIN_USERNAME || "Admin",
  forceDefaultAdminPasswordChange: process.env.FORCE_DEFAULT_ADMIN_PASSWORD_CHANGE === "true",
  loginLockDurationMs: Number(process.env.LOGIN_LOCK_DURATION_MS || 1000 * 60 * 15),
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || 5),
  maxImportBytes: Number(process.env.MAX_IMPORT_BYTES || 5 * 1024 * 1024),
  maxRestoreBytes: Number(process.env.MAX_RESTORE_BYTES || 20 * 1024 * 1024),
  maxAttachmentBytes: Number(process.env.MAX_ATTACHMENT_BYTES || 15 * 1024 * 1024),
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

function parseBoolean(value, fallbackValue) {
  if (value == null || value === "") {
    return fallbackValue;
  }

  return String(value).trim().toLowerCase() === "true";
}

function clampInteger(value, fallbackValue, minimum, maximum = Number.POSITIVE_INFINITY) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(parsedValue)) {
    return fallbackValue;
  }

  return Math.min(maximum, Math.max(minimum, parsedValue));
}
