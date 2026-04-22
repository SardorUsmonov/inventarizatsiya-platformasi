import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const serviceId = process.env.RENDER_SERVICE_ID || "srv-d7jnb23bc2fs739hu550";
const siteBase = normalizeUrl(process.env.RENDER_SITE_URL || "https://inventarizatsiya-platformasi.onrender.com");
const adminUsername = process.env.RENDER_ADMIN_USERNAME || "Admin";
const adminPassword = process.env.RENDER_ADMIN_PASSWORD || "qwerty2026";
const diskName = process.env.RENDER_DISK_NAME || "data";
const diskMountPath = process.env.RENDER_DISK_MOUNT_PATH || "/app/data";
const diskSizeGb = Number(process.env.RENDER_DISK_SIZE_GB || 1);
const expectedPlan = process.env.RENDER_EXPECTED_PLAN || "starter";
const renderCli = path.resolve(process.env.RENDER_CLI_PATH || ".tools/render-cli/cli_v2.15.1.exe");
const cliConfigPath =
  process.env.RENDER_CLI_CONFIG_PATH || path.join(os.homedir(), ".render", "cli.yaml");

main().catch((error) => {
  console.error("");
  console.error(error?.message || String(error));
  process.exit(1);
});

async function main() {
  const cliConfig = fs.readFileSync(cliConfigPath, "utf8");
  const apiKey = matchValue(cliConfig, /key:\s*(\S+)/);
  const apiHost = matchValue(cliConfig, /host:\s*(\S+)/) || "https://api.render.com/v1/";
  const apiBase = apiHost.replace(/\/+$/, "");

  const backupPath =
    process.env.RENDER_PERSIST_BACKUP_PATH ||
    path.join(os.tmpdir(), `inventory-render-backup-${Date.now()}.json`);

  console.log("1/7 Zaxira nusxasi olinmoqda...");
  const beforeClient = await createSiteClient(siteBase);
  await beforeClient.login(adminUsername, adminPassword);
  const beforeCounts = await getCounts(beforeClient);
  const backupBytes = await beforeClient.downloadBackup(backupPath);
  console.log(`Backup saqlandi: ${backupPath} (${backupBytes} bayt)`);

  console.log("2/7 Render service holati tekshirilmoqda...");
  const serviceBefore = getService(serviceId);
  const disksBefore = await listDisks(apiBase, apiKey);

  if (serviceBefore.serviceDetails.plan !== expectedPlan) {
    console.log(`3/7 Service plan '${expectedPlan}' ga o'tkazilmoqda...`);
    try {
      runRenderCli([
        "services",
        "update",
        serviceId,
        "--plan",
        expectedPlan,
        "--output",
        "json",
        "--confirm",
      ]);
    } catch (error) {
      throw enrichBillingError(error, backupPath);
    }
  } else {
    console.log(`3/7 Service allaqachon '${expectedPlan}' planida.`);
  }

  let diskId = findDiskId(disksBefore);
  if (!diskId) {
    console.log("4/7 Persistent disk yaratilmoqda...");
    try {
      const createdDisk = await renderRequest(`${apiBase}/disks`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mountPath: diskMountPath,
          name: diskName,
          serviceId,
          sizeGB: diskSizeGb,
        }),
      });
      diskId = createdDisk.id || createdDisk.disk?.id || "";
    } catch (error) {
      throw enrichBillingError(error, backupPath);
    }
  } else {
    console.log(`4/7 Persistent disk allaqachon mavjud: ${diskId}`);
  }

  console.log("5/7 Disk ulanishi uchun deploy ishga tushirilmoqda...");
  runRenderCli([
    "deploys",
    "create",
    serviceId,
    "--wait",
    "--confirm",
    "--output",
    "json",
  ]);
  await waitForHealth(siteBase, 180000);

  console.log("6/7 Oldingi ma'lumotlar qayta tiklanmoqda...");
  const restoreClient = await createSiteClient(siteBase);
  await restoreClient.login(adminUsername, adminPassword);
  await restoreClient.restoreBackup(backupPath);
  await waitForHealth(siteBase, 120000);

  const afterRestoreClient = await createSiteClient(siteBase);
  await afterRestoreClient.login(adminUsername, adminPassword);
  const afterRestoreCounts = await getCounts(afterRestoreClient);
  assertEqualCounts(beforeCounts, afterRestoreCounts, "restore");

  console.log("7/7 Restart orqali doimiy saqlanish tekshirilmoqda...");
  runRenderCli(["restart", serviceId, "--confirm", "--output", "json"]);
  await waitForHealth(siteBase, 180000);

  const afterRestartClient = await createSiteClient(siteBase);
  await afterRestartClient.login(adminUsername, adminPassword);
  const afterRestartCounts = await getCounts(afterRestartClient);
  assertEqualCounts(afterRestoreCounts, afterRestartCounts, "restart");

  const serviceAfter = getService(serviceId);
  const disksAfter = await listDisks(apiBase, apiKey);

  console.log("");
  console.log(
    JSON.stringify(
      {
        afterRestartCounts,
        backupPath,
        diskCount: disksAfter.length,
        diskId: findDiskId(disksAfter) || diskId,
        plan: serviceAfter.serviceDetails.plan,
        status: "ok",
        url: serviceAfter.serviceDetails.url,
      },
      null,
      2
    )
  );
}

function getService(targetServiceId) {
  const services = JSON.parse(runRenderCli(["services", "--output", "json"]));
  const match = services.find((item) => item?.service?.id === targetServiceId)?.service;

  if (!match) {
    throw new Error(`Render service topilmadi: ${targetServiceId}`);
  }

  return match;
}

async function listDisks(apiBase, apiKey) {
  const payload = await renderRequest(`${apiBase}/disks?serviceId=${encodeURIComponent(serviceId)}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });

  return Array.isArray(payload) ? payload : [];
}

function runRenderCli(args) {
  return execFileSync(renderCli, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function findDiskId(items) {
  return items[0]?.id || items[0]?.disk?.id || "";
}

function matchValue(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

async function renderRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") && text ? JSON.parse(text) : text;

  if (!response.ok) {
    const message =
      typeof payload === "string" ? payload : payload?.message || JSON.stringify(payload);
    throw new Error(`Render API request failed (${response.status}): ${message}`);
  }

  return payload;
}

async function waitForHealth(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { redirect: "manual" });
      if (response.ok) {
        return;
      }
    } catch {
    }

    await delay(5000);
  }

  throw new Error(`Health-check tayyor bo'lishi kutilgan vaqtda chiqmadi: ${baseUrl}`);
}

async function getCounts(client) {
  const dashboard = await client.request("/api/dashboard");
  const inventory = await client.request("/api/inventory?page=1&pageSize=1");
  const stats = dashboard.overview?.stats || {};

  return {
    activeDevices: inventory.stats?.activeDevices ?? 0,
    totalDepartments: inventory.stats?.totalDepartments ?? 0,
    totalRecords: inventory.stats?.totalRecords ?? stats.totalRecords ?? 0,
  };
}

function assertEqualCounts(expected, actual, stage) {
  for (const key of Object.keys(expected)) {
    if (Number(expected[key] || 0) !== Number(actual[key] || 0)) {
      throw new Error(
        `Ma'lumotlar ${stage} dan keyin mos kelmadi: ${key} kutilgan ${expected[key]}, olingan ${actual[key]}`
      );
    }
  }
}

async function createSiteClient(baseUrl) {
  const cookieJar = new Map();

  async function request(resourcePath, options = {}) {
    const headers = new Headers(options.headers || {});

    if (cookieJar.size) {
      headers.set("cookie", [...cookieJar.values()].join("; "));
    }

    const response = await fetch(`${baseUrl}${resourcePath}`, {
      body: options.body,
      headers,
      method: options.method || "GET",
      redirect: "manual",
    });

    storeCookies(response, cookieJar);
    const contentType = response.headers.get("content-type") || "";

    if (options.expectBinary) {
      const buffer = Buffer.from(await response.arrayBuffer());

      if (!response.ok) {
        throw new Error(`Fayl so'rovi bajarilmadi (${response.status})`);
      }

      return { buffer, response };
    }

    const text = await response.text();
    const payload = contentType.includes("application/json") && text ? JSON.parse(text) : text;

    if (!response.ok) {
      const message =
        typeof payload === "string" ? payload : payload?.message || JSON.stringify(payload);
      throw new Error(`Site request failed (${response.status} ${resourcePath}): ${message}`);
    }

    return payload;
  }

  return {
    async login(username, password) {
      await request("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password, username }),
      });
    },
    request,
    async downloadBackup(destinationPath) {
      const { buffer } = await request("/api/system/backup", { expectBinary: true });
      fs.writeFileSync(destinationPath, buffer);
      return buffer.length;
    },
    async restoreBackup(filePath) {
      const form = new FormData();
      const buffer = fs.readFileSync(filePath);
      form.append("file", new Blob([buffer], { type: "application/json" }), path.basename(filePath));
      await request("/api/system/restore", {
        method: "POST",
        body: form,
      });
    },
  };
}

function storeCookies(response, cookieJar) {
  const rawCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : [];

  for (const cookie of rawCookies) {
    const pair = cookie.split(";")[0];
    const [name] = pair.split("=");
    cookieJar.set(name, pair);
  }
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function enrichBillingError(error, backupPath) {
  const message = String(error?.message || error);

  if (/payment information is required/i.test(message)) {
    return new Error(
      `Render billing yoqilmagan. Avval https://dashboard.render.com/billing sahifasida karta qo'shing, keyin skriptni qayta ishga tushiring.\nBackup saqlangan joy: ${backupPath}`
    );
  }

  return error;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
