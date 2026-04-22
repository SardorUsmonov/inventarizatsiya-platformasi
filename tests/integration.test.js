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
      currentHolder: "Ali Karimov",
      departmentId: department.payload.department.id,
      deviceId: device.payload.device.id,
      firstName: "Ali",
      lastName: "Karimov",
      previousHolder: "-",
    },
    method: "POST",
  });

  assert.equal(record.response.status, 201);

  const inventory = await admin.request("/api/inventory?search=Latitude");
  assert.equal(inventory.response.status, 200);
  assert.equal(inventory.payload.records.length, 1);

  const csvExport = await admin.request("/api/inventory/export/csv");
  assert.equal(csvExport.response.status, 200);
  assert.match(csvExport.text, /Dell Latitude 5520/);

  const xlsxExport = await admin.request("/api/inventory/export/xlsx");
  assert.equal(xlsxExport.response.status, 200);
  assert.ok(xlsxExport.buffer.length > 1000);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxExport.buffer);
  assert.ok(workbook.worksheets[0].rowCount >= 2);

  const audit = await admin.request("/api/audit-logs?entityType=inventory");
  assert.equal(audit.response.status, 200);
  assert.ok(audit.payload.logs.length >= 1);
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
  sheet.addRow(["Ism", "Familya", "Bo'lim", "Texnika nomi", "Oldin kimda", "Hozir kimda"]);
  sheet.addRow(["Malika", "Tursunova", "Buxgalteriya", "HP ProBook 450", "-", "Malika Tursunova"]);
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

  const logout = await admin.request("/api/auth/logout", { method: "POST" });
  assert.equal(logout.response.status, 204);

  const session = await admin.request("/api/session");
  assert.equal(session.response.status, 401);
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
