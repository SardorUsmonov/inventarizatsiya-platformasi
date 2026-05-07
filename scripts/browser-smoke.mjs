import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import puppeteer from "puppeteer-core";

const baseUrl = normalizeBaseUrl(process.env.BROWSER_SMOKE_URL || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000");
const username = process.env.BROWSER_SMOKE_USERNAME || process.env.SMOKE_USERNAME || "Admin";
const password = process.env.BROWSER_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD || "qwerty2026";
const browserPath = resolveBrowserPath(process.env.BROWSER_PATH);
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "inventory-browser-smoke-"));
const viewport = resolveViewport();
const isMobileViewport = viewport.isMobile || viewport.width <= 780;

if (!baseUrl || !username || !password) {
  fail("BROWSER_SMOKE_URL, BROWSER_SMOKE_USERNAME va BROWSER_SMOKE_PASSWORD majburiy.");
}

if (!browserPath) {
  fail("Chrome yoki Edge topilmadi. BROWSER_PATH bilan yo'lni kiriting.");
}

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  defaultViewport: viewport,
  args: [
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

try {
  const page = await browser.newPage();
  const consoleIssues = [];

  page.on("console", (message) => {
    const text = message.text();

    if (isUnexpectedConsoleIssue(message.type(), text)) {
      consoleIssues.push({
        text,
        type: message.type(),
      });
    }
  });
  page.on("pageerror", (error) => {
    consoleIssues.push({
      text: error.message,
      type: "pageerror",
    });
  });

  await page.goto(baseUrl, { waitUntil: "networkidle2" });

  await page.waitForSelector("#authScreen:not(.hidden)", { timeout: 15000 });
  await page.type("#loginUsername", username);
  await page.type("#loginPassword", password);
  await page.click("#loginButton");

  await page.waitForSelector("#appShell:not(.hidden)", { timeout: 20000 });
  await page.waitForSelector("#tabDashboard", { timeout: 20000 });

  const sidebarCard = await page.$(".sidebar__card");

  if (sidebarCard) {
    fail("Sidebar'dagi olib tashlanishi kerak bo'lgan workflow bloki hali mavjud.");
  }

  if (isMobileViewport) {
    await assertNoHorizontalOverflow(page, "dashboard");
    await page.click('[data-tab-target="inventory"]');
    await page.waitForFunction(
      () =>
        document.querySelector('[data-tab-target="inventory"]')?.classList.contains("is-active") &&
        !document.querySelector("#tabInventory")?.classList.contains("hidden"),
      { timeout: 10000 }
    );
    await assertNoHorizontalOverflow(page, "inventory");
    await page.click('[data-tab-target="dashboard"]');
    await page.waitForFunction(
      () =>
        document.querySelector('[data-tab-target="dashboard"]')?.classList.contains("is-active") &&
        !document.querySelector("#tabDashboard")?.classList.contains("hidden"),
      { timeout: 10000 }
    );
  }

  const beforeToggle = await page.evaluate(() => {
    const bodyTheme = document.body.dataset.theme || "light";
    const sessionChip = getComputedStyle(document.querySelector(".session-chip")).backgroundColor;
    const topbar = getComputedStyle(document.querySelector(".topbar")).backgroundImage;
    return { bodyTheme, sessionChip, topbar };
  });

  await page.screenshot({ path: path.join(outputDir, "light.png"), fullPage: true });
  await page.click("#themeToggleButton");
  await page.waitForFunction(() => document.body.dataset.theme === "dark", { timeout: 10000 });

  const afterToggle = await page.evaluate(() => {
    const bodyTheme = document.body.dataset.theme || "light";
    const sessionChip = getComputedStyle(document.querySelector(".session-chip")).backgroundColor;
    const topbar = getComputedStyle(document.querySelector(".topbar")).backgroundImage;
    const textColor = getComputedStyle(document.body).color;
    return { bodyTheme, sessionChip, textColor, topbar };
  });

  if (afterToggle.bodyTheme !== "dark") {
    fail("Dark mode yoqilmadi.");
  }

  if (beforeToggle.sessionChip === afterToggle.sessionChip && beforeToggle.topbar === afterToggle.topbar) {
    fail("Dark mode vizual ko'rinishni o'zgartirmadi.");
  }

  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector("#appShell:not(.hidden)", { timeout: 20000 });

  const persistedTheme = await page.evaluate(() => document.body.dataset.theme || "light");

  if (persistedTheme !== "dark") {
    fail("Dark mode reload'dan keyin saqlanmadi.");
  }

  await page.screenshot({ path: path.join(outputDir, "dark.png"), fullPage: true });
  await page.click("#themeToggleButton");
  await page.waitForFunction(() => document.body.dataset.theme === "light", { timeout: 10000 });

  const afterLightReturn = await page.evaluate(() => {
    const toLuminance = (color) => {
      const rgb = (color.match(/\d+(?:\.\d+)?/g) || []).slice(0, 3).map(Number);

      if (rgb.length < 3) {
        return 0;
      }

      return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
    };
    const dashboardPanel = getComputedStyle(document.querySelector(".dashboard-panel")).backgroundColor;
    const dashboardEmptyState = getComputedStyle(document.querySelector("#dashboardEmptyState")).backgroundColor;
    const sessionChip = getComputedStyle(document.querySelector(".session-chip")).backgroundColor;
    const compactSearch = getComputedStyle(document.querySelector(".topbar .search--compact")).backgroundColor;

    return {
      bodyTheme: document.body.dataset.theme || "light",
      compactSearch,
      compactSearchLuminance: toLuminance(compactSearch),
      dashboardEmptyState,
      dashboardEmptyStateLuminance: toLuminance(dashboardEmptyState),
      dashboardPanel,
      dashboardPanelLuminance: toLuminance(dashboardPanel),
      sessionChip,
      sessionChipLuminance: toLuminance(sessionChip),
    };
  });

  if (
    afterLightReturn.bodyTheme !== "light" ||
    afterLightReturn.dashboardPanelLuminance < 80 ||
    afterLightReturn.dashboardEmptyStateLuminance < 80 ||
    afterLightReturn.sessionChipLuminance < 80 ||
    afterLightReturn.compactSearchLuminance < 80
  ) {
    fail(`Light mode to'liq qaytmadi: ${JSON.stringify(afterLightReturn)}`);
  }

  const assetCreateResult = await runInventoryCreateSmoke(page);

  if (consoleIssues.length) {
    fail(`Brauzer console'da kutilmagan xatolar bor: ${JSON.stringify(consoleIssues.slice(0, 8))}`);
  }

  await page.click("#logoutButton");
  await page.waitForSelector("#logoutDialog[open]", { timeout: 10000 });
  await page.click("#logoutDialogCancelButton");
  await page.waitForFunction(() => !document.querySelector("#logoutDialog")?.open, { timeout: 10000 });
  await page.waitForSelector("#appShell:not(.hidden)", { timeout: 10000 });
  await page.click("#logoutButton");
  await page.waitForSelector("#logoutDialog[open]", { timeout: 10000 });
  await page.click("#logoutDialogConfirmButton");
  await page.waitForSelector("#authScreen:not(.hidden)", { timeout: 20000 });

  console.log(
    JSON.stringify(
      {
        baseUrl,
        browserPath,
        checks: [
          "login",
          "dashboard",
          "sidebar-card-removed",
          ...(isMobileViewport ? ["mobile-tab-navigation", "mobile-no-horizontal-overflow"] : []),
          "dark-mode-toggle",
          "dark-mode-persisted",
          "light-mode-toggle-back",
          "dashboard-light-mode",
          "holder-person-department-picker",
          "inventory-create-delete",
          "inventory-qr-labels-button",
          "inventory-qr-panel-after-create",
          "logout-confirm-cancel",
          "logout-confirm-accept",
        ],
        inventorySmoke: assetCreateResult,
        outputDir,
        status: "ok",
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

async function runInventoryCreateSmoke(page) {
  await page.click('[data-tab-target="dashboard"]');
  await page.waitForFunction(
    () =>
      document.querySelector('[data-tab-target="dashboard"]')?.classList.contains("is-active") &&
      !document.querySelector("#tabDashboard")?.classList.contains("hidden"),
    { timeout: 10000 }
  );

  const usedEmptyStateCta = await page.evaluate(() => {
    const emptyState = document.querySelector("#dashboardEmptyState");
    const emptyStateButton = emptyState?.querySelector('[data-scenario-action="assignment"]');
    return Boolean(emptyState && !emptyState.classList.contains("hidden") && emptyStateButton);
  });

  if (usedEmptyStateCta) {
    await page.click('#dashboardEmptyState [data-scenario-action="assignment"]');
  } else {
    await page.click("#dashboardAddAssetButton");
  }

  await page.waitForFunction(
    () =>
      document.querySelector('[data-tab-target="inventory"]')?.classList.contains("is-active") &&
      !document.querySelector("#tabInventory")?.classList.contains("hidden"),
    { timeout: 10000 }
  );
  await page.click('[data-inventory-panel-target="create"]');
  await page.waitForSelector("#inventoryPanelCreate:not(.hidden)", { timeout: 10000 });
  await page.waitForFunction(
    () =>
      document.querySelector("#departmentId")?.options.length > 1 &&
      document.querySelector("#deviceId")?.options.length > 1 &&
      document.querySelector("#assetStatus")?.options.length > 0 &&
      document.querySelector("#conditionStatus")?.options.length > 0,
    { timeout: 15000 }
  );
  await sleep(250);

  const tag = `SMOKE-${Date.now()}`;
  await clearAndType(page, "#firstName", "Smoke");
  await clearAndType(page, "#lastName", "Asset");
  await selectFirstRealOption(page, "#departmentId");
  await page.click("#usePersonHolderButton");
  await page.waitForFunction(() => document.querySelector("#currentHolder")?.value === "Smoke Asset", {
    timeout: 5000,
  });
  await page.click("#useDepartmentHolderButton");
  await page.waitForFunction(
    () => {
      const holder = document.querySelector("#currentHolder")?.value || "";
      const department = document.querySelector("#departmentId")?.selectedOptions[0]?.textContent.trim() || "";
      return Boolean(holder && department && holder === department);
    },
    { timeout: 5000 }
  );
  await clearAndType(page, "#previousHolder", "-");
  await page.click("#inventoryWizardNextButton");
  await page.waitForFunction(
    () => document.querySelector('[data-wizard-panel="1"]')?.classList.contains("is-active"),
    { timeout: 10000 }
  );
  await selectFirstRealOption(page, "#deviceId");
  await clearAndType(page, "#assetTag", tag);
  await clearAndType(page, "#serialNumber", `SN-${tag}`);
  await page.click("#inventoryWizardNextButton");
  await page.waitForFunction(
    () => document.querySelector('[data-wizard-panel="2"]')?.classList.contains("is-active"),
    { timeout: 10000 }
  );
  await page.click("#inventoryWizardNextButton");
  await page.waitForFunction(
    () => document.querySelector('[data-wizard-panel="3"]')?.classList.contains("is-active"),
    { timeout: 10000 }
  );

  const qrLabelsButtonText = await page.$eval("#printQrLabelsButton", (element) => element.textContent.trim());
  const qrSubmitText = await page.$eval("#submitButton", (element) => element.textContent.trim());
  const qrStatusText = await page.$eval(".wizard-qr-status", (element) => element.textContent.trim());

  if (!qrLabelsButtonText.includes("QR") || !qrSubmitText.includes("QR") || !qrStatusText.includes("QR")) {
    fail("Inventar yakuniy qadamida QR haqida aniq ko'rsatma ko'rinmadi.");
  }

  const createResponse = await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith("/api/inventory") && response.request().method() === "POST",
      { timeout: 20000 }
    ),
    page.click("#submitButton"),
  ]).then(([response]) => response);

  if (createResponse.status() !== 201) {
    fail(`Inventar UI orqali saqlanmadi: ${createResponse.status()}`);
  }

  await page.waitForSelector("#inventoryDetailPanel:not(.hidden)", { timeout: 15000 });
  await page.waitForFunction(
    (assetTag) => {
      const title = document.querySelector("#detailTitle")?.textContent || "";
      const qrImage = document.querySelector("#detailQrImage");
      const passportLink = document.querySelector("#detailQrPassportLink");
      return title.includes(assetTag) &&
        qrImage?.getAttribute("src")?.includes("/api/inventory/") &&
        passportLink?.getAttribute("href")?.includes("recordId=");
    },
    { timeout: 10000 },
    tag
  );

  const cleanup = await page.evaluate(async (assetTag) => {
    const listResponse = await fetch(`/api/inventory?search=${encodeURIComponent(assetTag)}&pageSize=25`);
    const payload = await listResponse.json();
    const record = payload.records?.find((item) => item.assetTag === assetTag);

    if (!record) {
      return {
        found: false,
      };
    }

    const deleteResponse = await fetch(`/api/inventory/${record.id}`, {
      method: "DELETE",
    });

    return {
      deleteStatus: deleteResponse.status,
      found: true,
      id: record.id,
    };
  }, tag);

  if (!cleanup.found || cleanup.deleteStatus !== 204) {
    fail(`Smoke inventar yozuvini tozalab bo'lmadi: ${JSON.stringify(cleanup)}`);
  }

  return {
    createStatus: createResponse.status(),
    deleteStatus: cleanup.deleteStatus,
  };
}

async function clearAndType(page, selector, value) {
  await page.$eval(selector, (element) => {
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type(selector, value);
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function selectFirstRealOption(page, selector) {
  const optionValue = await page.$eval(selector, (element) => {
    const option = Array.from(element.options).find((item) => item.value);
    return option?.value || "";
  });

  if (!optionValue) {
    fail(`${selector} uchun tanlanadigan option topilmadi.`);
  }

  await page.select(selector, optionValue);
}

function resolveBrowserPath(explicitPath) {
  const candidates = [
    explicitPath,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveViewport() {
  const width = Number.parseInt(process.env.BROWSER_SMOKE_WIDTH || "", 10);
  const height = Number.parseInt(process.env.BROWSER_SMOKE_HEIGHT || "", 10);
  const isMobile = String(process.env.BROWSER_SMOKE_MOBILE || "").trim().toLowerCase() === "true";
  const hasTouch = String(process.env.BROWSER_SMOKE_TOUCH || "").trim().toLowerCase() === "true" || isMobile;

  return {
    width: Number.isFinite(width) && width > 0 ? width : 1440,
    height: Number.isFinite(height) && height > 0 ? height : 1200,
    isMobile,
    hasTouch,
  };
}

function isUnexpectedConsoleIssue(type, text) {
  if (type === "pageerror") {
    return true;
  }

  if (!["error", "warning"].includes(type)) {
    return false;
  }

  const normalizedText = String(text || "");

  if (/Failed to load resource: the server responded with a status of 401/i.test(normalizedText)) {
    return false;
  }

  if (/Input elements should have autocomplete attributes|Password forms should have/i.test(normalizedText)) {
    return false;
  }

  return /Pattern attribute|Invalid regular expression|Uncaught|TypeError|ReferenceError|SyntaxError|Failed to load resource/i
    .test(normalizedText);
}

async function assertNoHorizontalOverflow(page, contextLabel) {
  const audit = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.right - 1 > viewportWidth;
      })
      .slice(0, 8)
      .map((element) => ({
        className: String(element.className || "").trim().slice(0, 120),
        id: element.id || "",
        tag: element.tagName.toLowerCase(),
        width: Math.round(element.getBoundingClientRect().width),
      }));

    return {
      bodyWidth,
      documentWidth,
      offenders,
      viewportWidth,
    };
  });

  if (audit.documentWidth > audit.viewportWidth + 1 || audit.bodyWidth > audit.viewportWidth + 1) {
    fail(
      `${contextLabel} bo'limida mobil gorizontal overflow aniqlandi: ${JSON.stringify(audit)}`
    );
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
