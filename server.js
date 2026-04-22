const path = require("node:path");
const express = require("express");
const multer = require("multer");

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
  getPermissions,
  hasPermission,
  isKnownRole,
  listRoles,
} = require("./src/permissions");

const app = express();
const upload = multer({
  limits: {
    fileSize: config.maxImportBytes,
  },
  storage: multer.memoryStorage(),
});
const database = createDatabase(config);

app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
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

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    database.logAudit({
      action: "auth.login_failed",
      actorName: user?.fullName || null,
      actorRole: user?.role || "guest",
      actorUserId: user?.id || null,
      actorUsername: requestedUser,
      details: {
        username: requestedUser,
      },
      entityType: "auth",
      ipAddress: request.ip,
      summary: "Muvaffaqiyatsiz login urinish.",
    });

    response.status(401).json({
      message: "Login yoki parol noto'g'ri.",
    });
    return;
  }

  const sessionToken = createSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();

  database.createSession(user.id, hashSessionToken(sessionToken), expiresAt);
  database.logAudit({
    action: "auth.login_success",
    actorName: user.fullName,
    actorRole: user.role,
    actorUserId: user.id,
    actorUsername: user.username,
    details: {
      expiresAt,
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
    ...buildSessionPayload(user),
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

app.use("/api", requireAuth);

app.get("/api/dashboard", (request, response) => {
  const permissions = getPermissions(request.user.role);

  response.json({
    auditLogs: permissions.viewAudit ? database.listAuditLogs({ limit: 50 }) : [],
    departments: database.listDepartments(),
    devices: database.listDevices(),
    roles: listRoles(),
    user: sanitizeUser(request.user),
    users: permissions.manageUsers ? database.listUsers() : [],
  });
});

app.get("/api/inventory", requirePermission("viewInventory"), (request, response) => {
  const filters = getInventoryFilters(request.query);

  response.json({
    records: database.listInventory(filters),
    stats: database.getInventoryStats(filters),
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

  const record = database.createInventory(payload.data, request.user.id);

  database.logAudit({
    action: "inventory.create",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      currentHolder: record.currentHolder,
      department: record.department,
      deviceName: record.deviceName,
    },
    entityId: record.id,
    entityType: "inventory",
    ipAddress: request.ip,
    summary: `${record.deviceName} ${record.currentHolder} ga biriktirildi.`,
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

  const record = database.updateInventory(recordId, payload.data, request.user.id);

  database.logAudit({
    action: "inventory.update",
    actorName: request.user.fullName,
    actorRole: request.user.role,
    actorUserId: request.user.id,
    actorUsername: request.user.username,
    details: {
      after: {
        currentHolder: record.currentHolder,
        department: record.department,
        deviceName: record.deviceName,
      },
      before: {
        currentHolder: existing.currentHolder,
        department: existing.department,
        deviceName: existing.deviceName,
      },
    },
    entityId: record.id,
    entityType: "inventory",
    ipAddress: request.ip,
    summary: `${record.deviceName} bo'yicha yozuv yangilandi.`,
  });

  response.json({
    record,
  });
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
  upload.single("file"),
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

    const validationError = rows.find((row) => {
      return !row.firstName || !row.lastName || !row.department || !row.deviceName || !row.currentHolder;
    });

    if (validationError) {
      response.status(400).json({
        message: `${validationError.rowNumber}-qatorda majburiy maydonlar to'liq emas.`,
      });
      return;
    }

    const result = database.importInventoryRows(rows, request.user.id);

    database.logAudit({
      action: "inventory.import",
      actorName: request.user.fullName,
      actorRole: request.user.role,
      actorUserId: request.user.id,
      actorUsername: request.user.username,
      details: result,
      entityType: "inventory",
      ipAddress: request.ip,
      summary: `${result.insertedCount} ta inventar yozuvi Excel orqali import qilindi.`,
    });

    response.status(201).json({
      result,
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
  });
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

  if (!firstName || !lastName || !currentHolder || !departmentId || !deviceId) {
    return {
      message: "Ism, familya, bo'lim, texnika va hozirgi egasi majburiy.",
      ok: false,
    };
  }

  return {
    data: {
      currentHolder,
      departmentId,
      deviceId,
      firstName,
      lastName,
      previousHolder,
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
      password,
      role,
      username,
    },
    ok: true,
  };
}

function getInventoryFilters(query) {
  return {
    departmentId: parsePositiveInteger(query.departmentId),
    deviceId: parsePositiveInteger(query.deviceId),
    search: normalizeText(query.search, 120),
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

function createCsv(records) {
  const headers = [
    "Ism",
    "Familya",
    "Bo'lim",
    "Texnika nomi",
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

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
