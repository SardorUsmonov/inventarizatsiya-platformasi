const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");

const config = require("./src/config");
const { createDatabase } = require("./src/database");
const {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  parseCookies,
  serializeCookie,
  verifyPassword,
} = require("./src/auth");
const {
  createInventoryTemplateWorkbook,
  createInventoryWorkbook,
  parseInventoryWorkbook,
} = require("./src/excel");
const {
  getAssetStatusLabel,
  getConditionStatusLabel,
  isKnownAssetStatus,
  isKnownConditionStatus,
  listAssetStatuses,
  listConditionStatuses,
  normalizeAssetStatus,
  normalizeConditionStatus,
} = require("./src/inventory-options");
const {
  getPermissions,
  hasPermission,
  isKnownRole,
  listRoles,
} = require("./src/permissions");

const app = express();
const importUpload = multer({
  limits: {
    fileSize: config.maxImportBytes,
  },
  storage: multer.memoryStorage(),
});
const attachmentUpload = multer({
  limits: {
    fileSize: config.maxAttachmentBytes,
  },
  storage: multer.memoryStorage(),
});
const restoreUpload = multer({
  limits: {
    fileSize: config.maxRestoreBytes,
  },
  storage: multer.memoryStorage(),
});
const database = createDatabase(config);
let autoBackupTimerId = 0;
let autoBackupInFlight = false;

app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(applySecurityHeaders);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/", (_request, response) => {
  response.sendFile(path.join(config.rootDir, "index.html"));
});

app.get("/styles.css", (_request, response) => {
  response.sendFile(path.join(config.rootDir, "styles.css"));
});

app.get("/app.js", (_request, response) => {
  response.sendFile(path.join(config.rootDir, "app.js"));
});

app.get("/enhancements.js", (_request, response) => {
  response.sendFile(path.join(config.rootDir, "enhancements.js"));
});

app.get("/favicon.ico", (_request, response) => {
  response.status(204).end();
});

app.get("/api/health", (_request, response) => {
  response.json({
    startedAt: config.startedAt,
    status: "ok",
  });
});

app.get("/api/session", (request, response) => {
  const authContext = getAuthContext(request, response);

  if (!authContext) {
    response.status(401).json({
      message: "Tizimga kirish talab etiladi.",
    });
    return;
  }

  response.json(buildSessionPayload(authContext.user));
});

app.post("/api/auth/login", (request, response) => {
  const username = normalizeText(request.body?.username, 64);
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  const requestedUser = username || "unknown";

  if (!username || !password) {
    response.status(400).json({
      message: "Login va parolni kiriting.",
    });
    return;
  }

  database.pruneExpiredSessions();

  const user = database.getUserByUsername(username);

  if (user?.lockedUntil && Date.parse(user.lockedUntil) > Date.now()) {
    response.status(429).json({
      message: "Kirish vaqtincha bloklangan. Bir necha daqiqadan keyin urinib ko'ring.",
    });
    return;
  }

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    const loginFailure = user ? database.markUserLoginFailed(user.id, { username: requestedUser }) : null;
    database.logAudit({
      action: "auth.login_failed",
      actorName: user?.fullName || null,
      actorRole: user?.role || "guest",
      actorUserId: user?.id || null,
      actorUsername: requestedUser,
      details: {
        failedLoginAttempts: loginFailure?.failedLoginAttempts || 0,
        lockedUntil: loginFailure?.lockedUntil || "",
        username: requestedUser,
      },
      entityType: "auth",
      ipAddress: request.ip,
      summary: loginFailure?.lockedUntil
        ? "Muvaffaqiyatsiz login urinish va foydalanuvchi vaqtincha bloklandi."
        : "Muvaffaqiyatsiz login urinish.",
    });

    response.status(loginFailure?.lockedUntil ? 429 : 401).json({
      message: loginFailure?.lockedUntil
        ? "Ko'p xato urinish sabab login vaqtincha bloklandi."
        : "Login yoki parol noto'g'ri.",
    });
    return;
  }

  const refreshedUser = database.markUserLoginSuccess(user.id);
  const sessionToken = createSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();

  database.createSession(refreshedUser.id, hashSessionToken(sessionToken), expiresAt);
  database.logAudit({
    action: "auth.login_success",
    actorName: refreshedUser.fullName,
    actorRole: refreshedUser.role,
    actorUserId: refreshedUser.id,
    actorUsername: refreshedUser.username,
    details: {
      expiresAt,
      mustChangePassword: refreshedUser.mustChangePassword,
    },
    entityType: "auth",
    ipAddress: request.ip,
    summary: "Foydalanuvchi tizimga kirdi.",
  });

  response.setHeader(
    "Set-Cookie",
    serializeCookie(config.cookieName, sessionToken, {
      httpOnly: true,
      maxAge: Math.floor(config.sessionTtlMs / 1000),
      path: "/",
      sameSite: "Lax",
      secure: config.secureCookies,
    })
  );

  response.json({
    ...buildSessionPayload(refreshedUser),
    expiresAt,
  });
});

app.post("/api/auth/logout", requireAuth, (request, response) => {
  const cookies = parseCookies(request.headers.cookie || "");
  const sessionToken = cookies[config.cookieName];

  if (sessionToken) {
    database.deleteSessionByTokenHash(hashSessionToken(sessionToken));
  }

  database.logAudit({
    action: "auth.logout",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {},
    entityType: "auth",
    ipAddress: request.ip,
    summary: "Foydalanuvchi tizimdan chiqdi.",
  });

  clearAuthCookie(response);
  response.status(204).end();
});

app.post("/api/auth/change-password", requireAuth, (request, response) => {
  const currentPassword = typeof request.body?.currentPassword === "string" ? request.body.currentPassword : "";
  const newPassword = typeof request.body?.newPassword === "string" ? request.body.newPassword.trim() : "";
  const confirmPassword = typeof request.body?.confirmPassword === "string" ? request.body.confirmPassword.trim() : "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    response.status(400).json({
      message: "Joriy parol va yangi parol maydonlari majburiy.",
    });
    return;
  }

  if (!verifyPassword(currentPassword, request.user.passwordHash)) {
    response.status(400).json({
      message: "Joriy parol noto'g'ri.",
    });
    return;
  }

  if (newPassword.length < 8) {
    response.status(400).json({
      message: "Yangi parol kamida 8 belgidan iborat bo'lishi kerak.",
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    response.status(400).json({
      message: "Yangi parol tasdiqlash bilan mos emas.",
    });
    return;
  }

  if (verifyPassword(newPassword, request.user.passwordHash)) {
    response.status(400).json({
      message: "Yangi parol joriy parol bilan bir xil bo'lmasligi kerak.",
    });
    return;
  }

  const updatedUser = database.updateUserPassword(request.user.id, hashPassword(newPassword));
  database.deleteSessionsByUserId(request.user.id);
  database.logAudit({
    action: "auth.password_change",
    actorName: updatedUser.fullName,
    actorRole: updatedUser.role,
    actorUserId: updatedUser.id,
    actorUsername: updatedUser.username,
    details: {},
    entityType: "auth",
    ipAddress: request.ip,
    summary: "Foydalanuvchi parolini yangiladi.",
  });

  clearAuthCookie(response);
  response.json({
    message: "Parol muvaffaqiyatli yangilandi. Qayta login qiling.",
  });
});

app.use("/api", requireAuth);
app.use("/api", requirePasswordRefresh);

app.get("/api/dashboard", (request, response) => {
  const permissions = getPermissions(request.user.role);

  response.json({
    auditLogs: permissions.viewAudit ? database.listAuditLogs({ limit: 50 }) : [],
    auditRefreshedAt: permissions.viewAudit ? new Date().toISOString() : "",
    auditSettings: permissions.viewAudit ? database.getAuditSettings() : null,
    backupRuns: permissions.manageBackups ? database.listBackupRuns(10) : [],
    departments: database.listDepartments(),
    devices: database.listDevices(),
    inventoryMeta: {
      assetStatuses: listAssetStatuses(),
      conditionStatuses: listConditionStatuses(),
    },
    overview: permissions.viewInventory ? database.getDashboardOverview() : null,
    roles: listRoles(),
    systemMetrics: permissions.manageSettings ? database.getSystemMetrics() : null,
    user: sanitizeUser(request.user),
    users: permissions.manageUsers ? database.listUsers() : [],
  });
});

app.get("/api/inventory", requirePermission("viewInventory"), (request, response) => {
  const filters = getInventoryFilters(request.query);
  const stats = database.getInventoryStats(filters);

  response.json({
    records: database.listInventory(filters),
    stats,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((stats.totalRecords || 0) / filters.pageSize)),
    },
  });
});

app.post("/api/inventory", requirePermission("manageInventory"), (request, response) => {
  const payload = validateInventoryPayload(request.body);

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  const department = database.getDepartmentById(payload.data.departmentId);
  const device = database.getDeviceById(payload.data.deviceId);

  if (!department || !device) {
    response.status(400).json({
      message: "Bo'lim yoki texnika katalogdan topilmadi.",
    });
    return;
  }

  const duplicate = findDuplicateInventoryIdentifiers(payload.data);

  if (duplicate) {
    response.status(409).json({
      conflict: duplicate,
      message: duplicate.field === "assetTag"
        ? "Bunday aktiv tegi allaqachon mavjud. Inventar raqami takrorlanmasligi kerak."
        : "Bunday serial raqam allaqachon mavjud. Konfliktni tekshirib chiqing.",
    });
    return;
  }

  const record = database.createInventory(payload.data, request.user.id);
  database.createTransfer(record.id, {
    fromDepartment: "",
    fromHolder: payload.data.previousHolder,
    fromStatus: "",
    notes: "Aktiv birinchi marta ro'yxatga olindi.",
    toDepartment: record.department,
    toHolder: record.currentHolder,
    toStatus: record.assetStatus,
    transferDate: record.assignedAt || record.createdAt.slice(0, 10),
  }, request.user.id);

  database.logAudit({
    action: "inventory.create",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      assetStatus: record.assetStatus,
      assetTag: record.assetTag,
      conditionStatus: record.conditionStatus,
      currentHolder: record.currentHolder,
      department: record.department,
      deviceName: record.deviceName,
    },
    entityId: record.id,
    entityType: "inventory",
    ipAddress: request.ip,
    summary: `${record.deviceName} ${record.currentHolder} ga biriktirildi (${getAssetStatusLabel(record.assetStatus)}).`,
  });

  response.status(201).json({
    record,
  });
});

app.put("/api/inventory/:id", requirePermission("manageInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);
  const payload = validateInventoryPayload(request.body);

  if (!recordId) {
    response.status(400).json({
      message: "Yozuv identifikatori noto'g'ri.",
    });
    return;
  }

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  const existing = database.getInventoryById(recordId);

  if (!existing) {
    response.status(404).json({
      message: "Yozuv topilmadi.",
    });
    return;
  }

  const duplicate = findDuplicateInventoryIdentifiers(payload.data, recordId);

  if (duplicate) {
    response.status(409).json({
      conflict: duplicate,
      message: duplicate.field === "assetTag"
        ? "Bunday aktiv tegi boshqa yozuvda mavjud."
        : "Bunday serial raqam boshqa yozuvda mavjud.",
    });
    return;
  }

  const record = database.updateInventory(recordId, payload.data, request.user.id);
  const transferNotes = [];

  if (existing.currentHolder !== record.currentHolder) {
    transferNotes.push("Mas'ul shaxs yangilandi");
  }

  if (existing.department !== record.department) {
    transferNotes.push("Bo'lim yangilandi");
  }

  if (existing.assetStatus !== record.assetStatus) {
    transferNotes.push(`Status ${getAssetStatusLabel(existing.assetStatus)} dan ${getAssetStatusLabel(record.assetStatus)} ga o'tdi`);
  }

  if (transferNotes.length) {
    database.createTransfer(record.id, {
      fromDepartment: existing.department,
      fromHolder: existing.currentHolder,
      fromStatus: existing.assetStatus,
      notes: transferNotes.join(". "),
      toDepartment: record.department,
      toHolder: record.currentHolder,
      toStatus: record.assetStatus,
      transferDate: record.assignedAt || new Date().toISOString().slice(0, 10),
    }, request.user.id);
  }

  database.logAudit({
    action: "inventory.update",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      after: {
        assetStatus: record.assetStatus,
        assetTag: record.assetTag,
        conditionStatus: record.conditionStatus,
        currentHolder: record.currentHolder,
        department: record.department,
        deviceName: record.deviceName,
      },
      before: {
        assetStatus: existing.assetStatus,
        assetTag: existing.assetTag,
        conditionStatus: existing.conditionStatus,
        currentHolder: existing.currentHolder,
        department: existing.department,
        deviceName: existing.deviceName,
      },
    },
    entityId: record.id,
    entityType: "inventory",
    ipAddress: request.ip,
    summary: `${record.deviceName} bo'yicha yozuv yangilandi (${getAssetStatusLabel(record.assetStatus)}).`,
  });

  response.json({
    record,
  });
});

app.post("/api/inventory/:id/transfer", requirePermission("manageInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);
  const payload = validateTransferPayload(request.body);

  if (!recordId) {
    response.status(400).json({
      message: "Yozuv identifikatori noto'g'ri.",
    });
    return;
  }

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  const existing = database.getInventoryById(recordId);

  if (!existing) {
    response.status(404).json({
      message: "Yozuv topilmadi.",
    });
    return;
  }

  const department = database.getDepartmentById(payload.data.departmentId);

  if (!department) {
    response.status(400).json({
      message: "Yangi bo'lim katalogdan topilmadi.",
    });
    return;
  }

  const result = database.transferInventory(recordId, payload.data, request.user.id);

  database.logAudit({
    action: "inventory.transfer",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      after: {
        assetStatus: result.record.assetStatus,
        currentHolder: result.record.currentHolder,
        department: result.record.department,
      },
      before: {
        assetStatus: existing.assetStatus,
        currentHolder: existing.currentHolder,
        department: existing.department,
      },
      notes: payload.data.notes,
      transferDate: payload.data.transferDate,
    },
    entityId: recordId,
    entityType: "inventory",
    ipAddress: request.ip,
    summary: `${existing.deviceName} aktivi ${payload.data.toHolder} ga o'tkazildi.`,
  });

  response.status(201).json(result);
});

app.delete("/api/inventory/:id", requirePermission("manageInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);

  if (!recordId) {
    response.status(400).json({
      message: "Yozuv identifikatori noto'g'ri.",
    });
    return;
  }

  const deletedRecord = database.deleteInventory(recordId);

  if (!deletedRecord) {
    response.status(404).json({
      message: "Yozuv topilmadi.",
    });
    return;
  }

  database.logAudit({
    action: "inventory.delete",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      assetStatus: deletedRecord.assetStatus,
      assetTag: deletedRecord.assetTag,
      currentHolder: deletedRecord.currentHolder,
      department: deletedRecord.department,
      deviceName: deletedRecord.deviceName,
    },
    entityId: deletedRecord.id,
    entityType: "inventory",
    ipAddress: request.ip,
    summary: `${deletedRecord.deviceName} yozuvi o'chirildi.`,
  });

  response.status(204).end();
});

app.get("/api/inventory/:id/detail", requirePermission("viewInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);

  if (!recordId) {
    response.status(400).json({
      message: "Yozuv identifikatori noto'g'ri.",
    });
    return;
  }

  const record = database.getInventoryById(recordId);

  if (!record) {
    response.status(404).json({
      message: "Yozuv topilmadi.",
    });
    return;
  }

  response.json({
    attachments: database.listAttachments(recordId),
    qrUrl: `/api/inventory/${recordId}/qr.svg`,
    record,
    serviceLogs: database.listServiceLogs(recordId),
    transfers: database.listTransfers(recordId),
  });
});

app.get("/api/inventory/:id/qr.svg", requirePermission("viewInventory"), async (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);
  const record = recordId ? database.getInventoryById(recordId) : null;

  if (!record) {
    response.status(404).send("Topilmadi");
    return;
  }

  const svg = await QRCode.toString(buildQrValue(record, request), {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "svg",
    width: 320,
  });

  response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  response.send(svg);
});

app.get("/api/inventory/:id/transfers", requirePermission("viewInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);

  if (!recordId) {
    response.status(400).json({ message: "Yozuv identifikatori noto'g'ri." });
    return;
  }

  response.json({
    transfers: database.listTransfers(recordId),
  });
});

app.get("/api/inventory/:id/service-logs", requirePermission("viewInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);

  if (!recordId) {
    response.status(400).json({ message: "Yozuv identifikatori noto'g'ri." });
    return;
  }

  response.json({
    serviceLogs: database.listServiceLogs(recordId),
  });
});

app.post("/api/inventory/:id/service-logs", requirePermission("manageService"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);
  const payload = validateServiceLogPayload(request.body);

  if (!recordId) {
    response.status(400).json({ message: "Yozuv identifikatori noto'g'ri." });
    return;
  }

  if (!payload.ok) {
    response.status(400).json({ message: payload.message });
    return;
  }

  const record = database.getInventoryById(recordId);

  if (!record) {
    response.status(404).json({ message: "Yozuv topilmadi." });
    return;
  }

  const serviceLog = database.createServiceLog(recordId, payload.data, request.user.id);

  database.logAudit({
    action: "inventory.service_log_create",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: serviceLog,
    entityId: recordId,
    entityType: "inventory",
    ipAddress: request.ip,
    summary: `${record.deviceName} uchun servis yozuvi qo'shildi.`,
  });

  response.status(201).json({
    serviceLog,
  });
});

app.get("/api/inventory/:id/attachments", requirePermission("viewInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);

  if (!recordId) {
    response.status(400).json({ message: "Yozuv identifikatori noto'g'ri." });
    return;
  }

  response.json({
    attachments: database.listAttachments(recordId),
  });
});

app.post(
  "/api/inventory/:id/attachments",
  requirePermission("manageAttachments"),
  attachmentUpload.single("file"),
  (request, response) => {
    const recordId = parsePositiveInteger(request.params.id);

    if (!recordId) {
      response.status(400).json({ message: "Yozuv identifikatori noto'g'ri." });
      return;
    }

    if (!request.file?.buffer) {
      response.status(400).json({ message: "Attachment fayli tanlanmadi." });
      return;
    }

    const record = database.getInventoryById(recordId);

    if (!record) {
      response.status(404).json({ message: "Yozuv topilmadi." });
      return;
    }

    const safeOriginalName = sanitizeFileName(request.file.originalname || "attachment.bin");
    const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeOriginalName}`;
    const recordDir = path.join(config.attachmentsDir, String(recordId));
    const filePath = path.join(recordDir, storedName);

    fs.mkdirSync(recordDir, { recursive: true });
    fs.writeFileSync(filePath, request.file.buffer);

    const attachment = database.createAttachment(
      recordId,
      {
        fileName: safeOriginalName,
        filePath,
        fileSize: request.file.size || request.file.buffer.length,
        mimeType: request.file.mimetype || "application/octet-stream",
        storedName,
      },
      request.user.id
    );

    database.logAudit({
      action: "inventory.attachment_create",
      actorName: request.user.fullName,
      actorRole: request.user.role,
      actorUserId: request.user.id,
      actorUsername: request.user.username,
      details: {
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
      },
      entityId: recordId,
      entityType: "inventory",
      ipAddress: request.ip,
      summary: `${record.deviceName} uchun attachment yuklandi.`,
    });

    response.status(201).json({
      attachment,
    });
  }
);

app.get("/api/inventory/:id/attachments/:attachmentId/download", requirePermission("viewInventory"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);
  const attachmentId = parsePositiveInteger(request.params.attachmentId);
  const attachment = attachmentId ? database.getAttachmentById(attachmentId) : null;

  if (!recordId || !attachmentId || !attachment || attachment.inventoryRecordId !== recordId) {
    response.status(404).json({ message: "Attachment topilmadi." });
    return;
  }

  response.download(attachment.filePath, attachment.fileName);
});

app.delete("/api/inventory/:id/attachments/:attachmentId", requirePermission("manageAttachments"), (request, response) => {
  const recordId = parsePositiveInteger(request.params.id);
  const attachmentId = parsePositiveInteger(request.params.attachmentId);
  const attachment = attachmentId ? database.getAttachmentById(attachmentId) : null;

  if (!recordId || !attachmentId || !attachment || attachment.inventoryRecordId !== recordId) {
    response.status(404).json({ message: "Attachment topilmadi." });
    return;
  }

  const deletedAttachment = database.removeAttachment(attachmentId);

  if (deletedAttachment?.filePath && fs.existsSync(deletedAttachment.filePath)) {
    fs.unlinkSync(deletedAttachment.filePath);
  }

  response.status(204).end();
});

app.post(
  "/api/inventory/import-preview",
  requirePermission("importInventory"),
  importUpload.single("file"),
  async (request, response) => {
    if (!request.file?.buffer) {
      response.status(400).json({
        message: "Import uchun Excel fayl tanlanmadi.",
      });
      return;
    }

    const rows = await parseInventoryWorkbook(request.file.buffer);
    const review = buildImportReview(rows);

    response.json({
      conflicts: review.conflicts,
      errors: review.errors,
      previewRows: review.rows.slice(0, 20),
      totalRows: rows.length,
      validRows: review.rows.length,
    });
  }
);

app.get("/api/inventory/export/csv", requirePermission("exportInventory"), (request, response) => {
  const filters = getInventoryFilters(request.query);
  const records = database.listInventory(filters);
  const fileName = `inventar-${new Date().toISOString().slice(0, 10)}.csv`;

  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.send(createCsv(records));
});

app.get("/api/inventory/export/xlsx", requirePermission("exportInventory"), async (request, response) => {
  const filters = getInventoryFilters(request.query);
  const records = database.listInventory(filters);
  const fileName = `inventar-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const workbook = await createInventoryWorkbook(records);

  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.send(workbook);
});

app.get("/api/inventory/template", requirePermission("importInventory"), async (_request, response) => {
  const workbook = await createInventoryTemplateWorkbook({
    departments: database.listDepartments().filter((item) => item.isActive),
    devices: database.listDevices().filter((item) => item.isActive),
  });

  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  response.setHeader("Content-Disposition", 'attachment; filename="inventar-template.xlsx"');
  response.send(workbook);
});

app.post(
  "/api/inventory/import",
  requirePermission("importInventory"),
  importUpload.single("file"),
  async (request, response) => {
    if (!request.file?.buffer) {
      response.status(400).json({
        message: "Import uchun Excel fayl tanlanmadi.",
      });
      return;
    }

    const rows = await parseInventoryWorkbook(request.file.buffer);

    if (!rows.length) {
      response.status(400).json({
        message: "Excel faylda import qilinadigan ma'lumot topilmadi.",
      });
      return;
    }

    const review = buildImportReview(rows);

    if (review.errors.length) {
      response.status(400).json({
        errors: review.errors,
        message: review.errors[0],
      });
      return;
    }

    const conflictStrategy = normalizeText(request.body?.conflictStrategy, 20);
    const fileDuplicateConflicts = review.conflicts.filter((conflict) => conflict.type === "file_duplicate");

    if (fileDuplicateConflicts.length) {
      response.status(409).json({
        conflicts: fileDuplicateConflicts,
        message: "Excel fayl ichida takroriy aktiv tegi yoki serial raqam bor. Avval faylni tozalang.",
      });
      return;
    }

    if (review.conflicts.length && !["skip", "update"].includes(conflictStrategy)) {
      response.status(409).json({
        conflicts: review.conflicts,
        message: "Excel importda takroriy inventar raqamlar topildi. Konflikt strategiyasini tanlang: o'tkazib yuborish yoki mavjud yozuvni yangilash.",
      });
      return;
    }

    const result = database.importInventoryRows(review.rows, request.user.id, {
      conflictStrategy: conflictStrategy || "reject",
    });

    database.logAudit({
      action: "inventory.import",
      actorName: request.user.fullName,
      actorRole: request.user.role,
      actorUserId: request.user.id,
      actorUsername: request.user.username,
      details: result,
      entityType: "inventory",
      ipAddress: request.ip,
      summary: `${result.insertedCount} ta qo'shildi, ${result.updatedCount || 0} ta yangilandi, ${result.skippedCount || 0} ta o'tkazib yuborildi.`,
    });

    response.status(201).json({
      result,
    });
  }
);

app.get("/api/global-search", requirePermission("viewInventory"), (request, response) => {
  const query = normalizeText(request.query.query, 120);

  response.json({
    results: database.searchGlobal(query),
  });
});

app.get("/api/reports/summary", requirePermission("viewReports"), (request, response) => {
  const summary = {
    generatedAt: new Date().toISOString(),
    overview: database.getDashboardOverview(),
    metrics: database.getSystemMetrics(),
  };

  if (String(request.query.format || "").toLowerCase() === "html") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.send(buildPrintableReport(summary));
    return;
  }

  response.json(summary);
});

app.get("/api/system/metrics", requirePermission("manageSettings"), (request, response) => {
  response.json({
    backups: database.listBackupRuns(20),
    metrics: database.getSystemMetrics(),
  });
});

app.get("/api/system/backup", requirePermission("manageBackups"), (request, response) => {
  const backup = writeBackupSnapshot({
    initiatedByUserId: request.user.id,
    summary: "JSON backup yaratildi.",
  });

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${backup.fileName}"`);
  response.send(JSON.stringify(backup.payload, null, 2));
});

app.post(
  "/api/system/restore",
  requirePermission("manageBackups"),
  restoreUpload.single("file"),
  (request, response) => {
    if (!request.file?.buffer) {
      response.status(400).json({
        message: "Restore uchun backup fayli tanlanmadi.",
      });
      return;
    }

    let payload;

    try {
      payload = JSON.parse(request.file.buffer.toString("utf8"));
    } catch (_error) {
      response.status(400).json({
        message: "Backup fayl JSON formatda o'qilmadi.",
      });
      return;
    }

    if (!payload?.data?.users || !payload?.data?.inventoryRecords) {
      response.status(400).json({
        message: "Backup tarkibi noto'g'ri yoki to'liq emas.",
      });
      return;
    }

    clearDirectory(config.attachmentsDir);

    (payload.files || []).forEach((file) => {
      if (!file?.contentBase64 || !file?.filePath) {
        return;
      }

      const targetPath = String(file.filePath).replace(/^.*?data[\\/]+attachments/i, config.attachmentsDir);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, Buffer.from(file.contentBase64, "base64"));
    });

    database.restoreBackupPayload(payload);
    database.logAudit({
      action: "system.restore",
      actorName: request.user.fullName,
      actorRole: request.user.role,
      actorUserId: request.user.id,
      actorUsername: request.user.username,
      details: {
        backupVersion: payload.backupVersion || 1,
      },
      entityType: "system",
      ipAddress: request.ip,
      summary: "Tizim backup orqali tiklandi.",
    });

    clearAuthCookie(response);
    response.json({
      message: "Backup muvaffaqiyatli tiklandi. Qayta login qiling.",
    });
  }
);

app.post("/api/departments", requirePermission("manageCatalogs"), (request, response) => {
  const payload = validateDepartmentPayload(request.body);

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  if (database.getDepartmentByName(payload.data.name)) {
    response.status(409).json({
      message: "Bunday nomdagi bo'lim katalogda allaqachon mavjud.",
    });
    return;
  }

  const department = database.createDepartment(payload.data);

  database.logAudit({
    action: "catalog.department_create",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: department,
    entityId: department.id,
    entityType: "department",
    ipAddress: request.ip,
    summary: `${department.name} bo'limi katalogga qo'shildi.`,
  });

  response.status(201).json({
    department,
  });
});

app.put("/api/departments/:id", requirePermission("manageCatalogs"), (request, response) => {
  const departmentId = parsePositiveInteger(request.params.id);
  const payload = validateDepartmentPayload(request.body);

  if (!departmentId) {
    response.status(400).json({
      message: "Bo'lim identifikatori noto'g'ri.",
    });
    return;
  }

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  const currentDepartment = database.getDepartmentById(departmentId);

  if (!currentDepartment) {
    response.status(404).json({
      message: "Bo'lim topilmadi.",
    });
    return;
  }

  const duplicate = database.getDepartmentByName(payload.data.name);

  if (duplicate && duplicate.id !== departmentId) {
    response.status(409).json({
      message: "Bunday nomdagi bo'lim katalogda allaqachon mavjud.",
    });
    return;
  }

  const department = database.updateDepartment(departmentId, payload.data);

  database.logAudit({
    action: "catalog.department_update",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      after: department,
      before: currentDepartment,
    },
    entityId: department.id,
    entityType: "department",
    ipAddress: request.ip,
    summary: `${department.name} bo'limi yangilandi.`,
  });

  response.json({
    department,
  });
});

app.delete("/api/departments/:id", requirePermission("manageCatalogs"), (request, response) => {
  const departmentId = parsePositiveInteger(request.params.id);

  if (!departmentId) {
    response.status(400).json({
      message: "Bo'lim identifikatori noto'g'ri.",
    });
    return;
  }

  const currentDepartment = database.getDepartmentById(departmentId);

  if (!currentDepartment) {
    response.status(404).json({
      message: "Bo'lim topilmadi.",
    });
    return;
  }

  const usageCount = database.getInventoryUsageByDepartmentId(departmentId);

  if (usageCount > 0) {
    response.status(409).json({
      message: "Bu bo'lim inventar yozuvlariga bog'langan. Avval yozuvlarni boshqa bo'limga o'tkazing yoki bo'limni nofaol qiling.",
    });
    return;
  }

  const department = database.deleteDepartment(departmentId);

  database.logAudit({
    action: "catalog.department_delete",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: department,
    entityId: department.id,
    entityType: "department",
    ipAddress: request.ip,
    summary: `${department.name} bo'limi katalogdan o'chirildi.`,
  });

  response.status(204).end();
});

app.post("/api/devices", requirePermission("manageCatalogs"), (request, response) => {
  const payload = validateDevicePayload(request.body);

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  if (database.getDeviceByName(payload.data.name)) {
    response.status(409).json({
      message: "Bunday nomdagi texnika katalogda allaqachon mavjud.",
    });
    return;
  }

  const device = database.createDevice(payload.data);

  database.logAudit({
    action: "catalog.device_create",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: device,
    entityId: device.id,
    entityType: "device",
    ipAddress: request.ip,
    summary: `${device.name} texnikasi katalogga qo'shildi.`,
  });

  response.status(201).json({
    device,
  });
});

app.put("/api/devices/:id", requirePermission("manageCatalogs"), (request, response) => {
  const deviceId = parsePositiveInteger(request.params.id);
  const payload = validateDevicePayload(request.body);

  if (!deviceId) {
    response.status(400).json({
      message: "Texnika identifikatori noto'g'ri.",
    });
    return;
  }

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  const currentDevice = database.getDeviceById(deviceId);

  if (!currentDevice) {
    response.status(404).json({
      message: "Texnika topilmadi.",
    });
    return;
  }

  const duplicate = database.getDeviceByName(payload.data.name);

  if (duplicate && duplicate.id !== deviceId) {
    response.status(409).json({
      message: "Bunday nomdagi texnika katalogda allaqachon mavjud.",
    });
    return;
  }

  const device = database.updateDevice(deviceId, payload.data);

  database.logAudit({
    action: "catalog.device_update",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      after: device,
      before: currentDevice,
    },
    entityId: device.id,
    entityType: "device",
    ipAddress: request.ip,
    summary: `${device.name} texnikasi yangilandi.`,
  });

  response.json({
    device,
  });
});

app.delete("/api/devices/:id", requirePermission("manageCatalogs"), (request, response) => {
  const deviceId = parsePositiveInteger(request.params.id);

  if (!deviceId) {
    response.status(400).json({
      message: "Texnika identifikatori noto'g'ri.",
    });
    return;
  }

  const currentDevice = database.getDeviceById(deviceId);

  if (!currentDevice) {
    response.status(404).json({
      message: "Texnika topilmadi.",
    });
    return;
  }

  const usageCount = database.getInventoryUsageByDeviceId(deviceId);

  if (usageCount > 0) {
    response.status(409).json({
      message: "Bu texnika inventar yozuvlariga bog'langan. Avval yozuvlarni boshqa texnikaga o'tkazing yoki texnikani nofaol qiling.",
    });
    return;
  }

  const device = database.deleteDevice(deviceId);

  database.logAudit({
    action: "catalog.device_delete",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: device,
    entityId: device.id,
    entityType: "device",
    ipAddress: request.ip,
    summary: `${device.name} texnikasi katalogdan o'chirildi.`,
  });

  response.status(204).end();
});

app.get("/api/users", requirePermission("manageUsers"), (_request, response) => {
  response.json({
    users: database.listUsers(),
  });
});

app.post("/api/users", requirePermission("manageUsers"), (request, response) => {
  const payload = validateUserPayload(request.body, { isCreate: true });

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  if (database.getUserByUsername(payload.data.username)) {
    response.status(409).json({
      message: "Bunday login bilan foydalanuvchi allaqachon mavjud.",
    });
    return;
  }

  const user = database.createUser({
    ...payload.data,
    passwordHash: hashPassword(payload.data.password),
  });

  database.logAudit({
    action: "user.create",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      fullName: user.fullName,
      role: user.role,
      username: user.username,
    },
    entityId: user.id,
    entityType: "user",
    ipAddress: request.ip,
    summary: `${user.username} foydalanuvchisi yaratildi.`,
  });

  response.status(201).json({
    user,
  });
});

app.put("/api/users/:id", requirePermission("manageUsers"), (request, response) => {
  const userId = parsePositiveInteger(request.params.id);
  const payload = validateUserPayload(request.body, { isCreate: false });

  if (!userId) {
    response.status(400).json({
      message: "Foydalanuvchi identifikatori noto'g'ri.",
    });
    return;
  }

  if (!payload.ok) {
    response.status(400).json({
      message: payload.message,
    });
    return;
  }

  const currentUser = database.getUserById(userId);

  if (!currentUser) {
    response.status(404).json({
      message: "Foydalanuvchi topilmadi.",
    });
    return;
  }

  const duplicate = database.getUserByUsername(payload.data.username);

  if (duplicate && duplicate.id !== userId) {
    response.status(409).json({
      message: "Bunday login bilan foydalanuvchi allaqachon mavjud.",
    });
    return;
  }

  const wouldRemoveAdminAccess =
    currentUser.role === "admin" &&
    currentUser.isActive &&
    (payload.data.role !== "admin" || !payload.data.isActive);

  if (wouldRemoveAdminAccess && database.countOtherActiveAdmins(userId) === 0) {
    response.status(400).json({
      message: "Oxirgi faol administratorning rolini yoki holatini pasaytirib bo'lmaydi.",
    });
    return;
  }

  const user = database.updateUser(userId, {
    ...payload.data,
    passwordHash: payload.data.password ? hashPassword(payload.data.password) : null,
  });

  database.logAudit({
    action: "user.update",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      after: user,
      before: currentUser,
    },
    entityId: user.id,
    entityType: "user",
    ipAddress: request.ip,
    summary: `${user.username} foydalanuvchisi yangilandi.`,
  });

  response.json({
    user,
  });
});

app.get("/api/audit-logs", requirePermission("viewAudit"), (request, response) => {
  const limit = Math.min(parsePositiveInteger(request.query.limit) || 100, 300);
  const logs = database.listAuditLogs({
    entityType: normalizeText(request.query.entityType, 40),
    limit,
    search: normalizeText(request.query.search, 120),
  });

  response.json({
    logs,
    refreshedAt: new Date().toISOString(),
    settings: database.getAuditSettings(),
  });
});

app.put("/api/audit-logs/settings", requirePermission("manageSettings"), (request, response) => {
  const retentionDays = parsePositiveInteger(request.body?.retentionDays);

  if (![30, 90, 180].includes(retentionDays)) {
    response.status(400).json({
      message: "Audit log auto-tozalash muddati faqat 30, 90 yoki 180 kun bo'lishi mumkin.",
    });
    return;
  }

  const settings = database.setAuditRetentionDays(retentionDays);
  database.logAudit({
    action: "audit.retention_update",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      deletedCount: settings.deletedCount,
      retentionDays: settings.retentionDays,
    },
    entityType: "audit",
    ipAddress: request.ip,
    summary: `Audit log auto-tozalash muddati ${settings.retentionDays} kun etib o'rnatildi.`,
  });

  response.json({
    pruned: {
      deletedCount: settings.deletedCount,
      prunedAt: settings.prunedAt,
      retentionDays: settings.retentionDays,
    },
    settings: database.getAuditSettings(),
  });
});

app.get("/api/audit-logs/archive", requirePermission("viewAudit"), (request, response) => {
  const limit = Math.min(parsePositiveInteger(request.query.limit) || 5000, 5000);
  const filters = {
    entityType: normalizeText(request.query.entityType, 40),
    limit,
    search: normalizeText(request.query.search, 120),
  };
  const logs = database.listAuditLogs(filters);
  const archivedAt = new Date().toISOString();
  const fileName = `audit-archive-${archivedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;

  database.logAudit({
    action: "audit.archive",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      archivedCount: logs.length,
      filters,
    },
    entityType: "audit",
    ipAddress: request.ip,
    summary: `${logs.length} ta audit yozuvi arxivlandi.`,
  });

  response.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Archive-Log-Count", String(logs.length));
  response.send(JSON.stringify({
    archivedAt,
    filters,
    logCount: logs.length,
    logs,
    settings: database.getAuditSettings(),
  }, null, 2));
});

app.use("/api", (_request, response) => {
  response.status(404).json({
    message: "So'ralgan API endpoint topilmadi.",
  });
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(400).json({
      message: "Import fayli juda katta yoki noto'g'ri formatda yuborildi.",
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    message: "Serverda kutilmagan xatolik yuz berdi.",
  });
});

const server = app.listen(config.port, () => {
  console.log(`Inventarizatsiya serveri ishga tushdi: http://localhost:${config.port}`);
  startAutomaticBackupScheduler();
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function requireAuth(request, response, next) {
  const authContext = getAuthContext(request, response);

  if (!authContext) {
    response.status(401).json({
      message: "Avval tizimga kiring.",
    });
    return;
  }

  request.user = authContext.user;
  request.permissions = getPermissions(authContext.user.role);
  next();
}

function requirePermission(permissionName) {
  return (request, response, next) => {
    if (!hasPermission(request.user.role, permissionName)) {
      response.status(403).json({
        message: "Sizda bu amalni bajarish huquqi yo'q.",
      });
      return;
    }

    next();
  };
}

function getAuthContext(request, response) {
  const cookies = parseCookies(request.headers.cookie || "");
  const sessionToken = cookies[config.cookieName];

  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = database.getSessionByTokenHash(tokenHash);

  if (!session) {
    clearAuthCookie(response);
    return null;
  }

  if (Date.parse(session.expiresAt) <= Date.now()) {
    database.deleteSessionByTokenHash(tokenHash);
    clearAuthCookie(response);
    return null;
  }

  const user = database.getUserById(session.userId);

  if (!user || !user.isActive) {
    database.deleteSessionByTokenHash(tokenHash);
    clearAuthCookie(response);
    return null;
  }

  if (Date.now() - Date.parse(session.lastSeenAt) >= config.sessionRefreshMs) {
    database.touchSession(session.id, new Date().toISOString());
  }

  return {
    user,
  };
}

function clearAuthCookie(response) {
  response.setHeader(
    "Set-Cookie",
    clearSessionCookie(config.cookieName, {
      path: "/",
      sameSite: "Lax",
      secure: config.secureCookies,
    })
  );
}

function buildSessionPayload(user) {
  return {
    mustChangePassword: Boolean(user.mustChangePassword),
    permissions: getPermissions(user.role),
    roles: listRoles(),
    user: sanitizeUser(user),
  };
}

function sanitizeUser(user) {
  return {
    fullName: user.fullName,
    id: user.id,
    isActive: Boolean(user.isActive),
    lastLoginAt: user.lastLoginAt || "",
    mustChangePassword: Boolean(user.mustChangePassword),
    role: user.role,
    username: user.username,
  };
}

function validateInventoryPayload(body) {
  const firstName = normalizeText(body?.firstName, 80);
  const lastName = normalizeText(body?.lastName, 80);
  const currentHolder = normalizeText(body?.currentHolder, 160);
  const previousHolder = normalizeText(body?.previousHolder, 160) || "-";
  const departmentId = parsePositiveInteger(body?.departmentId);
  const deviceId = parsePositiveInteger(body?.deviceId);
  const assetTag = normalizeText(body?.assetTag, 64);
  const serialNumber = normalizeText(body?.serialNumber, 120);
  const assetStatus = normalizeAssetStatus(body?.assetStatus);
  const conditionStatus = normalizeConditionStatus(body?.conditionStatus);
  const purchaseDate = parseDateInput(body?.purchaseDate);
  const purchasePrice = parseCurrencyValue(body?.purchasePrice);
  const assignedAt = parseDateInput(body?.assignedAt);
  const warrantyUntil = parseDateInput(body?.warrantyUntil);
  const supplier = normalizeText(body?.supplier, 120);
  const branch = normalizeText(body?.branch, 120);
  const room = normalizeText(body?.room, 60);
  const desk = normalizeText(body?.desk, 60);
  const officeLocation = normalizeText(body?.officeLocation, 120);
  const accessories = normalizeText(body?.accessories, 240);
  const notes = normalizeText(body?.notes, 500);

  if (!assetTag) {
    return {
      message: "Aktiv tegi yoki inventar raqami majburiy.",
      ok: false,
    };
  }

  if (!/^[A-Za-z0-9._/-]{2,64}$/.test(assetTag)) {
    return {
      message: "Aktiv tegi faqat harf, raqam, nuqta, chiziq va slashlardan iborat bo'lishi kerak.",
      ok: false,
    };
  }

  if (!firstName || !lastName || !currentHolder || !departmentId || !deviceId) {
    return {
      message: "Ism, familya, bo'lim, texnika, aktiv tegi va hozirgi egasi majburiy.",
      ok: false,
    };
  }

  if (!assetStatus || !isKnownAssetStatus(assetStatus)) {
    return {
      message: "Texnika statusi noto'g'ri tanlangan.",
      ok: false,
    };
  }

  if (!conditionStatus || !isKnownConditionStatus(conditionStatus)) {
    return {
      message: "Texnika holati noto'g'ri tanlangan.",
      ok: false,
    };
  }

  if (body?.purchaseDate && !purchaseDate) {
    return {
      message: "Sotib olingan sana formati noto'g'ri.",
      ok: false,
    };
  }

  if (body?.purchasePrice && purchasePrice == null) {
    return {
      message: "Sotib olish narxi noto'g'ri formatda.",
      ok: false,
    };
  }

  if (body?.assignedAt && !assignedAt) {
    return {
      message: "Biriktirilgan sana formati noto'g'ri.",
      ok: false,
    };
  }

  if (body?.warrantyUntil && !warrantyUntil) {
    return {
      message: "Kafolat muddati formati noto'g'ri.",
      ok: false,
    };
  }

  return {
    data: {
      accessories,
      assetStatus,
      assetTag,
      assignedAt,
      branch,
      conditionStatus,
      currentHolder,
      desk,
      departmentId,
      deviceId,
      firstName,
      lastName,
      notes,
      officeLocation,
      previousHolder,
      purchaseDate,
      purchasePrice: purchasePrice || 0,
      room,
      serialNumber,
      supplier,
      warrantyUntil,
    },
    ok: true,
  };
}

function validateTransferPayload(body) {
  const toHolder = normalizeText(body?.toHolder, 160);
  const departmentId = parsePositiveInteger(body?.departmentId);
  const assetStatus = normalizeAssetStatus(body?.assetStatus);
  const transferDate = parseDateInput(body?.transferDate) || new Date().toISOString().slice(0, 10);
  const notes = normalizeText(body?.notes, 500);

  if (!toHolder || !departmentId || !assetStatus) {
    return {
      message: "Yangi egasi, bo'lim va status majburiy.",
      ok: false,
    };
  }

  if (!isKnownAssetStatus(assetStatus)) {
    return {
      message: "Yangi status noto'g'ri tanlangan.",
      ok: false,
    };
  }

  if (body?.transferDate && !parseDateInput(body.transferDate)) {
    return {
      message: "O'tkazish sanasi noto'g'ri formatda.",
      ok: false,
    };
  }

  return {
    data: {
      assetStatus,
      departmentId,
      notes,
      toHolder,
      transferDate,
    },
    ok: true,
  };
}

function findDuplicateInventoryIdentifiers(data, currentRecordId = 0) {
  const byAssetTag = data.assetTag ? database.getInventoryByAssetTag(data.assetTag) : null;

  if (byAssetTag && byAssetTag.id !== currentRecordId) {
    return {
      assetTag: byAssetTag.assetTag,
      currentHolder: byAssetTag.currentHolder,
      deviceName: byAssetTag.deviceName,
      field: "assetTag",
      recordId: byAssetTag.id,
      value: data.assetTag,
    };
  }

  const bySerial = data.serialNumber ? database.getInventoryBySerialNumber(data.serialNumber) : null;

  if (bySerial && bySerial.id !== currentRecordId) {
    return {
      assetTag: bySerial.assetTag,
      currentHolder: bySerial.currentHolder,
      deviceName: bySerial.deviceName,
      field: "serialNumber",
      recordId: bySerial.id,
      value: data.serialNumber,
    };
  }

  return null;
}

function buildImportReview(rows) {
  const errors = [];
  const conflicts = [];
  const normalizedRows = [];
  const seenAssetTags = new Map();
  const seenSerialNumbers = new Map();

  rows.forEach((row) => {
    const validation = validateImportedInventoryRow(row);

    if (!validation.ok) {
      errors.push(`${row.rowNumber}-qator: ${validation.message}`);
      return;
    }

    const data = validation.data;
    const assetTagKey = data.assetTag.toLowerCase();
    const serialNumberKey = data.serialNumber.toLowerCase();

    if (assetTagKey && seenAssetTags.has(assetTagKey)) {
      conflicts.push({
        field: "assetTag",
        message: `${row.rowNumber}-qator: aktiv tegi ${seenAssetTags.get(assetTagKey)}-qatorda ham bor.`,
        rowNumber: row.rowNumber,
        type: "file_duplicate",
        value: data.assetTag,
      });
    } else if (assetTagKey) {
      seenAssetTags.set(assetTagKey, row.rowNumber);
    }

    if (serialNumberKey && seenSerialNumbers.has(serialNumberKey)) {
      conflicts.push({
        field: "serialNumber",
        message: `${row.rowNumber}-qator: serial raqam ${seenSerialNumbers.get(serialNumberKey)}-qatorda ham bor.`,
        rowNumber: row.rowNumber,
        type: "file_duplicate",
        value: data.serialNumber,
      });
    } else if (serialNumberKey) {
      seenSerialNumbers.set(serialNumberKey, row.rowNumber);
    }

    const duplicate = findDuplicateInventoryIdentifiers(data);

    if (duplicate) {
      conflicts.push({
        ...duplicate,
        message: `${row.rowNumber}-qator: ${duplicate.value} bazada mavjud.`,
        rowNumber: row.rowNumber,
        type: "existing_record",
      });
    }

    normalizedRows.push(data);
  });

  return {
    conflicts,
    errors,
    rows: normalizedRows,
  };
}

function validateImportedInventoryRow(row) {
  const firstName = normalizeText(row?.firstName, 80);
  const lastName = normalizeText(row?.lastName, 80);
  const department = normalizeText(row?.department, 120);
  const deviceName = normalizeText(row?.deviceName, 160);
  const currentHolder = normalizeText(row?.currentHolder, 160);
  const previousHolder = normalizeText(row?.previousHolder, 160) || "-";
  const assetTag = normalizeText(row?.assetTag, 64);
  const serialNumber = normalizeText(row?.serialNumber, 120);
  const assetStatus = normalizeAssetStatus(row?.assetStatus);
  const conditionStatus = normalizeConditionStatus(row?.conditionStatus);
  const purchaseDate = parseDateInput(row?.purchaseDate);
  const purchasePrice = parseCurrencyValue(row?.purchasePrice);
  const assignedAt = parseDateInput(row?.assignedAt);
  const warrantyUntil = parseDateInput(row?.warrantyUntil);
  const supplier = normalizeText(row?.supplier, 120);
  const branch = normalizeText(row?.branch, 120);
  const room = normalizeText(row?.room, 60);
  const desk = normalizeText(row?.desk, 60);
  const officeLocation = normalizeText(row?.officeLocation, 120);
  const accessories = normalizeText(row?.accessories, 240);
  const notes = normalizeText(row?.notes, 500);

  if (!assetTag) {
    return {
      message: "aktiv tegi yoki inventar raqami majburiy.",
      ok: false,
    };
  }

  if (!/^[A-Za-z0-9._/-]{2,64}$/.test(assetTag)) {
    return {
      message: "aktiv tegi noto'g'ri formatda.",
      ok: false,
    };
  }

  if (!firstName || !lastName || !department || !deviceName || !currentHolder) {
    return {
      message: "majburiy maydonlar to'liq emas.",
      ok: false,
    };
  }

  if (!assetStatus || !isKnownAssetStatus(assetStatus)) {
    return {
      message: "status qiymati noto'g'ri.",
      ok: false,
    };
  }

  if (!conditionStatus || !isKnownConditionStatus(conditionStatus)) {
    return {
      message: "holat qiymati noto'g'ri.",
      ok: false,
    };
  }

  if (row?.purchaseDate && !purchaseDate) {
    return {
      message: "sotib olingan sana formati noto'g'ri.",
      ok: false,
    };
  }

  if (row?.purchasePrice && purchasePrice == null) {
    return {
      message: "sotib olish narxi noto'g'ri.",
      ok: false,
    };
  }

  if (row?.assignedAt && !assignedAt) {
    return {
      message: "biriktirilgan sana formati noto'g'ri.",
      ok: false,
    };
  }

  if (row?.warrantyUntil && !warrantyUntil) {
    return {
      message: "kafolat muddati formati noto'g'ri.",
      ok: false,
    };
  }

  return {
    data: {
      accessories,
      assetStatus,
      assetTag,
      assignedAt,
      branch,
      conditionStatus,
      currentHolder,
      desk,
      department,
      deviceName,
      firstName,
      lastName,
      notes,
      officeLocation,
      previousHolder,
      purchaseDate,
      purchasePrice: purchasePrice || 0,
      room,
      serialNumber,
      supplier,
      warrantyUntil,
    },
    ok: true,
  };
}

function validateServiceLogPayload(body) {
  const serviceDate = parseDateInput(body?.serviceDate);
  const serviceType = normalizeText(body?.serviceType, 80);
  const vendor = normalizeText(body?.vendor, 120);
  const cost = parseCurrencyValue(body?.cost) || 0;
  const notes = normalizeText(body?.notes, 400);

  if (!serviceDate || !serviceType) {
    return {
      message: "Servis sanasi va turi majburiy.",
      ok: false,
    };
  }

  return {
    data: {
      cost,
      notes,
      serviceDate,
      serviceType,
      vendor,
    },
    ok: true,
  };
}

function validateDepartmentPayload(body) {
  const name = normalizeText(body?.name, 120);
  const code = normalizeText(body?.code, 30);
  const description = normalizeText(body?.description, 240);
  const isActive = parseBoolean(body?.isActive, true);

  if (!name) {
    return {
      message: "Bo'lim nomi majburiy.",
      ok: false,
    };
  }

  return {
    data: {
      code,
      description,
      isActive,
      name,
    },
    ok: true,
  };
}

function validateDevicePayload(body) {
  const name = normalizeText(body?.name, 160);
  const category = normalizeText(body?.category, 80);
  const model = normalizeText(body?.model, 120);
  const description = normalizeText(body?.description, 240);
  const isActive = parseBoolean(body?.isActive, true);

  if (!name) {
    return {
      message: "Texnika nomi majburiy.",
      ok: false,
    };
  }

  return {
    data: {
      category,
      description,
      isActive,
      model,
      name,
    },
    ok: true,
  };
}

function validateUserPayload(body, options) {
  const fullName = normalizeText(body?.fullName, 120);
  const username = normalizeText(body?.username, 64);
  const password = typeof body?.password === "string" ? body.password.trim() : "";
  const role = normalizeText(body?.role, 30);
  const isActive = parseBoolean(body?.isActive, true);
  const mustChangePassword = parseBoolean(body?.mustChangePassword, false);

  if (!fullName || !username || !role) {
    return {
      message: "F.I.Sh., login va rol majburiy.",
      ok: false,
    };
  }

  if (!isKnownRole(role)) {
    return {
      message: "Noma'lum foydalanuvchi roli tanlandi.",
      ok: false,
    };
  }

  if (options.isCreate && password.length < 6) {
    return {
      message: "Yangi foydalanuvchi uchun kamida 6 belgili parol kiriting.",
      ok: false,
    };
  }

  if (!options.isCreate && password && password.length < 6) {
    return {
      message: "Yangi parol kamida 6 belgidan iborat bo'lishi kerak.",
      ok: false,
    };
  }

  return {
    data: {
      fullName,
      isActive,
      mustChangePassword,
      password,
      role,
      username,
    },
    ok: true,
  };
}

function getInventoryFilters(query) {
  return {
    assetStatus: normalizeText(query.assetStatus, 40),
    conditionStatus: normalizeText(query.conditionStatus, 40),
    departmentId: parsePositiveInteger(query.departmentId),
    deviceId: parsePositiveInteger(query.deviceId),
    page: parsePositiveInteger(query.page) || 1,
    pageSize: parsePositiveInteger(query.pageSize) || 25,
    search: normalizeText(query.search, 120),
    sortBy: normalizeText(query.sortBy, 40),
    sortDir: normalizeText(query.sortDir, 10),
  };
}

function normalizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBoolean(value, defaultValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }

    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return defaultValue;
}

function parseDateInput(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return "";
  }

  return normalized;
}

function parseCurrencyValue(value) {
  if (value == null || value === "") {
    return 0;
  }

  const normalized = String(value).replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function createCsv(records) {
  const headers = [
    "Ism",
    "Familya",
    "Bo'lim",
    "Texnika nomi",
    "Asset tag",
    "Serial raqam",
    "Status",
    "Holati",
    "Sotib olingan sana",
    "Sotib olish narxi",
    "Biriktirilgan sana",
    "Kafolat muddati",
    "Yetkazib beruvchi",
    "Filial",
    "Xona",
    "Stol",
    "Joylashuv",
    "Qo'shimcha texnikalar",
    "Izoh",
    "Oldin kimda",
    "Hozir kimda",
    "Yaratilgan sana",
    "Yangilangan sana",
  ];

  const rows = records.map((record) => [
    record.firstName,
    record.lastName,
    record.department,
    record.deviceName,
    record.assetTag,
    record.serialNumber,
    getAssetStatusLabel(record.assetStatus),
    getConditionStatusLabel(record.conditionStatus),
    record.purchaseDate,
    record.purchasePrice,
    record.assignedAt,
    record.warrantyUntil,
    record.supplier,
    record.branch,
    record.room,
    record.desk,
    record.officeLocation,
    record.accessories,
    record.notes,
    record.previousHolder,
    record.currentHolder,
    formatDate(record.createdAt),
    formatDate(record.updatedAt),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

function escapeCsvValue(value) {
  const safeValue = String(value ?? "");
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function requirePasswordRefresh(request, response, next) {
  if (!request.user.mustChangePassword) {
    next();
    return;
  }

  response.status(403).json({
    code: "PASSWORD_CHANGE_REQUIRED",
    message: "Avval parolni yangilang.",
  });
}

function applySecurityHeaders(_request, response, next) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' https://fonts.gstatic.com data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "media-src 'self'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    ].join("; ")
  );

  if (config.secureCookies) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

function sanitizeFileName(value) {
  return String(value || "file")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function buildQrValue(record, request) {
  const baseUrl = config.appBaseUrl || `${request.protocol}://${request.get("host")}`;

  return `${baseUrl}/?assetTag=${encodeURIComponent(record.assetTag || record.deviceName)}&recordId=${record.id}`;
}

function buildPrintableReport(summary) {
  const stats = summary.overview?.stats || {};
  const rows = [
    ["Jami aktivlar", stats.totalRecords || 0],
    ["Ishlatilmoqda", stats.inUseCount || 0],
    ["Zaxirada", stats.inStockCount || 0],
    ["Ta'mirda", stats.repairCount || 0],
    ["Kafolat yaqin", stats.warrantyExpiringCount || 0],
    ["Qo'shimcha texnikali", stats.accessoryCount || 0],
  ]
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(String(value))}</td></tr>`)
    .join("");

  return `<!doctype html>
  <html lang="uz">
  <head>
    <meta charset="utf-8">
    <title>Inventory Report</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { margin-bottom: 8px; }
      table { border-collapse: collapse; width: 100%; max-width: 760px; }
      td, th { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
      th { background: #eff6ff; }
      .meta { color: #64748b; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <h1>Inventar Hisobot</h1>
    <p class="meta">Yaratilgan vaqt: ${escapeHtml(summary.generatedAt)}</p>
    <table>
      <thead><tr><th>Ko'rsatkich</th><th>Qiymat</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
  </html>`;
}

function clearDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }

  fs.readdirSync(targetPath).forEach((entry) => {
    const fullPath = path.join(targetPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { force: true, recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBackupPayloadWithFiles() {
  const payload = database.exportBackupPayload();
  payload.files = payload.data.attachments.map((attachment) => ({
    fileName: attachment.file_name,
    filePath: attachment.file_path,
    id: attachment.id,
    mimeType: attachment.mime_type,
    storedName: attachment.stored_name,
    contentBase64: attachment.file_path && fs.existsSync(attachment.file_path)
      ? fs.readFileSync(attachment.file_path).toString("base64")
      : "",
  }));
  return payload;
}

function writeBackupSnapshot({ initiatedByUserId = null, prefix = "inventory-backup", summary }) {
  const payload = buildBackupPayloadWithFiles();
  const fileName = `${prefix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  const backupPath = path.join(config.backupsDir, fileName);
  fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), "utf8");
  database.createBackupRun(fileName, summary, initiatedByUserId);
  const prunedFiles = pruneStoredBackupFiles(config.backupsDir, database.getAutoBackupSettings().keepDays, fileName);

  return {
    backupPath,
    fileName,
    payload,
    prunedFiles,
  };
}

function pruneStoredBackupFiles(backupsDir, keepDays, latestFileName = "") {
  const normalizedKeepDays = Math.max(1, Number(keepDays) || config.autoBackupKeepDays || 14);
  const cutoffTime = Date.now() - normalizedKeepDays * 24 * 60 * 60 * 1000;
  const backupFiles = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir) : [];
  let deletedCount = 0;

  backupFiles.forEach((fileName) => {
    if (fileName === latestFileName || !/^inventory-backup.*\.json$/i.test(fileName)) {
      return;
    }

    const filePath = path.join(backupsDir, fileName);
    const fileStat = fs.statSync(filePath);

    if (fileStat.mtimeMs >= cutoffTime) {
      return;
    }

    fs.unlinkSync(filePath);
    deletedCount += 1;
  });

  return deletedCount;
}

function startAutomaticBackupScheduler() {
  scheduleNextAutomaticBackup();
}

function scheduleNextAutomaticBackup() {
  if (autoBackupTimerId) {
    clearTimeout(autoBackupTimerId);
  }

  const delayMs = getNextAutomaticBackupDelayMs();
  autoBackupTimerId = setTimeout(() => {
    runAutomaticBackup().catch((error) => {
      console.error("Avtomatik backup bajarilmadi.", error);
    });
  }, delayMs);
}

function getNextAutomaticBackupDelayMs(now = new Date()) {
  const settings = database.getAutoBackupSettings();

  if (!settings.enabled) {
    return 12 * 60 * 60 * 1000;
  }

  if (config.autoBackupIntervalMs > 0) {
    return config.autoBackupIntervalMs;
  }

  const scheduledAt = new Date(now);
  scheduledAt.setHours(settings.hour, 0, 0, 0);
  const lastRunAt = settings.lastRunAt ? new Date(settings.lastRunAt) : null;

  if (now >= scheduledAt) {
    if (!lastRunAt || !isSameCalendarDay(lastRunAt, now)) {
      return 30 * 1000;
    }

    const nextRun = new Date(scheduledAt);
    nextRun.setDate(nextRun.getDate() + 1);
    return Math.max(60 * 1000, nextRun.getTime() - now.getTime());
  }

  return Math.max(60 * 1000, scheduledAt.getTime() - now.getTime());
}

async function runAutomaticBackup() {
  if (autoBackupInFlight) {
    return;
  }

  const settings = database.getAutoBackupSettings();

  if (!settings.enabled) {
    scheduleNextAutomaticBackup();
    return;
  }

  autoBackupInFlight = true;
  const startedAt = new Date().toISOString();

  try {
    const backup = writeBackupSnapshot({
      prefix: "inventory-backup-auto",
      summary: "Avtomatik kunlik zaxira nusxasi yaratildi.",
    });
    const statusText = backup.prunedFiles
      ? `Muvaffaqiyatli, ${backup.prunedFiles} ta eski backup tozalandi.`
      : "Muvaffaqiyatli";
    database.setAutoBackupMeta({
      lastFileName: backup.fileName,
      lastRunAt: startedAt,
      lastStatus: statusText,
    });
    database.logAudit({
      action: "system.backup_auto",
      actorName: "System Scheduler",
      actorRole: "system",
      actorUsername: "system",
      details: {
        fileName: backup.fileName,
        prunedFiles: backup.prunedFiles,
      },
      entityType: "system",
      ipAddress: "127.0.0.1",
      summary: `Avtomatik backup yaratildi: ${backup.fileName}.`,
    });
    console.log(`Avtomatik backup tayyor: ${backup.fileName}`);
  } catch (error) {
    database.setAutoBackupMeta({
      lastRunAt: startedAt,
      lastStatus: `Xatolik: ${String(error.message || error).slice(0, 160)}`,
    });
    throw error;
  } finally {
    autoBackupInFlight = false;
    scheduleNextAutomaticBackup();
  }
}

function isSameCalendarDay(leftDate, rightDate) {
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function shutdown() {
  if (autoBackupTimerId) {
    clearTimeout(autoBackupTimerId);
  }

  server.close(() => {
    database.close();
    process.exit(0);
  });
}
