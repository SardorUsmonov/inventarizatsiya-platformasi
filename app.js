const authScreen = document.querySelector("#authScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginUsernameInput = document.querySelector("#loginUsername");
const loginPasswordInput = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const authFeedback = document.querySelector("#authFeedback");
const logoutButton = document.querySelector("#logoutButton");
const logoutDialog = document.querySelector("#logoutDialog");
const logoutDialogCancelButton = document.querySelector("#logoutDialogCancelButton");
const logoutDialogConfirmButton = document.querySelector("#logoutDialogConfirmButton");
const sessionUserElement = document.querySelector("#sessionUser");
const sessionRoleElement = document.querySelector("#sessionRole");
const statusBanner = document.querySelector("#statusBanner");
const tabButtons = [...document.querySelectorAll("[data-tab-target]")];
const usersTabButton = document.querySelector("#usersTabButton");
const auditTabButton = document.querySelector("#auditTabButton");
const inventoryForm = document.querySelector("#inventoryForm");
const inventoryAccessNote = document.querySelector("#inventoryAccessNote");
const recordIdInput = document.querySelector("#recordId");
const firstNameInput = document.querySelector("#firstName");
const lastNameInput = document.querySelector("#lastName");
const departmentSelect = document.querySelector("#departmentId");
const deviceSelect = document.querySelector("#deviceId");
const assetTagInput = document.querySelector("#assetTag");
const serialNumberInput = document.querySelector("#serialNumber");
const assetStatusSelect = document.querySelector("#assetStatus");
const conditionStatusSelect = document.querySelector("#conditionStatus");
const purchaseDateInput = document.querySelector("#purchaseDate");
const assignedAtInput = document.querySelector("#assignedAt");
const warrantyUntilInput = document.querySelector("#warrantyUntil");
const supplierInput = document.querySelector("#supplier");
const officeLocationInput = document.querySelector("#officeLocation");
const accessoriesInput = document.querySelector("#accessories");
const previousHolderInput = document.querySelector("#previousHolder");
const currentHolderInput = document.querySelector("#currentHolder");
const notesInput = document.querySelector("#notes");
const submitButton = document.querySelector("#submitButton");
const resetButton = document.querySelector("#resetButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const quickCatalogPanel = document.querySelector("#quickCatalogPanel");
const openQuickDepartmentButton = document.querySelector("#openQuickDepartmentButton");
const openQuickDeviceButton = document.querySelector("#openQuickDeviceButton");
const openFullCatalogButton = document.querySelector("#openFullCatalogButton");
const quickDepartmentForm = document.querySelector("#quickDepartmentForm");
const quickDepartmentNameInput = document.querySelector("#quickDepartmentName");
const quickDepartmentCodeInput = document.querySelector("#quickDepartmentCode");
const quickDepartmentDescriptionInput = document.querySelector("#quickDepartmentDescription");
const quickDepartmentSubmitButton = document.querySelector("#quickDepartmentSubmitButton");
const quickDepartmentCancelButton = document.querySelector("#quickDepartmentCancelButton");
const quickDeviceForm = document.querySelector("#quickDeviceForm");
const quickDeviceNameInput = document.querySelector("#quickDeviceName");
const quickDeviceCategoryInput = document.querySelector("#quickDeviceCategory");
const quickDeviceModelInput = document.querySelector("#quickDeviceModel");
const quickDeviceDescriptionInput = document.querySelector("#quickDeviceDescription");
const quickDeviceSubmitButton = document.querySelector("#quickDeviceSubmitButton");
const quickDeviceCancelButton = document.querySelector("#quickDeviceCancelButton");
const searchInput = document.querySelector("#searchInput");
const filterDepartmentSelect = document.querySelector("#filterDepartmentId");
const filterDeviceSelect = document.querySelector("#filterDeviceId");
const filterAssetStatusSelect = document.querySelector("#filterAssetStatus");
const filterConditionStatusSelect = document.querySelector("#filterConditionStatus");
const refreshButton = document.querySelector("#refreshButton");
const downloadTemplateButton = document.querySelector("#downloadTemplateButton");
const importButton = document.querySelector("#importButton");
const importFileInput = document.querySelector("#importFileInput");
const exportExcelButton = document.querySelector("#exportExcelButton");
const exportCsvButton = document.querySelector("#exportCsvButton");
const inventoryTableBody = document.querySelector("#inventoryTableBody");
const emptyState = document.querySelector("#emptyState");
const emptyStateText = document.querySelector("#emptyStateText");
const tableSummary = document.querySelector("#tableSummary");
const totalRecordsElement = document.querySelector("#totalRecords");
const totalDepartmentsElement = document.querySelector("#totalDepartments");
const activeDevicesElement = document.querySelector("#activeDevices");
const dashboardInUseCountElement = document.querySelector("#dashboardInUseCount");
const dashboardInStockCountElement = document.querySelector("#dashboardInStockCount");
const dashboardRepairCountElement = document.querySelector("#dashboardRepairCount");
const dashboardWarrantyCountElement = document.querySelector("#dashboardWarrantyCount");
const dashboardAccessoryCountElement = document.querySelector("#dashboardAccessoryCount");
const dashboardPurchasedThisYearCountElement = document.querySelector("#dashboardPurchasedThisYearCount");
const dashboardStatusList = document.querySelector("#dashboardStatusList");
const dashboardConditionList = document.querySelector("#dashboardConditionList");
const dashboardDepartmentList = document.querySelector("#dashboardDepartmentList");
const recentPurchasesTableBody = document.querySelector("#recentPurchasesTableBody");
const warrantyTableBody = document.querySelector("#warrantyTableBody");
const attentionTableBody = document.querySelector("#attentionTableBody");
const latestChangesTableBody = document.querySelector("#latestChangesTableBody");
const departmentForm = document.querySelector("#departmentForm");
const departmentCatalogId = document.querySelector("#departmentCatalogId");
const departmentNameInput = document.querySelector("#departmentName");
const departmentCodeInput = document.querySelector("#departmentCode");
const departmentDescriptionInput = document.querySelector("#departmentDescription");
const departmentIsActiveInput = document.querySelector("#departmentIsActive");
const departmentSubmitButton = document.querySelector("#departmentSubmitButton");
const cancelDepartmentEditButton = document.querySelector("#cancelDepartmentEditButton");
const departmentsTableBody = document.querySelector("#departmentsTableBody");
const departmentCatalogSearchInput = document.querySelector("#departmentCatalogSearch");
const deviceForm = document.querySelector("#deviceForm");
const deviceCatalogId = document.querySelector("#deviceCatalogId");
const deviceCatalogNameInput = document.querySelector("#deviceCatalogName");
const deviceCategoryInput = document.querySelector("#deviceCategory");
const deviceModelInput = document.querySelector("#deviceModel");
const deviceDescriptionInput = document.querySelector("#deviceDescription");
const deviceIsActiveInput = document.querySelector("#deviceIsActive");
const deviceSubmitButton = document.querySelector("#deviceSubmitButton");
const cancelDeviceEditButton = document.querySelector("#cancelDeviceEditButton");
const devicesTableBody = document.querySelector("#devicesTableBody");
const deviceCatalogSearchInput = document.querySelector("#deviceCatalogSearch");
const catalogAccessNote = document.querySelector("#catalogAccessNote");
const userForm = document.querySelector("#userForm");
const userIdInput = document.querySelector("#userId");
const userFullNameInput = document.querySelector("#userFullName");
const userUsernameInput = document.querySelector("#userUsername");
const userRoleSelect = document.querySelector("#userRole");
const userPasswordInput = document.querySelector("#userPassword");
const userIsActiveInput = document.querySelector("#userIsActive");
const userSubmitButton = document.querySelector("#userSubmitButton");
const cancelUserEditButton = document.querySelector("#cancelUserEditButton");
const usersTableBody = document.querySelector("#usersTableBody");
const auditSearchInput = document.querySelector("#auditSearchInput");
const auditEntityFilter = document.querySelector("#auditEntityFilter");
const refreshAuditButton = document.querySelector("#refreshAuditButton");
const auditTableBody = document.querySelector("#auditTableBody");
const auditEmptyState = document.querySelector("#auditEmptyState");

const state = {
  activeTab: "dashboard",
  assetStatuses: [],
  auditDebounceId: 0,
  auditLogs: [],
  catalogSearchDebounceId: 0,
  conditionStatuses: [],
  dashboardOverview: null,
  departments: [],
  devices: [],
  inventoryRecords: [],
  inventoryRequestController: null,
  permissions: {},
  roles: [],
  searchDebounceId: 0,
  statusTimeoutId: 0,
  user: null,
  users: [],
};

bootstrap();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthBusy(true);

  try {
    const session = await request("/api/auth/login", {
      body: {
        password: loginPasswordInput.value,
        username: loginUsernameInput.value,
      },
      method: "POST",
    });

    applySession(session);
    clearAuthFeedback();
    showApp();
    await refreshDashboardData();
    await loadInventory();
    loginForm.reset();
    showStatus("Tizimga muvaffaqiyatli kirildi.");
  } catch (error) {
    showAuthFeedback(error.message);
  } finally {
    setAuthBusy(false);
  }
});

logoutButton.addEventListener("click", async () => {
  const confirmed = await confirmLogout();

  if (!confirmed) {
    return;
  }

  logoutButton.disabled = true;
  let shouldShowAuth = false;

  try {
    await request("/api/auth/logout", {
      method: "POST",
    });
    shouldShowAuth = true;
  } catch (error) {
    if (error.status === 401) {
      shouldShowAuth = true;
    } else {
      showStatus(error.message, "error");
    }
  } finally {
    if (shouldShowAuth) {
      showAuth();
    }
    logoutButton.disabled = false;
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
});

inventoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const recordId = recordIdInput.value;

  setInventoryBusy(true);

  try {
    await request(recordId ? `/api/inventory/${recordId}` : "/api/inventory", {
      body: getInventoryPayload(),
      method: recordId ? "PUT" : "POST",
    });

    resetInventoryForm();
    await loadInventory();
    showStatus(recordId ? "Inventar yozuvi yangilandi." : "Yangi inventar yozuvi saqlandi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    setInventoryBusy(false);
  }
});

inventoryForm.addEventListener("reset", () => {
  window.setTimeout(() => resetInventoryForm(), 0);
});

cancelEditButton.addEventListener("click", resetInventoryForm);
openFullCatalogButton.addEventListener("click", () => activateTab("catalogs"));
openQuickDepartmentButton.addEventListener("click", () => showQuickCatalogForm("department"));
openQuickDeviceButton.addEventListener("click", () => showQuickCatalogForm("device"));
quickDepartmentCancelButton.addEventListener("click", resetQuickDepartmentForm);
quickDeviceCancelButton.addEventListener("click", resetQuickDeviceForm);
departmentCatalogSearchInput.addEventListener("input", () => scheduleCatalogRender());
deviceCatalogSearchInput.addEventListener("input", () => scheduleCatalogRender());

quickDepartmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  quickDepartmentSubmitButton.disabled = true;

  try {
    const response = await request("/api/departments", {
      body: getQuickDepartmentPayload(),
      method: "POST",
    });

    await refreshDashboardData();
    departmentSelect.value = String(response.department.id);
    resetQuickDepartmentForm();
    showStatus("Yangi bo'lim/soha qo'shildi va darrov tanlandi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    quickDepartmentSubmitButton.disabled = false;
  }
});

quickDeviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  quickDeviceSubmitButton.disabled = true;

  try {
    const response = await request("/api/devices", {
      body: getQuickDevicePayload(),
      method: "POST",
    });

    await refreshDashboardData();
    deviceSelect.value = String(response.device.id);
    resetQuickDeviceForm();
    showStatus("Yangi texnika qo'shildi va darrov tanlandi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    quickDeviceSubmitButton.disabled = false;
  }
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;

  try {
    await loadInventory();
    showStatus("Inventar ro'yxati yangilandi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    refreshButton.disabled = false;
  }
});

searchInput.addEventListener("input", () => {
  window.clearTimeout(state.searchDebounceId);
  state.searchDebounceId = window.setTimeout(() => loadInventory({ silent: true }).catch(handleError), 280);
});

filterDepartmentSelect.addEventListener("change", () => loadInventory({ silent: true }).catch(handleError));
filterDeviceSelect.addEventListener("change", () => loadInventory({ silent: true }).catch(handleError));
filterAssetStatusSelect.addEventListener("change", () => loadInventory({ silent: true }).catch(handleError));
filterConditionStatusSelect.addEventListener("change", () => loadInventory({ silent: true }).catch(handleError));
downloadTemplateButton.addEventListener("click", () => window.open("/api/inventory/template", "_blank", "noopener"));
importButton.addEventListener("click", () => importFileInput.click());
exportExcelButton.addEventListener("click", () => downloadInventory("/api/inventory/export/xlsx"));
exportCsvButton.addEventListener("click", () => downloadInventory("/api/inventory/export/csv"));

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];

  if (!file) {
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  importButton.disabled = true;

  try {
    const response = await request("/api/inventory/import", {
      body: formData,
      method: "POST",
    });

    importFileInput.value = "";
    await refreshDashboardData();
    await loadInventory();
    showStatus(`${response.result.insertedCount} ta yozuv Excel orqali import qilindi.`);
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    importButton.disabled = false;
  }
});

departmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const departmentId = departmentCatalogId.value;
  departmentSubmitButton.disabled = true;

  try {
    await request(departmentId ? `/api/departments/${departmentId}` : "/api/departments", {
      body: getDepartmentPayload(),
      method: departmentId ? "PUT" : "POST",
    });

    resetDepartmentForm();
    await refreshDashboardData();
    await loadInventory({ silent: true });
    showStatus(departmentId ? "Bo'lim yangilandi." : "Bo'lim katalogga qo'shildi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    departmentSubmitButton.disabled = false;
  }
});

cancelDepartmentEditButton.addEventListener("click", resetDepartmentForm);

deviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const deviceId = deviceCatalogId.value;
  deviceSubmitButton.disabled = true;

  try {
    await request(deviceId ? `/api/devices/${deviceId}` : "/api/devices", {
      body: getDevicePayload(),
      method: deviceId ? "PUT" : "POST",
    });

    resetDeviceForm();
    await refreshDashboardData();
    await loadInventory({ silent: true });
    showStatus(deviceId ? "Texnika yangilandi." : "Texnika katalogga qo'shildi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    deviceSubmitButton.disabled = false;
  }
});

cancelDeviceEditButton.addEventListener("click", resetDeviceForm);

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userId = userIdInput.value;
  userSubmitButton.disabled = true;

  try {
    await request(userId ? `/api/users/${userId}` : "/api/users", {
      body: getUserPayload(),
      method: userId ? "PUT" : "POST",
    });

    resetUserForm();
    await reloadSessionAndDashboard();
    showStatus(userId ? "Foydalanuvchi yangilandi." : "Yangi foydalanuvchi yaratildi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    userSubmitButton.disabled = false;
  }
});

cancelUserEditButton.addEventListener("click", resetUserForm);

auditSearchInput.addEventListener("input", () => {
  window.clearTimeout(state.auditDebounceId);
  state.auditDebounceId = window.setTimeout(() => loadAuditLogs().catch(handleError), 280);
});

auditEntityFilter.addEventListener("change", () => loadAuditLogs().catch(handleError));

refreshAuditButton.addEventListener("click", async () => {
  refreshAuditButton.disabled = true;

  try {
    await loadAuditLogs();
    showStatus("Audit log yangilandi.");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    refreshAuditButton.disabled = false;
  }
});

async function bootstrap() {
  if (window.location.protocol === "file:") {
    showAuth();
    showAuthFeedback("Bu ilova server orqali ishlaydi. `npm.cmd start` ni ishga tushirib, `http://localhost:3000` manzilini oching.");
    return;
  }

  setAuthBusy(true);

  try {
    const session = await request("/api/session");
    applySession(session);
    showApp();
    await refreshDashboardData();
    await loadInventory();
  } catch (error) {
    showAuth();

    if (error.status !== 401) {
      showAuthFeedback(error.message);
    }
  } finally {
    setAuthBusy(false);
  }
}

async function reloadSessionAndDashboard() {
  const session = await request("/api/session");
  applySession(session);
  await refreshDashboardData();
  await loadInventory({ silent: true });
}

async function refreshDashboardData() {
  const payload = await request("/api/dashboard");
  state.departments = payload.departments || [];
  state.devices = payload.devices || [];
  state.assetStatuses = payload.inventoryMeta?.assetStatuses || [];
  state.conditionStatuses = payload.inventoryMeta?.conditionStatuses || [];
  state.dashboardOverview = payload.overview || null;
  state.users = payload.users || [];
  state.auditLogs = payload.auditLogs || [];
  state.roles = payload.roles || [];
  state.user = payload.user || state.user;
  renderSessionIdentity();
  renderRoleOptions();
  renderReferenceOptions();
  renderDashboard(state.dashboardOverview);
  renderDepartments();
  renderDevices();
  renderUsers();
  renderAuditLogs(state.auditLogs);
  applyPermissionUI();
}

async function loadInventory(options = {}) {
  if (state.inventoryRequestController) {
    state.inventoryRequestController.abort();
  }

  const controller = new AbortController();
  state.inventoryRequestController = controller;
  const url = new URL("/api/inventory", window.location.origin);

  if (searchInput.value.trim()) {
    url.searchParams.set("search", searchInput.value.trim());
  }

  if (filterDepartmentSelect.value) {
    url.searchParams.set("departmentId", filterDepartmentSelect.value);
  }

  if (filterDeviceSelect.value) {
    url.searchParams.set("deviceId", filterDeviceSelect.value);
  }

  if (filterAssetStatusSelect.value) {
    url.searchParams.set("assetStatus", filterAssetStatusSelect.value);
  }

  if (filterConditionStatusSelect.value) {
    url.searchParams.set("conditionStatus", filterConditionStatusSelect.value);
  }

  if (!options.silent) {
    tableSummary.textContent = "Yozuvlar bazadan yuklanmoqda...";
  }

  try {
    const payload = await request(url.toString(), {
      signal: controller.signal,
    });

    state.inventoryRecords = payload.records || [];
    renderInventory(payload.records || [], payload.stats || {});
  } catch (error) {
    if (error.name !== "AbortError") {
      throw error;
    }
  } finally {
    if (state.inventoryRequestController === controller) {
      state.inventoryRequestController = null;
    }
  }
}

async function loadAuditLogs() {
  if (!state.permissions.viewAudit) {
    return;
  }

  const url = new URL("/api/audit-logs", window.location.origin);

  if (auditSearchInput.value.trim()) {
    url.searchParams.set("search", auditSearchInput.value.trim());
  }

  if (auditEntityFilter.value) {
    url.searchParams.set("entityType", auditEntityFilter.value);
  }

  const payload = await request(url.toString());
  state.auditLogs = payload.logs || [];
  renderAuditLogs(state.auditLogs);
}

function applySession(session) {
  state.user = session.user;
  state.permissions = session.permissions || {};
  state.roles = session.roles || [];
}

function applyPermissionUI() {
  const canManageInventory = Boolean(state.permissions.manageInventory);
  const canManageCatalogs = Boolean(state.permissions.manageCatalogs);
  const canManageUsers = Boolean(state.permissions.manageUsers);
  const canViewAudit = Boolean(state.permissions.viewAudit);

  usersTabButton.classList.toggle("hidden", !canManageUsers);
  auditTabButton.classList.toggle("hidden", !canViewAudit);
  inventoryAccessNote.classList.toggle("hidden", canManageInventory);
  catalogAccessNote.classList.toggle("hidden", canManageCatalogs);
  downloadTemplateButton.classList.toggle("hidden", !state.permissions.importInventory);
  importButton.classList.toggle("hidden", !state.permissions.importInventory);
  exportExcelButton.classList.toggle("hidden", !state.permissions.exportInventory);
  exportCsvButton.classList.toggle("hidden", !state.permissions.exportInventory);
  quickCatalogPanel.classList.toggle("hidden", !canManageCatalogs);
  setFormEnabled(inventoryForm, canManageInventory);
  setFormEnabled(departmentForm, canManageCatalogs);
  setFormEnabled(deviceForm, canManageCatalogs);
  setFormEnabled(userForm, canManageUsers);
}

function setFormEnabled(form, enabled) {
  [...form.querySelectorAll("input, select, textarea, button")].forEach((element) => {
    if (element.type !== "hidden") {
      element.disabled = !enabled;
    }
  });
}

function renderSessionIdentity() {
  sessionUserElement.textContent = state.user.fullName || state.user.username;
  sessionRoleElement.textContent = getRoleLabel(state.user.role);
}

function renderRoleOptions() {
  fillSelectOptions(
    userRoleSelect,
    state.roles.map((role) => ({ label: localizeRoleLabel(role.label), value: role.value })),
    { placeholder: "Rolni tanlang" }
  );
}

function renderReferenceOptions() {
  const activeDepartments = state.departments.filter((item) => item.isActive);
  const activeDevices = state.devices.filter((item) => item.isActive);

  fillSelectOptions(
    departmentSelect,
    activeDepartments.map((item) => ({
      label: formatDepartmentOption(item),
      value: String(item.id),
    })),
    { keepValue: true, placeholder: "Bo'lim yoki sohani tanlang" }
  );
  fillSelectOptions(
    deviceSelect,
    activeDevices.map((item) => ({
      label: formatDeviceOption(item),
      value: String(item.id),
    })),
    { keepValue: true, placeholder: "Texnikani tanlang" }
  );
  fillSelectOptions(
    assetStatusSelect,
    state.assetStatuses.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    { keepValue: true }
  );
  fillSelectOptions(
    conditionStatusSelect,
    state.conditionStatuses.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    { keepValue: true }
  );
  fillSelectOptions(
    filterDepartmentSelect,
    state.departments.map((item) => ({
      label: formatDepartmentOption(item),
      value: String(item.id),
    })),
    { keepValue: true, placeholder: "Barcha bo'limlar" }
  );
  fillSelectOptions(
    filterDeviceSelect,
    state.devices.map((item) => ({
      label: formatDeviceOption(item),
      value: String(item.id),
    })),
    { keepValue: true, placeholder: "Barcha texnikalar" }
  );
  fillSelectOptions(
    filterAssetStatusSelect,
    state.assetStatuses.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    { keepValue: true, placeholder: "Barcha statuslar" }
  );
  fillSelectOptions(
    filterConditionStatusSelect,
    state.conditionStatuses.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    { keepValue: true, placeholder: "Barcha holatlar" }
  );

  if (!assetStatusSelect.value && state.assetStatuses[0]?.value) {
    assetStatusSelect.value = state.assetStatuses[0].value;
  }

  if (!conditionStatusSelect.value && state.conditionStatuses[0]?.value) {
    conditionStatusSelect.value = state.conditionStatuses[0].value;
  }
}

function renderInventory(records, stats) {
  inventoryTableBody.innerHTML = "";

  records.forEach((record) => {
    const row = document.createElement("tr");
    appendCell(row, "Ism", record.firstName);
    appendCell(row, "Familya", record.lastName);
    appendCell(row, "Bo'lim", localizeDepartmentName(record.department));
    appendStackCell(row, "Texnika", [
      record.deviceName,
      record.officeLocation || record.supplier || "",
    ]);
    appendStackCell(row, "Aktiv", [
      record.assetTag || "Tag biriktirilmagan",
      record.serialNumber || "Serial raqam yo'q",
    ]);
    appendTagCell(row, "Holati", getAssetStatusLabel(record.assetStatus), getAssetStatusClass(record.assetStatus));
    appendTagCell(row, "Holat", getConditionStatusLabel(record.conditionStatus), getConditionStatusClass(record.conditionStatus));
    appendStackCell(row, "Xarid / Kafolat", [
      record.purchaseDate ? `Xarid: ${formatShortDate(record.purchaseDate)}` : "Xarid sanasi yo'q",
      record.warrantyUntil ? `Kafolat: ${formatShortDate(record.warrantyUntil)}` : "Kafolat kiritilmagan",
    ]);
    appendStackCell(row, "Qo'shimcha", [
      record.accessories || "Qo'shimcha texnika yo'q",
      record.notes || "",
    ]);
    appendCell(row, "Oldin kimda", record.previousHolder || "-");
    appendCell(row, "Hozir kimda", record.currentHolder);
    appendCell(row, "Yangilangan", formatDate(record.updatedAt));

    const actionsCell = document.createElement("td");
    actionsCell.dataset.label = "Amallar";
    actionsCell.textContent = state.permissions.manageInventory ? "" : "Ko'rish";

    if (state.permissions.manageInventory) {
      const actions = document.createElement("div");
      actions.className = "row-actions";
      actions.appendChild(createRowButton("Tahrirlash", () => fillInventoryForm(record)));
      actions.appendChild(createRowButton("O'chirish", async () => {
        if (!window.confirm("Ushbu yozuvni o'chirmoqchimisiz?")) {
          return;
        }

        await request(`/api/inventory/${record.id}`, { method: "DELETE" });
        await loadInventory({ silent: true });
        showStatus("Yozuv o'chirildi.");
      }));
      actionsCell.appendChild(actions);
    }

    row.appendChild(actionsCell);
    inventoryTableBody.appendChild(row);
  });

  emptyState.style.display = records.length ? "none" : "block";
  emptyStateText.textContent = searchInput.value.trim() ? "Filter bo'yicha mos yozuv topilmadi." : "Hali birorta inventar yozuvi mavjud emas.";
  totalRecordsElement.textContent = stats.totalRecords || 0;
  totalDepartmentsElement.textContent = stats.totalDepartments || 0;
  activeDevicesElement.textContent = stats.activeDevices || 0;
  tableSummary.textContent = `${stats.totalRecords || 0} ta yozuv. ${stats.inUseCount || 0} ishlatilmoqda, ${stats.repairCount || 0} ta'mirda, ${stats.warrantyExpiringCount || 0} kafolat muddatiga yaqin.`;
}

function renderDashboard(overview) {
  const stats = overview?.stats || {};

  dashboardInUseCountElement.textContent = stats.inUseCount || 0;
  dashboardInStockCountElement.textContent = stats.inStockCount || 0;
  dashboardRepairCountElement.textContent = stats.repairCount || 0;
  dashboardWarrantyCountElement.textContent = stats.warrantyExpiringCount || 0;
  dashboardAccessoryCountElement.textContent = stats.accessoryCount || 0;
  dashboardPurchasedThisYearCountElement.textContent = stats.purchasedThisYearCount || 0;

  renderBreakdownList(dashboardStatusList, overview?.byStatus || [], getAssetStatusLabel);
  renderBreakdownList(dashboardConditionList, overview?.byCondition || [], getConditionStatusLabel);
  renderBreakdownList(dashboardDepartmentList, overview?.byDepartment || [], localizeDepartmentName);

  renderDashboardTable(recentPurchasesTableBody, overview?.recentPurchases || [], (record, row) => {
    appendCell(row, "Texnika", record.deviceName);
    appendCell(row, "Sotib olingan", formatShortDate(record.purchaseDate));
    appendTagCell(row, "Holati", getAssetStatusLabel(record.assetStatus), getAssetStatusClass(record.assetStatus));
  });

  renderDashboardTable(warrantyTableBody, overview?.upcomingWarranty || [], (record, row) => {
    appendCell(row, "Texnika", record.deviceName);
    appendCell(row, "Kafolat", formatShortDate(record.warrantyUntil));
    appendCell(row, "Egasi", record.currentHolder || "-");
  });

  renderDashboardTable(attentionTableBody, overview?.attentionItems || [], (record, row) => {
    appendCell(row, "Texnika", record.deviceName);
    appendTagCell(row, "Holat", getConditionStatusLabel(record.conditionStatus), getConditionStatusClass(record.conditionStatus));
    appendCell(row, "Joylashuv", record.officeLocation || "-");
  });

  renderDashboardTable(latestChangesTableBody, overview?.latestChanges || [], (record, row) => {
    appendCell(row, "Texnika", record.deviceName);
    appendTagCell(row, "Holati", getAssetStatusLabel(record.assetStatus), getAssetStatusClass(record.assetStatus));
    appendCell(row, "Yangilangan", formatDate(record.updatedAt));
  });
}

function renderBreakdownList(container, items, labelFormatter) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "breakdown-list__empty";
    empty.textContent = "Hozircha ma'lumot mavjud emas.";
    container.appendChild(empty);
    return;
  }

  const maxValue = Math.max(...items.map((item) => item.total || 0), 1);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "breakdown-item";

    const header = document.createElement("div");
    header.className = "breakdown-item__header";

    const label = document.createElement("span");
    label.className = "breakdown-item__label";
    label.textContent = labelFormatter(item.label || item.value || "-");

    const value = document.createElement("strong");
    value.className = "breakdown-item__value";
    value.textContent = item.total || 0;

    const track = document.createElement("div");
    track.className = "breakdown-item__track";

    const bar = document.createElement("span");
    bar.className = "breakdown-item__bar";
    bar.style.width = `${Math.max(8, Math.round(((item.total || 0) / maxValue) * 100))}%`;

    header.append(label, value);
    track.appendChild(bar);
    row.append(header, track);
    container.appendChild(row);
  });
}

function renderDashboardTable(container, items, renderRow) {
  container.innerHTML = "";

  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "Hozircha ma'lumot mavjud emas.";
    row.appendChild(cell);
    container.appendChild(row);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("tr");
    renderRow(item, row);
    container.appendChild(row);
  });
}

function renderDepartments() {
  departmentsTableBody.innerHTML = "";
  getFilteredDepartments().forEach((department) => {
    const row = document.createElement("tr");
    appendCell(row, "Bo'lim", localizeDepartmentName(department.name));
    appendCell(row, "Kod", department.code || "-");
    appendTagCell(row, "Holat", department.isActive ? "Faol" : "Nofaol", department.isActive ? "" : "tag--danger");
    appendCatalogActionCell(
      row,
      state.permissions.manageCatalogs,
      () => fillDepartmentForm(department),
      async () => {
        if (!window.confirm(`"${department.name}" bo'limini o'chirmoqchimisiz?`)) {
          return;
        }

        await request(`/api/departments/${department.id}`, { method: "DELETE" });
        await refreshDashboardData();
        await loadInventory({ silent: true });
        showStatus("Bo'lim katalogdan o'chirildi.");
      }
    );
    departmentsTableBody.appendChild(row);
  });
}

function renderDevices() {
  devicesTableBody.innerHTML = "";
  getFilteredDevices().forEach((device) => {
    const row = document.createElement("tr");
    appendCell(row, "Texnika", device.name);
    appendCell(row, "Kategoriya", localizeDeviceCategory(device.category) || "-");
    appendTagCell(row, "Holat", device.isActive ? "Faol" : "Nofaol", device.isActive ? "" : "tag--danger");
    appendCatalogActionCell(
      row,
      state.permissions.manageCatalogs,
      () => fillDeviceForm(device),
      async () => {
        if (!window.confirm(`"${device.name}" texnikasini o'chirmoqchimisiz?`)) {
          return;
        }

        await request(`/api/devices/${device.id}`, { method: "DELETE" });
        await refreshDashboardData();
        await loadInventory({ silent: true });
        showStatus("Texnika katalogdan o'chirildi.");
      }
    );
    devicesTableBody.appendChild(row);
  });
}

function renderUsers() {
  usersTableBody.innerHTML = "";
  state.users.forEach((user) => {
    const row = document.createElement("tr");
    appendCell(row, "F.I.Sh.", user.fullName);
    appendCell(row, "Login", user.username);
    appendCell(row, "Rol", getRoleLabel(user.role));
    appendTagCell(row, "Holat", user.isActive ? "Faol" : "Nofaol", user.isActive ? "" : "tag--danger");
    appendActionCell(row, true, () => fillUserForm(user));
    usersTableBody.appendChild(row);
  });
}

function renderAuditLogs(logs) {
  auditTableBody.innerHTML = "";
  logs.forEach((log) => {
    const row = document.createElement("tr");
    appendCell(row, "Sana", formatDate(log.createdAt));
    appendCell(row, "Foydalanuvchi", log.actorName || log.actorUsername || "-");
    appendCell(row, "Rol", getRoleLabel(log.actorRole || "-"));
    appendCell(row, "Amal", formatAuditActionLabel(log.action));
    appendCell(row, "Turi", formatAuditEntityLabel(log.entityType));
    appendCell(row, "Izoh", localizeUiText(log.summary));
    auditTableBody.appendChild(row);
  });
  auditEmptyState.style.display = logs.length ? "none" : "block";
}

function appendCell(row, label, value) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value || value === 0 ? value : "-";
  row.appendChild(cell);
}

function appendStackCell(row, label, lines) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  const wrapper = document.createElement("div");
  wrapper.className = "stacked-cell";

  lines.filter(Boolean).forEach((line, index) => {
    const element = document.createElement(index === 0 ? "strong" : "span");
    element.className = index === 0 ? "stacked-cell__primary" : "stacked-cell__secondary";
    element.textContent = line;
    wrapper.appendChild(element);
  });

  if (!wrapper.childElementCount) {
    wrapper.textContent = "-";
  }

  cell.appendChild(wrapper);
  row.appendChild(cell);
}

function appendTagCell(row, label, value, extraClass) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  const tag = document.createElement("span");
  tag.className = `tag ${extraClass || ""}`.trim();
  tag.textContent = value;
  cell.appendChild(tag);
  row.appendChild(cell);
}

function appendActionCell(row, canEdit, onEdit) {
  const cell = document.createElement("td");
  cell.dataset.label = "Amallar";
  cell.textContent = canEdit ? "" : "Ko'rish";

  if (canEdit) {
    const wrapper = document.createElement("div");
    wrapper.className = "row-actions";
    wrapper.appendChild(createRowButton("Tahrirlash", onEdit));
    cell.appendChild(wrapper);
  }

  row.appendChild(cell);
}

function appendCatalogActionCell(row, canEdit, onEdit, onDelete) {
  const cell = document.createElement("td");
  cell.dataset.label = "Amallar";
  cell.textContent = canEdit ? "" : "Ko'rish";

  if (canEdit) {
    const wrapper = document.createElement("div");
    wrapper.className = "row-actions";
    wrapper.appendChild(createRowButton("Tahrirlash", onEdit));
    wrapper.appendChild(createRowButton("O'chirish", onDelete));
    cell.appendChild(wrapper);
  }

  row.appendChild(cell);
}

function createRowButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "row-action";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function fillInventoryForm(record) {
  recordIdInput.value = String(record.id);
  firstNameInput.value = record.firstName;
  lastNameInput.value = record.lastName;
  departmentSelect.value = String(record.departmentId || "");
  deviceSelect.value = String(record.deviceId || "");
  assetTagInput.value = record.assetTag || "";
  serialNumberInput.value = record.serialNumber || "";
  assetStatusSelect.value = record.assetStatus || state.assetStatuses[0]?.value || "";
  conditionStatusSelect.value = record.conditionStatus || state.conditionStatuses[0]?.value || "";
  purchaseDateInput.value = record.purchaseDate || "";
  assignedAtInput.value = record.assignedAt || "";
  warrantyUntilInput.value = record.warrantyUntil || "";
  supplierInput.value = record.supplier || "";
  officeLocationInput.value = record.officeLocation || "";
  accessoriesInput.value = record.accessories || "";
  previousHolderInput.value = record.previousHolder === "-" ? "" : record.previousHolder;
  currentHolderInput.value = record.currentHolder;
  notesInput.value = record.notes || "";
  submitButton.textContent = "Yangilash";
  cancelEditButton.classList.remove("hidden");
}

function fillDepartmentForm(department) {
  departmentCatalogId.value = String(department.id);
  departmentNameInput.value = department.name;
  departmentCodeInput.value = department.code || "";
  departmentDescriptionInput.value = department.description || "";
  departmentIsActiveInput.checked = Boolean(department.isActive);
  departmentSubmitButton.textContent = "Yangilash";
  cancelDepartmentEditButton.classList.remove("hidden");
}

function fillDeviceForm(device) {
  deviceCatalogId.value = String(device.id);
  deviceCatalogNameInput.value = device.name;
  deviceCategoryInput.value = device.category || "";
  deviceModelInput.value = device.model || "";
  deviceDescriptionInput.value = device.description || "";
  deviceIsActiveInput.checked = Boolean(device.isActive);
  deviceSubmitButton.textContent = "Yangilash";
  cancelDeviceEditButton.classList.remove("hidden");
}

function fillUserForm(user) {
  userIdInput.value = String(user.id);
  userFullNameInput.value = user.fullName;
  userUsernameInput.value = user.username;
  userRoleSelect.value = user.role;
  userPasswordInput.value = "";
  userIsActiveInput.checked = Boolean(user.isActive);
  userSubmitButton.textContent = "Yangilash";
  cancelUserEditButton.classList.remove("hidden");
}

function resetInventoryForm() {
  inventoryForm.reset();
  recordIdInput.value = "";
  assetStatusSelect.value = state.assetStatuses[0]?.value || "";
  conditionStatusSelect.value = state.conditionStatuses[0]?.value || "";
  submitButton.textContent = "Saqlash";
  cancelEditButton.classList.add("hidden");
}

function resetQuickDepartmentForm() {
  quickDepartmentForm.reset();
  quickDepartmentForm.classList.add("hidden");
}

function resetQuickDeviceForm() {
  quickDeviceForm.reset();
  quickDeviceForm.classList.add("hidden");
}

function resetDepartmentForm() {
  departmentForm.reset();
  departmentCatalogId.value = "";
  departmentIsActiveInput.checked = true;
  departmentSubmitButton.textContent = "Saqlash";
  cancelDepartmentEditButton.classList.add("hidden");
}

function resetDeviceForm() {
  deviceForm.reset();
  deviceCatalogId.value = "";
  deviceIsActiveInput.checked = true;
  deviceSubmitButton.textContent = "Saqlash";
  cancelDeviceEditButton.classList.add("hidden");
}

function resetUserForm() {
  userForm.reset();
  userIdInput.value = "";
  userIsActiveInput.checked = true;
  userSubmitButton.textContent = "Saqlash";
  cancelUserEditButton.classList.add("hidden");
}

function activateTab(tabName) {
  state.activeTab = tabName;
  tabButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tabTarget === tabName));
  document.querySelectorAll(".app-tab").forEach((tab) => {
    tab.classList.toggle("hidden", tab.id !== `tab${capitalize(tabName)}`);
  });
}

function confirmLogout() {
  if (!logoutDialog || typeof logoutDialog.showModal !== "function") {
    return Promise.resolve(window.confirm("Tizimdan chiqishni xohlaysizmi?"));
  }

  if (logoutDialog.open) {
    logoutDialog.close("cancel");
  }

  return new Promise((resolve) => {
    const handleClose = () => {
      cleanup();
      resolve(logoutDialog.returnValue === "confirm");
    };

    const handleCancel = (event) => {
      event.preventDefault();
      logoutDialog.close("cancel");
    };

    const handleBackdropClick = (event) => {
      const bounds = logoutDialog.getBoundingClientRect();
      const clickedInside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;

      if (!clickedInside) {
        logoutDialog.close("cancel");
      }
    };

    const handleCancelClick = () => logoutDialog.close("cancel");
    const handleConfirmClick = () => logoutDialog.close("confirm");

    function cleanup() {
      logoutDialog.removeEventListener("close", handleClose);
      logoutDialog.removeEventListener("cancel", handleCancel);
      logoutDialog.removeEventListener("click", handleBackdropClick);
      logoutDialogCancelButton?.removeEventListener("click", handleCancelClick);
      logoutDialogConfirmButton?.removeEventListener("click", handleConfirmClick);
    }

    logoutDialog.addEventListener("close", handleClose);
    logoutDialog.addEventListener("cancel", handleCancel);
    logoutDialog.addEventListener("click", handleBackdropClick);
    logoutDialogCancelButton?.addEventListener("click", handleCancelClick);
    logoutDialogConfirmButton?.addEventListener("click", handleConfirmClick);
    logoutDialog.showModal();
    logoutDialogConfirmButton?.focus();
  });
}

function fillSelectOptions(select, items, options = {}) {
  const previousValue = options.keepValue ? select.value : "";
  select.innerHTML = "";

  if (options.placeholder !== undefined) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.placeholder;
    select.appendChild(placeholder);
  }

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  });

  if (previousValue && [...select.options].some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}

function getFilteredDepartments() {
  const search = normalizeSearchValue(departmentCatalogSearchInput.value);

  if (!search) {
    return state.departments;
  }

  return state.departments.filter((department) => {
    return [department.name, department.code, department.description]
      .some((value) => normalizeSearchValue(value).includes(search));
  });
}

function getFilteredDevices() {
  const search = normalizeSearchValue(deviceCatalogSearchInput.value);

  if (!search) {
    return state.devices;
  }

  return state.devices.filter((device) => {
    return [device.name, device.category, device.model, device.description]
      .some((value) => normalizeSearchValue(value).includes(search));
  });
}

function scheduleCatalogRender() {
  window.clearTimeout(state.catalogSearchDebounceId);
  state.catalogSearchDebounceId = window.setTimeout(() => {
    renderDepartments();
    renderDevices();
  }, 180);
}

function getInventoryPayload() {
  return {
    accessories: accessoriesInput.value.trim(),
    assetStatus: assetStatusSelect.value,
    assetTag: assetTagInput.value.trim(),
    assignedAt: assignedAtInput.value,
    conditionStatus: conditionStatusSelect.value,
    currentHolder: currentHolderInput.value.trim(),
    departmentId: departmentSelect.value,
    deviceId: deviceSelect.value,
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    notes: notesInput.value.trim(),
    officeLocation: officeLocationInput.value.trim(),
    previousHolder: previousHolderInput.value.trim(),
    purchaseDate: purchaseDateInput.value,
    serialNumber: serialNumberInput.value.trim(),
    supplier: supplierInput.value.trim(),
    warrantyUntil: warrantyUntilInput.value,
  };
}

function getDepartmentPayload() {
  return {
    code: departmentCodeInput.value.trim(),
    description: departmentDescriptionInput.value.trim(),
    isActive: departmentIsActiveInput.checked,
    name: departmentNameInput.value.trim(),
  };
}

function getDevicePayload() {
  return {
    category: deviceCategoryInput.value.trim(),
    description: deviceDescriptionInput.value.trim(),
    isActive: deviceIsActiveInput.checked,
    model: deviceModelInput.value.trim(),
    name: deviceCatalogNameInput.value.trim(),
  };
}

function getQuickDepartmentPayload() {
  return {
    code: quickDepartmentCodeInput.value.trim(),
    description: quickDepartmentDescriptionInput.value.trim(),
    isActive: true,
    name: quickDepartmentNameInput.value.trim(),
  };
}

function getQuickDevicePayload() {
  return {
    category: quickDeviceCategoryInput.value.trim(),
    description: quickDeviceDescriptionInput.value.trim(),
    isActive: true,
    model: quickDeviceModelInput.value.trim(),
    name: quickDeviceNameInput.value.trim(),
  };
}

function getUserPayload() {
  return {
    fullName: userFullNameInput.value.trim(),
    isActive: userIsActiveInput.checked,
    password: userPasswordInput.value,
    role: userRoleSelect.value,
    username: userUsernameInput.value.trim(),
  };
}

function getRoleLabel(role) {
  const label = state.roles.find((item) => item.value === role)?.label || role;
  return localizeRoleLabel(label);
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDepartmentOption(department) {
  const name = localizeDepartmentName(department.name);
  return department.code ? `${name} (${department.code})` : name;
}

function formatDeviceOption(device) {
  const meta = [];
  const normalizedName = String(device.name || "").toLowerCase();

  if (device.category) {
    meta.push(localizeDeviceCategory(device.category));
  }

  if (device.model && !normalizedName.includes(String(device.model).toLowerCase())) {
    meta.push(device.model);
  }

  return meta.length ? `${device.name} | ${meta.join(" | ")}` : device.name;
}

function localizeDepartmentName(value) {
  const labels = {
    "Software Engineering": "Dasturiy muhandislik",
    "Frontend Development": "Interfeys ishlab chiqish",
    "Backend Development": "Server tomoni ishlab chiqish",
    "Mobile Development": "Mobil ishlab chiqish",
    "QA & Test Automation": "Sifat nazorati va test avtomatlashtirish",
    "DevOps & SRE": "Infratuzilma va barqarorlik",
    "Product Management": "Mahsulot boshqaruvi",
    "Project Management": "Loyiha boshqaruvi",
    "UI/UX Design": "Interfeys va foydalanuvchi tajribasi dizayni",
    "Data & Analytics": "Ma'lumotlar va tahlil",
    Cybersecurity: "Kiberxavfsizlik",
    "IT Support": "IT yordam",
    "Infrastructure & Network": "Infratuzilma va tarmoq",
    "HR & People Ops": "Kadrlar va xodimlar bilan ishlash",
    "Finance & Accounting": "Moliya va buxgalteriya",
    Sales: "Savdo",
    Marketing: "Marketing",
    "Customer Success": "Mijozlar bilan ishlash",
  };

  return labels[value] || value || "-";
}

function localizeDeviceCategory(value) {
  const labels = {
    Laptop: "Noutbuk",
    Monitor: "Monitor",
    "Docking Station": "Dok stansiya",
    Keyboard: "Klaviatura",
    Mouse: "Sichqoncha",
    Headset: "Garnitura",
    Webcam: "Veb-kamera",
    Smartphone: "Smartfon",
    Tablet: "Planshet",
    Network: "Tarmoq uskunasi",
    Power: "Quvvat qurilmasi",
    Printer: "Printer",
    Peripheral: "Periferiya",
    Desktop: "Stol kompyuteri",
  };

  return labels[value] || value || "";
}

function localizeRoleLabel(value) {
  const labels = {
    Administrator: "Administrator",
    Auditor: "Auditor",
    Manager: "Menejer",
    "IT Support": "IT yordam",
    Viewer: "Kuzatuvchi",
  };

  return labels[value] || value || "-";
}

function formatAuditEntityLabel(value) {
  const labels = {
    auth: "Kirish",
    inventory: "Inventar",
    department: "Bo'lim",
    device: "Texnika",
    user: "Foydalanuvchi",
    system: "Tizim",
  };

  return labels[value] || value || "-";
}

function formatAuditActionLabel(value) {
  const labels = {
    "auth.login_failed": "Kirish muvaffaqiyatsiz",
    "auth.login_success": "Kirish muvaffaqiyatli",
    "auth.logout": "Tizimdan chiqish",
    "auth.password_change": "Parol yangilandi",
    "inventory.create": "Inventar yozuvi yaratildi",
    "inventory.update": "Inventar yozuvi yangilandi",
    "inventory.delete": "Inventar yozuvi o'chirildi",
    "inventory.service_log_create": "Servis yozuvi qo'shildi",
    "inventory.attachment_create": "Fayl qo'shildi",
    "inventory.import": "Inventar import qilindi",
    "catalog.department_create": "Bo'lim qo'shildi",
    "catalog.department_update": "Bo'lim yangilandi",
    "catalog.department_delete": "Bo'lim o'chirildi",
    "catalog.device_create": "Texnika qo'shildi",
    "catalog.device_update": "Texnika yangilandi",
    "catalog.device_delete": "Texnika o'chirildi",
    "user.create": "Foydalanuvchi yaratildi",
    "user.update": "Foydalanuvchi yangilandi",
    "system.restore": "Tizim tiklandi",
  };

  return labels[value] || value || "-";
}

function localizeUiText(value) {
  return String(value || "")
    .replace(/\battachment\b/gi, "fayl")
    .replace(/\battachments\b/gi, "fayllar")
    .replace(/\bbackup\b/gi, "zaxira nusxasi")
    .replace(/\brestore\b/gi, "tiklash")
    .replace(/\bSystem summary\b/gi, "Tizim xulosasi")
    .replace(/\bAsset tag\b/gi, "Aktiv tegi")
    .replace(/\bStatus\b/gi, "Holati")
    .replace(/\bSupplier\b/gi, "Yetkazib beruvchi")
    .replace(/\bHolder\b/gi, "Egasi")
    .trim() || "-";
}

function showQuickCatalogForm(type) {
  if (type === "department") {
    quickDeviceForm.classList.add("hidden");
    quickDepartmentForm.classList.remove("hidden");
    quickDepartmentNameInput.focus();
    return;
  }

  quickDepartmentForm.classList.add("hidden");
  quickDeviceForm.classList.remove("hidden");
  quickDeviceNameInput.focus();
}

function showApp() {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  clearAuthFeedback();
  activateTab(state.activeTab);
}

function showAuth() {
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
  statusBanner.classList.add("hidden");
}

function showAuthFeedback(message) {
  authFeedback.textContent = message;
  authFeedback.classList.remove("hidden");
}

function clearAuthFeedback() {
  authFeedback.textContent = "";
  authFeedback.classList.add("hidden");
}

function showStatus(message, type = "success") {
  window.clearTimeout(state.statusTimeoutId);
  statusBanner.textContent = message;
  statusBanner.classList.remove("hidden", "status-banner--error");

  if (type === "error") {
    statusBanner.classList.add("status-banner--error");
  }

  state.statusTimeoutId = window.setTimeout(() => statusBanner.classList.add("hidden"), 3600);
}

function setAuthBusy(isBusy) {
  loginButton.disabled = isBusy;
  loginUsernameInput.disabled = isBusy;
  loginPasswordInput.disabled = isBusy;
  loginButton.textContent = isBusy ? "Tekshirilmoqda..." : "Kirish";
}

function setInventoryBusy(isBusy) {
  submitButton.disabled = isBusy;
  resetButton.disabled = isBusy;
  cancelEditButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "Saqlanmoqda..." : recordIdInput.value ? "Yangilash" : "Saqlash";
}

async function request(url, options = {}) {
  const fetchOptions = {
    credentials: "same-origin",
    method: options.method || "GET",
    signal: options.signal,
  };

  if (options.body instanceof FormData) {
    fetchOptions.body = options.body;
  } else if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
    fetchOptions.headers = {
      "Content-Type": "application/json",
    };
  }

  const response = await fetch(url, fetchOptions);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.message || "So'rov bajarilmadi.");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function downloadInventory(pathname) {
  const url = new URL(pathname, window.location.origin);

  if (searchInput.value.trim()) {
    url.searchParams.set("search", searchInput.value.trim());
  }

  if (filterDepartmentSelect.value) {
    url.searchParams.set("departmentId", filterDepartmentSelect.value);
  }

  if (filterDeviceSelect.value) {
    url.searchParams.set("deviceId", filterDeviceSelect.value);
  }

  if (filterAssetStatusSelect.value) {
    url.searchParams.set("assetStatus", filterAssetStatusSelect.value);
  }

  if (filterConditionStatusSelect.value) {
    url.searchParams.set("conditionStatus", filterConditionStatusSelect.value);
  }

  window.open(url.toString(), "_blank", "noopener");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) {
    return "-";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-");
    return `${day}.${month}.${year}`;
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getAssetStatusLabel(value) {
  return state.assetStatuses.find((item) => item.value === value)?.label || value || "-";
}

function getConditionStatusLabel(value) {
  return state.conditionStatuses.find((item) => item.value === value)?.label || value || "-";
}

function getAssetStatusClass(value) {
  switch (value) {
    case "repair":
      return "tag--danger";
    case "reserved":
      return "tag--warning";
    case "retired":
      return "tag--muted";
    case "in_stock":
      return "tag--info";
    default:
      return "";
  }
}

function getConditionStatusClass(value) {
  switch (value) {
    case "damaged":
      return "tag--danger";
    case "fair":
      return "tag--warning";
    case "new":
      return "tag--info";
    default:
      return "";
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function handleError(error) {
  showStatus(error.message, "error");
}
