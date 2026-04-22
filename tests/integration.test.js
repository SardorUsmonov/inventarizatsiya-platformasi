const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ExcelJS = require("exceljs");

const PROJECT_DIR = path.resolve(__dirname, "..");
const PORT = 3456;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess;
let tempDir;

test.before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "inventory-platform-"));
  const databasePath = path.join(tempDir, "inventory.sqlite");

  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: PROJECT_DIR,
    env: {
      ...process.env,
      ADMIN_FULL_NAME: "Test Admin",
      ADMIN_PASSWORD: "Admin123!",
      ADMIN_USERNAME: "admin",
      DATABASE_PATH: databasePath,
      FORCE_DEFAULT_ADMIN_PASSWORD_CHANGE: "false",
      PORT: String(PORT),
    },
    stdio: "ignore",
  });

  await waitForServer();
});

test.after(async () => {
  if (serverProcess && !serverProcess.killed) {
    const exitPromise = new Promise((resolve) => {
      serverProcess.once("exit", resolve);
    });

    serverProcess.kill("SIGTERM");
    await exitPromise;
  }

  await fs.rm(tempDir, { force: true, recursive: true });
});

test("admin can manage catalogs, inventory, export and audit", { concurrency: false }, async () => {
  const admin = createClient();
  const login = await admin.request("/api/auth/login", {
    body: {
      password: "Admin123!",
      username: "admin",
    },
    method: "POST",
  });

  assert.equal(login.response.status, 200);
  assert.equal(login.payload.user.role, "admin");

  const dashboard = await admin.request("/api/dashboard");
  assert.equal(dashboard.response.status, 200);
  assert.ok(dashboard.payload.departments.some((item) => item.name === "DevOps & SRE"));
  assert.ok(dashboard.payload.devices.some((item) => item.name === "Dell Latitude 7440"));
  assert.ok(Array.isArray(dashboard.payload.inventoryMeta.assetStatuses));
  assert.ok(Array.isArray(dashboard.payload.inventoryMeta.conditionStatuses));

  const department = await admin.request("/api/departments", {
    body: {
      code: "IT",
      description: "IT bo'limi",
      isActive: true,
      name: "IT bo'limi",
    },
    method: "POST",
  });

  const device = await admin.request("/api/devices", {
    body: {
      category: "Laptop",
      description: "Ishchi noutbuk",
      isActive: true,
      model: "Latitude 5520",
      name: "Dell Latitude 5520",
    },
    method: "POST",
  });

  const record = await admin.request("/api/inventory", {
    body: {
      accessories: "Dell dock, Logitech mouse",
      assetStatus: "in_use",
      assetTag: "NB-5520-01",
      assignedAt: "2026-02-01",
      conditionStatus: "excellent",
      currentHolder: "Ali Karimov",
      departmentId: department.payload.department.id,
      deviceId: device.payload.device.id,
      firstName: "Ali",
      lastName: "Karimov",
      notes: "Backend engineer uchun asosiy noutbuk",
      officeLocation: "Toshkent HQ",
      previousHolder: "-",
      purchaseDate: "2026-01-10",
      serialNumber: "SN-5520-001",
      supplier: "Dell Uzbekistan",
      warrantyUntil: "2028-01-10",
    },
    method: "POST",
  });

  assert.equal(record.response.status, 201);
  assert.equal(record.payload.record.assetTag, "NB-5520-01");
  assert.equal(record.payload.record.assetStatus, "in_use");
  assert.equal(record.payload.record.conditionStatus, "excellent");

  const inventory = await admin.request("/api/inventory?search=NB-5520-01");
  assert.equal(inventory.response.status, 200);
  assert.equal(inventory.payload.records.length, 1);
  assert.equal(inventory.payload.records[0].serialNumber, "SN-5520-001");

  const refreshedDashboard = await admin.request("/api/dashboard");
  assert.equal(refreshedDashboard.payload.overview.stats.inUseCount, 1);
  assert.equal(refreshedDashboard.payload.overview.stats.purchasedThisYearCount, 1);
  assert.equal(refreshedDashboard.payload.overview.recentPurchases[0].assetTag, "NB-5520-01");

  const csvExport = await admin.request("/api/inventory/export/csv");
  assert.equal(csvExport.response.status, 200);
  assert.match(csvExport.text, /Dell Latitude 5520/);
  assert.match(csvExport.text, /NB-5520-01/);

  const xlsxExport = await admin.request("/api/inventory/export/xlsx");
  assert.equal(xlsxExport.response.status, 200);
  assert.ok(xlsxExport.buffer.length > 1000);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxExport.buffer);
  assert.ok(workbook.worksheets[0].rowCount >= 2);

  const audit = await admin.request("/api/audit-logs?entityType=inventory");
  assert.equal(audit.response.status, 200);
  assert.ok(audit.payload.logs.length >= 1);

  const blockedDepartmentDelete = await admin.request(`/api/departments/${department.payload.department.id}`, {
    method: "DELETE",
  });
  assert.equal(blockedDepartmentDelete.response.status, 409);

  const blockedDeviceDelete = await admin.request(`/api/devices/${device.payload.device.id}`, {
    method: "DELETE",
  });
  assert.equal(blockedDeviceDelete.response.status, 409);

  const removableDepartment = await admin.request("/api/departments", {
    body: {
      code: "LAB",
      description: "Temporary lab",
      isActive: true,
      name: "Lab Support",
    },
    method: "POST",
  });
  assert.equal(removableDepartment.response.status, 201);

  const removableDevice = await admin.request("/api/devices", {
    body: {
      category: "Peripheral",
      description: "Temporary spare hardware",
      isActive: true,
      model: "Travel Hub",
      name: "USB-C Travel Hub",
    },
    method: "POST",
  });
  assert.equal(removableDevice.response.status, 201);

  const deletedDepartment = await admin.request(`/api/departments/${removableDepartment.payload.department.id}`, {
    method: "DELETE",
  });
  assert.equal(deletedDepartment.response.status, 204);

  const deletedDevice = await admin.request(`/api/devices/${removableDevice.payload.device.id}`, {
    method: "DELETE",
  });
  assert.equal(deletedDevice.response.status, 204);
});

test("viewer is restricted from modifying inventory", { concurrency: false }, async () => {
  const admin = createClient();
  await admin.request("/api/auth/login", {
    body: {
      password: "Admin123!",
      username: "admin",
    },
    method: "POST",
  });

  const createdUser = await admin.request("/api/users", {
    body: {
      fullName: "Viewer User",
      isActive: true,
      password: "Viewer123!",
      role: "viewer",
      username: "viewer",
    },
    method: "POST",
  });

  assert.equal(createdUser.response.status, 201);

  const viewer = createClient();
  const viewerLogin = await viewer.request("/api/auth/login", {
    body: {
      password: "Viewer123!",
      username: "viewer",
    },
    method: "POST",
  });

  assert.equal(viewerLogin.payload.user.role, "viewer");

  const viewerInventory = await viewer.request("/api/inventory");
  assert.equal(viewerInventory.response.status, 200);

  const forbiddenCreate = await viewer.request("/api/inventory", {
    body: {
      currentHolder: "Viewer User",
      departmentId: 1,
      deviceId: 1,
      firstName: "Viewer",
      lastName: "User",
      previousHolder: "-",
    },
    method: "POST",
  });

  assert.equal(forbiddenCreate.response.status, 403);
});

test("excel import works and logout clears session", { concurrency: false }, async () => {
  const admin = createClient();
  await admin.request("/api/auth/login", {
    body: {
      password: "Admin123!",
      username: "admin",
    },
    method: "POST",
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventar");
  sheet.addRow([
    "Ism",
    "Familya",
    "Bo'lim",
    "Texnika nomi",
    "Asset tag",
    "Status",
    "Holati",
    "Sotib olingan sana",
    "Kafolat muddati",
    "Qo'shimcha texnikalar",
    "Oldin kimda",
    "Hozir kimda",
  ]);
  sheet.addRow([
    "Malika",
    "Tursunova",
    "Buxgalteriya",
    "HP ProBook 450",
    "NB-PROBOOK-01",
    "Ishlatilmoqda",
    "Yaxshi",
    "2026-03-01",
    "2028-03-01",
    "Sichqoncha, sumka",
    "-",
    "Malika Tursunova",
  ]);
  const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([fileBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "import.xlsx"
  );

  const imported = await admin.request("/api/inventory/import", {
    body: formData,
    method: "POST",
  });

  assert.equal(imported.response.status, 201);
  assert.equal(imported.payload.result.insertedCount, 1);
  assert.ok(imported.payload.result.createdDepartments.includes("Buxgalteriya"));

  const search = await admin.request("/api/inventory?search=ProBook");
  assert.equal(search.payload.records.length, 1);
  assert.equal(search.payload.records[0].assetTag, "NB-PROBOOK-01");
  assert.equal(search.payload.records[0].accessories, "Sichqoncha, sumka");

  const logout = await admin.request("/api/auth/logout", { method: "POST" });
  assert.equal(logout.response.status, 204);

  const session = await admin.request("/api/session");
  assert.equal(session.response.status, 401);
});

test("must change password flow blocks dashboard until password is updated", { concurrency: false }, async () => {
  const admin = createClient();
  await admin.request("/api/auth/login", {
    body: {
      password: "Admin123!",
      username: "admin",
    },
    method: "POST",
  });

  const createdUser = await admin.request("/api/users", {
    body: {
      fullName: "Forced Password User",
      isActive: true,
      mustChangePassword: true,
      password: "Force123!",
      role: "manager",
      username: "forced-user",
    },
    method: "POST",
  });

  assert.equal(createdUser.response.status, 201);
  assert.equal(createdUser.payload.user.mustChangePassword, true);

  const userClient = createClient();
  const login = await userClient.request("/api/auth/login", {
    body: {
      password: "Force123!",
      username: "forced-user",
    },
    method: "POST",
  });

  assert.equal(login.response.status, 200);
  assert.equal(login.payload.user.mustChangePassword, true);

  const blockedDashboard = await userClient.request("/api/dashboard");
  assert.equal(blockedDashboard.response.status, 403);

  const passwordChange = await userClient.request("/api/auth/change-password", {
    body: {
      confirmPassword: "Force1234!",
      currentPassword: "Force123!",
      newPassword: "Force1234!",
    },
    method: "POST",
  });

  assert.equal(passwordChange.response.status, 200);

  const staleSession = await userClient.request("/api/session");
  assert.equal(staleSession.response.status, 401);

  const relogin = await userClient.request("/api/auth/login", {
    body: {
      password: "Force1234!",
      username: "forced-user",
    },
    method: "POST",
  });

  assert.equal(relogin.response.status, 200);
  assert.equal(relogin.payload.user.mustChangePassword, false);

  const dashboard = await userClient.request("/api/dashboard");
  assert.equal(dashboard.response.status, 200);
});

function createClient() {
  const cookieJar = new Map();

  return {
    async request(resourcePath, options = {}) {
      const headers = new Headers(options.headers || {});

      if (cookieJar.size) {
        headers.set(
          "cookie",
          [...cookieJar.values()].join("; ")
        );
      }

      let body = options.body;

      if (body && !(body instanceof FormData)) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(body);
      }

      const response = await fetch(`${BASE_URL}${resourcePath}`, {
        body,
        headers,
        method: options.method || "GET",
      });

      storeCookies(cookieJar, response);

      const contentType = response.headers.get("content-type") || "";
      let payload = null;
      let buffer = Buffer.alloc(0);
      let text = "";

      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        buffer = Buffer.from(await response.arrayBuffer());
        text = buffer.toString("utf8");
      }

      return {
        buffer,
        payload,
        response,
        text,
      };
    },
  };
}

function storeCookies(cookieJar, response) {
  const rawCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : [];

  rawCookies.forEach((cookie) => {
    const pair = cookie.split(";")[0];
    const [name] = pair.split("=");
    cookieJar.set(name, pair);
  });
}

async function waitForServer() {
  const timeoutAt = Date.now() + 15000;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);

      if (response.ok) {
        return;
      }
    } catch (_error) {
    }

    await sleep(300);
  }

  throw new Error("Server testlar uchun ishga tushmadi.");
}

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}
