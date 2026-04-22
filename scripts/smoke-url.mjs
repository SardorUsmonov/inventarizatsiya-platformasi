const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL);
const username = process.env.SMOKE_USERNAME || "";
const password = process.env.SMOKE_PASSWORD || "";
const expectedRole = process.env.SMOKE_EXPECTED_ROLE || "admin";
const cookieJar = new Map();

if (!baseUrl || !username || !password) {
  console.error(
    "SMOKE_BASE_URL, SMOKE_USERNAME va SMOKE_PASSWORD environment variable lari majburiy."
  );
  process.exit(1);
}

await assertStatus("/", 200, "Asosiy sahifa");
await assertStatus("/styles.css", 200, "Styles fayli");
await assertStatus("/app.js", 200, "JavaScript fayli");
await assertStatus("/enhancements.js", 200, "Enhancements fayli");

const health = await request("/api/health");

if (health.response.status !== 200 || health.payload?.status !== "ok") {
  fail("Health-check kutilgan javobni bermadi.");
}

const login = await request("/api/auth/login", {
  body: {
    password,
    username,
  },
  method: "POST",
});

if (login.response.status !== 200) {
  fail(`Login muvaffaqiyatsiz tugadi: ${login.response.status}`);
}

if (login.payload?.user?.role !== expectedRole) {
  fail(
    `Login roli mos emas. Kutilgan: ${expectedRole}, olingan: ${login.payload?.user?.role || "-"}`
  );
}

const session = await request("/api/session");

if (session.response.status !== 200) {
  fail(`Session tekshiruvi muvaffaqiyatsiz tugadi: ${session.response.status}`);
}

const dashboard = await request("/api/dashboard");

if (dashboard.response.status !== 200) {
  fail(`Dashboard tekshiruvi muvaffaqiyatsiz tugadi: ${dashboard.response.status}`);
}

const logout = await request("/api/auth/logout", {
  method: "POST",
});

if (logout.response.status !== 204) {
  fail(`Logout muvaffaqiyatsiz tugadi: ${logout.response.status}`);
}

const loggedOutSession = await request("/api/session");

if (loggedOutSession.response.status !== 401) {
  fail("Logout dan keyin sessiya yopilmadi.");
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      checks: [
        "home",
        "styles",
        "app",
        "enhancements",
        "health",
        "login",
        "session",
        "dashboard",
        "logout",
      ],
      status: "ok",
      userRole: login.payload.user.role,
    },
    null,
    2
  )
);

async function assertStatus(resourcePath, expectedStatus, label) {
  const result = await request(resourcePath);

  if (result.response.status !== expectedStatus) {
    fail(`${label} kutilgan statusni bermadi: ${result.response.status}`);
  }
}

async function request(resourcePath, options = {}) {
  const headers = new Headers(options.headers || {});

  if (cookieJar.size) {
    headers.set("cookie", [...cookieJar.values()].join("; "));
  }

  let body = options.body;

  if (body && !(body instanceof FormData)) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${resourcePath}`, {
    body,
    headers,
    method: options.method || "GET",
  });

  storeCookies(response);

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return {
      payload: await response.json(),
      response,
    };
  }

  return {
    payload: null,
    response,
    text: await response.text(),
  };
}

function storeCookies(response) {
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

function normalizeBaseUrl(value) {
  if (!value) {
    return "";
  }

  return String(value).trim().replace(/\/+$/, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
