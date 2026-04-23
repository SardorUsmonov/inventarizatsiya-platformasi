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
          "logout-confirm-cancel",
          "logout-confirm-accept",
        ],
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
