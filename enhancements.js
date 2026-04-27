(function () {
  const settingsTabButton = document.querySelector("#settingsTabButton");
  const passwordChangeNotice = document.querySelector("#passwordChangeNotice");
  const passwordChangeRequiredBanner = document.querySelector("#passwordChangeRequiredBanner");
  const globalSearchInput = document.querySelector("#globalSearchInput");
  const globalSearchResults = document.querySelector("#globalSearchResults");
  const globalSearchBox = document.querySelector("#globalSearchBox");
  const themeToggleButton = document.querySelector("#themeToggleButton");
  const purchasePriceInput = document.querySelector("#purchasePrice");
  const branchInput = document.querySelector("#branch");
  const roomInput = document.querySelector("#room");
  const deskInput = document.querySelector("#desk");
  const sortBySelect = document.querySelector("#sortBySelect");
  const sortDirectionSelect = document.querySelector("#sortDirectionSelect");
  const pageSizeSelect = document.querySelector("#pageSizeSelect");
  const saveFiltersButton = document.querySelector("#saveFiltersButton");
  const applySavedFiltersButton = document.querySelector("#applySavedFiltersButton");
  const clearFiltersButton = document.querySelector("#clearFiltersButton");
  const previewImportButton = document.querySelector("#previewImportButton");
  const previewImportFileInput = document.querySelector("#previewImportFileInput");
  const importPreviewPanel = document.querySelector("#importPreviewPanel");
  const importPreviewSummary = document.querySelector("#importPreviewSummary");
  const importPreviewErrors = document.querySelector("#importPreviewErrors");
  const importPreviewTableBody = document.querySelector("#importPreviewTableBody");
  const importConflictStrategySelect = document.querySelector("#importConflictStrategy");
  const confirmImportButton = document.querySelector("#confirmImportButton");
  const cancelImportPreviewButton = document.querySelector("#cancelImportPreviewButton");
  const paginationSummary = document.querySelector("#paginationSummary");
  const paginationIndicator = document.querySelector("#paginationIndicator");
  const previousPageButton = document.querySelector("#previousPageButton");
  const nextPageButton = document.querySelector("#nextPageButton");
  const inventoryDetailPanel = document.querySelector("#inventoryDetailPanel");
  const detailTitle = document.querySelector("#detailTitle");
  const detailSubtitle = document.querySelector("#detailSubtitle");
  const detailMetaList = document.querySelector("#detailMetaList");
  const detailQrImage = document.querySelector("#detailQrImage");
  const detailQrLink = document.querySelector("#detailQrLink");
  const transferTimeline = document.querySelector("#transferTimeline");
  const serviceLogForm = document.querySelector("#serviceLogForm");
  const serviceDateInput = document.querySelector("#serviceDateInput");
  const serviceTypeInput = document.querySelector("#serviceTypeInput");
  const serviceVendorInput = document.querySelector("#serviceVendorInput");
  const serviceCostInput = document.querySelector("#serviceCostInput");
  const serviceNotesInput = document.querySelector("#serviceNotesInput");
  const serviceLogSubmitButton = document.querySelector("#serviceLogSubmitButton");
  const serviceLogList = document.querySelector("#serviceLogList");
  const attachmentFileInput = document.querySelector("#attachmentFileInput");
  const attachmentPickButton = document.querySelector("#attachmentPickButton");
  const attachmentUploadButton = document.querySelector("#attachmentUploadButton");
  const attachmentList = document.querySelector("#attachmentList");
  const refreshDetailButton = document.querySelector("#refreshDetailButton");
  const detailEditButton = document.querySelector("#detailEditButton");
  const detailTransferButton = document.querySelector("#detailTransferButton");
  const detailRepairButton = document.querySelector("#detailRepairButton");
  const detailRetireButton = document.querySelector("#detailRetireButton");
  const transferForm = document.querySelector("#transferForm");
  const transferHolderInput = document.querySelector("#transferHolderInput");
  const transferDepartmentSelect = document.querySelector("#transferDepartmentSelect");
  const transferStatusSelect = document.querySelector("#transferStatusSelect");
  const transferDateInput = document.querySelector("#transferDateInput");
  const transferNotesInput = document.querySelector("#transferNotesInput");
  const transferSubmitButton = document.querySelector("#transferSubmitButton");
  const transferCancelButton = document.querySelector("#transferCancelButton");
  const userMustChangePasswordInput = document.querySelector("#userMustChangePassword");
  const passwordChangeForm = document.querySelector("#passwordChangeForm");
  const currentPasswordInput = document.querySelector("#currentPasswordInput");
  const newPasswordInput = document.querySelector("#newPasswordInput");
  const confirmPasswordInput = document.querySelector("#confirmPasswordInput");
  const passwordChangeButton = document.querySelector("#passwordChangeButton");
  const openHtmlReportButton = document.querySelector("#openHtmlReportButton");
  const downloadJsonReportButton = document.querySelector("#downloadJsonReportButton");
  const refreshSystemButton = document.querySelector("#refreshSystemButton");
  const systemMetricsGrid = document.querySelector("#systemMetricsGrid");
  const downloadBackupButton = document.querySelector("#downloadBackupButton");
  const pickRestoreFileButton = document.querySelector("#pickRestoreFileButton");
  const restoreBackupButton = document.querySelector("#restoreBackupButton");
  const restoreFileInput = document.querySelector("#restoreFileInput");
  const backupRunsList = document.querySelector("#backupRunsList");

  const STORAGE_KEYS = {
    inventoryFilters: "inventory-platform.filters.v1",
    theme: "inventory-platform.theme.v1",
  };

  const enhancementState = {
    detail: null,
    detailRecordId: null,
    globalSearchDebounceId: 0,
    inventoryPagination: {
      page: 1,
      pageSize: Number(pageSizeSelect?.value || 25),
      totalPages: 1,
    },
    pendingAttachmentFile: null,
    pendingImportHasBlockingConflicts: false,
    pendingImportFile: null,
    pendingSavedFilters: null,
    pendingRestoreFile: null,
    reportSummary: null,
    systemMetrics: null,
  };

  const originalRequest = request;
  const originalApplySession = applySession;
  const originalRenderInventory = renderInventory;
  const originalFillInventoryForm = fillInventoryForm;
  const originalResetInventoryForm = resetInventoryForm;
  const originalRenderUsers = renderUsers;
  const originalFillUserForm = fillUserForm;
  const originalResetUserForm = resetUserForm;

  applyStoredTheme();
  applyStoredFilters();
  patchRuntime();
  registerEnhancementEvents();
  recoverSessionAfterEnhancements().catch(() => {
  });

  function patchRuntime() {
    request = async function enhancedRequest(url, options = {}) {
      try {
        return await originalRequest(url, options);
      } catch (error) {
        if (error.status === 403 && /parolni yangilang/i.test(error.message || "")) {
          syncPasswordChangeState(true);
          showApp();
          activateTab("settings");
        }

        throw error;
      }
    };

    applySession = function enhancedApplySession(session) {
      originalApplySession(session);
      syncPasswordChangeState();
      renderSettingsSummary();
    };

    refreshDashboardData = async function enhancedRefreshDashboardData() {
      if (state.user?.mustChangePassword) {
        renderSessionIdentity();
        renderRoleOptions();
        renderReferenceOptions();
        state.users = [];
        state.auditLogs = [];
        state.auditSettings = {
          autoRefreshSeconds: 30,
          retentionDays: 90,
        };
        state.dashboardOverview = null;
        enhancementState.systemMetrics = null;
        enhancementState.reportSummary = null;
        renderInventory([], {});
        renderDashboard(null);
        renderUsers();
        renderAuditLogs([]);
        renderAuditAutomationState();
        applyPermissionUI();
        renderSettingsSummary();
        activateTab("settings");
        return;
      }

      const payload = await request("/api/dashboard");
      state.departments = payload.departments || [];
      state.devices = payload.devices || [];
      state.assetStatuses = payload.inventoryMeta?.assetStatuses || [];
      state.conditionStatuses = payload.inventoryMeta?.conditionStatuses || [];
      state.auditSettings = payload.auditSettings || state.auditSettings;
      state.auditLastLoadedAt = payload.auditRefreshedAt || state.auditLastLoadedAt;
      state.dashboardOverview = payload.overview || null;
      state.users = payload.users || [];
      state.auditLogs = payload.auditLogs || [];
      state.roles = payload.roles || [];
      state.user = payload.user || state.user;
      state.backupRuns = payload.backupRuns || [];
      enhancementState.systemMetrics = payload.systemMetrics || null;
      enhancementState.reportSummary = payload.overview
        ? {
            generatedAt: new Date().toISOString(),
            metrics: payload.systemMetrics || null,
            overview: payload.overview,
          }
        : null;
      renderSessionIdentity();
      renderRoleOptions();
      renderReferenceOptions();
      renderDashboard(state.dashboardOverview);
      renderDepartments();
      renderDevices();
      renderUsers();
      renderAuditLogs(state.auditLogs);
      renderAuditAutomationState();
      applyPermissionUI();
      renderSettingsSummary();

      if (enhancementState.detailRecordId) {
        loadInventoryDetail(enhancementState.detailRecordId, { silent: true }).catch(() => {
        });
      }
    };

    loadInventory = async function enhancedLoadInventory(options = {}) {
      if (state.user?.mustChangePassword) {
        state.inventoryRecords = [];
        enhancementState.inventoryPagination = {
          page: 1,
          pageSize: Number(pageSizeSelect?.value || 25),
          totalPages: 1,
        };
        renderInventory([], {});
        return;
      }

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

      if (sortBySelect.value) {
        url.searchParams.set("sortBy", sortBySelect.value);
      }

      if (sortDirectionSelect.value) {
        url.searchParams.set("sortDir", sortDirectionSelect.value);
      }

      url.searchParams.set("page", String(enhancementState.inventoryPagination.page || 1));
      url.searchParams.set("pageSize", String(Number(pageSizeSelect.value) || 25));

      if (!options.silent) {
        tableSummary.textContent = "Yozuvlar bazadan yuklanmoqda...";
      }

      try {
        const payload = await request(url.toString(), {
          signal: controller.signal,
        });

        state.inventoryRecords = payload.records || [];
        enhancementState.inventoryPagination = payload.pagination || {
          page: 1,
          pageSize: Number(pageSizeSelect.value) || 25,
          totalPages: 1,
        };
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
    };

    renderInventory = function enhancedRenderInventory(records, stats) {
      inventoryTableBody.innerHTML = "";

      records.forEach((record) => {
        const row = document.createElement("tr");
        row.className = "is-clickable";
        row.tabIndex = 0;
        row.dataset.recordId = String(record.id);
        row.classList.toggle("is-selected", enhancementState.detailRecordId === record.id);
        row.addEventListener("click", (event) => {
          if (event.target.closest("button, a")) {
            return;
          }

          loadInventoryDetail(record.id).catch(handleError);
        });
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            loadInventoryDetail(record.id).catch(handleError);
          }
        });

        appendStackCell(row, "Inventar raqam", [
          record.assetTag || "Tag biriktirilmagan",
          record.serialNumber ? `Serial: ${record.serialNumber}` : "",
        ]);
        appendStackCell(row, "Texnika", [
          record.deviceName,
          record.supplier || record.purchaseDate ? [record.supplier, formatDateOrDash(record.purchaseDate)].filter(Boolean).join(" · ") : "",
        ]);
        appendStackCell(row, "Egasi", [
          record.currentHolder || "-",
          [record.firstName, record.lastName].filter(Boolean).join(" "),
        ]);
        appendCell(row, "Bo'lim", localizeDepartmentName(record.department));
        appendTagCell(row, "Holati", getAssetStatusLabel(record.assetStatus), getAssetStatusClass(record.assetStatus));
        appendStackCell(row, "Lokatsiya", [
          record.officeLocation || [record.branch, record.room, record.desk].filter(Boolean).join(" / ") || "-",
          getConditionStatusLabel(record.conditionStatus),
        ]);
        appendStackCell(row, "Kafolat", [
          record.warrantyUntil ? `Kafolat: ${formatShortDate(record.warrantyUntil)}` : "Kafolat kiritilmagan",
          getWarrantyHint(record.warrantyUntil),
        ]);

        const actionsCell = document.createElement("td");
        actionsCell.dataset.label = "Amallar";
        const actions = document.createElement("div");
        actions.className = "row-actions";
        actions.appendChild(createRowButton("Ko'rish", () => {
          loadInventoryDetail(record.id).catch(handleError);
        }));

        if (state.permissions.manageInventory) {
          actions.appendChild(createRowButton("Tahrirlash", () => {
            originalFillInventoryForm(record);
            purchasePriceInput.value = record.purchasePrice || "";
            branchInput.value = record.branch || "";
            roomInput.value = record.room || "";
            deskInput.value = record.desk || "";
            loadInventoryDetail(record.id, { silent: true }).catch(() => {
            });
          }));
          actions.appendChild(createRowButton("O'chirish", async () => {
            if (!window.confirm("Ushbu yozuvni o'chirmoqchimisiz?")) {
              return;
            }

            await request(`/api/inventory/${record.id}`, { method: "DELETE" });
            if (enhancementState.detailRecordId === record.id) {
              clearInventoryDetail();
            }
            await loadInventory({ silent: true });
            showStatus("Yozuv o'chirildi.");
          }));
        }

        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);
        inventoryTableBody.appendChild(row);
      });

      emptyState.style.display = records.length ? "none" : "block";
      emptyStateText.textContent = searchInput.value.trim()
        ? "Filter bo'yicha mos yozuv topilmadi. Filtrni tozalang yoki boshqa so'z bilan qidiring."
        : "Hozircha aktiv yo'q. Birinchi aktivni qo'shing yoki Excel orqali import qiling.";
      totalRecordsElement.textContent = stats.totalRecords || 0;
      totalDepartmentsElement.textContent = stats.totalDepartments || 0;
      activeDevicesElement.textContent = stats.activeDevices || 0;
      tableSummary.textContent = `${stats.totalRecords || 0} ta yozuv. ${stats.inUseCount || 0} ishlatilmoqda, ${stats.repairCount || 0} ta'mirda, ${stats.warrantyExpiringCount || 0} kafolat muddatiga yaqin.`;

      const totalPages = enhancementState.inventoryPagination.totalPages || 1;
      const currentPage = enhancementState.inventoryPagination.page || 1;
      paginationSummary.textContent = `${stats.totalRecords || 0} ta yozuvdan ${records.length} tasi ko'rsatildi`;
      paginationIndicator.textContent = `${currentPage} / ${totalPages}`;
      previousPageButton.disabled = currentPage <= 1;
      nextPageButton.disabled = currentPage >= totalPages;

      if (typeof renderHolderSuggestions === "function") {
        renderHolderSuggestions();
      }
    };

    getInventoryPayload = function enhancedGetInventoryPayload() {
      const payload = {
        accessories: accessoriesInput.value.trim(),
        assetStatus: assetStatusSelect.value,
        assetTag: assetTagInput.value.trim(),
        assignedAt: assignedAtInput.value,
        branch: branchInput.value.trim(),
        conditionStatus: conditionStatusSelect.value,
        currentHolder: currentHolderInput.value.trim(),
        departmentId: departmentSelect.value,
        desk: deskInput.value.trim(),
        deviceId: deviceSelect.value,
        firstName: firstNameInput.value.trim(),
        lastName: lastNameInput.value.trim(),
        notes: notesInput.value.trim(),
        officeLocation: officeLocationInput.value.trim(),
        previousHolder: previousHolderInput.value.trim(),
        purchaseDate: purchaseDateInput.value,
        purchasePrice: purchasePriceInput.value,
        room: roomInput.value.trim(),
        serialNumber: serialNumberInput.value.trim(),
        supplier: supplierInput.value.trim(),
        warrantyUntil: warrantyUntilInput.value,
      };

      return payload;
    };

    fillInventoryForm = function enhancedFillInventoryForm(record) {
      originalFillInventoryForm(record);
      purchasePriceInput.value = record.purchasePrice || "";
      branchInput.value = record.branch || "";
      roomInput.value = record.room || "";
      deskInput.value = record.desk || "";
      if (typeof syncInventoryWizardUI === "function") {
        syncInventoryWizardUI();
      }
    };

    resetInventoryForm = function enhancedResetInventoryForm() {
      originalResetInventoryForm();
      purchasePriceInput.value = "";
      branchInput.value = "";
      roomInput.value = "";
      deskInput.value = "";
      if (typeof syncInventoryWizardUI === "function") {
        syncInventoryWizardUI();
      }
    };

    getUserPayload = function enhancedGetUserPayload() {
      return {
        fullName: userFullNameInput.value.trim(),
        isActive: userIsActiveInput.checked,
        mustChangePassword: userMustChangePasswordInput.checked,
        password: userPasswordInput.value,
        role: userRoleSelect.value,
        username: userUsernameInput.value.trim(),
      };
    };

    fillUserForm = function enhancedFillUserForm(user) {
      originalFillUserForm(user);
      userMustChangePasswordInput.checked = Boolean(user.mustChangePassword);
    };

    resetUserForm = function enhancedResetUserForm() {
      originalResetUserForm();
      userMustChangePasswordInput.checked = false;
    };

    renderUsers = function enhancedRenderUsers() {
      usersTableBody.innerHTML = "";
      state.users.forEach((user) => {
        const row = document.createElement("tr");
        appendCell(row, "F.I.Sh.", user.fullName);
        appendCell(row, "Login", user.username);
        appendCell(row, "Rol", getRoleLabel(user.role));
        appendStackCell(row, "Xavfsizlik", [
          user.mustChangePassword ? "Parol yangilashi shart" : "Parol normal",
          user.failedLoginAttempts ? `${user.failedLoginAttempts} xato urinish` : user.lockedUntil ? "Vaqtincha bloklangan" : "",
        ]);
        appendTagCell(row, "Holat", user.isActive ? "Faol" : "Nofaol", user.isActive ? "" : "tag--danger");
        appendCell(row, "Oxirgi login", formatDateOrDash(user.lastLoginAt));
        appendActionCell(row, true, () => fillUserForm(user));
        usersTableBody.appendChild(row);
      });
    };

    applyPermissionUI = function enhancedApplyPermissionUI() {
      const canManageInventory = Boolean(state.permissions.manageInventory);
      const canManageCatalogs = Boolean(state.permissions.manageCatalogs);
      const canManageUsers = Boolean(state.permissions.manageUsers);
      const canViewAudit = Boolean(state.permissions.viewAudit);
      const canUseSettings = true;
      const mustChangePassword = Boolean(state.user?.mustChangePassword);

      usersTabButton.classList.toggle("hidden", !canManageUsers);
      auditTabButton.classList.toggle("hidden", !canViewAudit);
      settingsTabButton.classList.toggle("hidden", !canUseSettings);
      inventoryAccessNote.classList.toggle("hidden", canManageInventory);
      catalogAccessNote.classList.toggle("hidden", canManageCatalogs);
      downloadTemplateButton.classList.toggle("hidden", !state.permissions.importInventory);
      importButton.classList.toggle("hidden", !state.permissions.importInventory);
      previewImportButton.classList.toggle("hidden", !state.permissions.importInventory);
      exportExcelButton.classList.toggle("hidden", !state.permissions.exportInventory);
      exportCsvButton.classList.toggle("hidden", !state.permissions.exportInventory);
      quickCatalogPanel.classList.toggle("hidden", !canManageCatalogs);
      setFormEnabled(inventoryForm, canManageInventory && !mustChangePassword);
      setFormEnabled(departmentForm, canManageCatalogs && !mustChangePassword);
      setFormEnabled(deviceForm, canManageCatalogs && !mustChangePassword);
      setFormEnabled(userForm, canManageUsers && !mustChangePassword);

      tabButtons.forEach((button) => {
        if (button.dataset.tabTarget === "settings") {
          button.disabled = false;
          return;
        }

        button.disabled = mustChangePassword;
      });

      passwordChangeNotice.classList.toggle("hidden", !mustChangePassword);
      passwordChangeRequiredBanner.classList.toggle("hidden", !mustChangePassword);
      openHtmlReportButton.disabled = !state.permissions.viewReports || mustChangePassword;
      downloadJsonReportButton.disabled = !state.permissions.viewReports || mustChangePassword;
      refreshSystemButton.disabled = mustChangePassword;
      downloadBackupButton.disabled = !state.permissions.manageBackups || mustChangePassword;
      pickRestoreFileButton.disabled = !state.permissions.manageBackups || mustChangePassword;
      restoreBackupButton.disabled = !state.permissions.manageBackups || mustChangePassword;
      auditSearchInput.disabled = !canViewAudit || mustChangePassword;
      auditEntityFilter.disabled = !canViewAudit || mustChangePassword;
      auditRetentionSelect.disabled = !state.permissions.manageSettings || mustChangePassword;
      saveAuditRetentionButton.classList.toggle("hidden", !state.permissions.manageSettings);
      saveAuditRetentionButton.disabled = !state.permissions.manageSettings || mustChangePassword;
      refreshAuditButton.disabled = !canViewAudit || mustChangePassword;
      archiveAuditButton.disabled = !canViewAudit || mustChangePassword;
      auditAutomationNote.classList.toggle("hidden", !canViewAudit);
      detailEditButton.classList.toggle("hidden", !canManageInventory);
      detailTransferButton.classList.toggle("hidden", !canManageInventory);
      detailRepairButton.classList.toggle("hidden", !canManageInventory);
      detailRetireButton.classList.toggle("hidden", !canManageInventory);
      transferForm.classList.toggle("hidden", transferForm.classList.contains("hidden") || !canManageInventory || mustChangePassword || !enhancementState.detailRecordId);
      setFormEnabled(transferForm, canManageInventory && !mustChangePassword && Boolean(enhancementState.detailRecordId));
      attachmentPickButton.disabled = !state.permissions.manageAttachments || mustChangePassword || !enhancementState.detailRecordId;
      attachmentUploadButton.disabled = !state.permissions.manageAttachments || mustChangePassword || !enhancementState.detailRecordId;
      serviceLogSubmitButton.disabled = !state.permissions.manageService || mustChangePassword || !enhancementState.detailRecordId;
      if (typeof syncOperationalInterface === "function") {
        syncOperationalInterface();
      }

      if (mustChangePassword && state.activeTab !== "settings") {
        activateTab("settings");
      }
    };

    downloadInventory = function enhancedDownloadInventory(pathname) {
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

      if (sortBySelect.value) {
        url.searchParams.set("sortBy", sortBySelect.value);
      }

      if (sortDirectionSelect.value) {
        url.searchParams.set("sortDir", sortDirectionSelect.value);
      }

      window.open(url.toString(), "_blank", "noopener");
    };

    const originalRenderReferenceOptions = renderReferenceOptions;
    renderReferenceOptions = function enhancedRenderReferenceOptions() {
      originalRenderReferenceOptions();

      if (enhancementState.pendingSavedFilters) {
        const saved = enhancementState.pendingSavedFilters;
        filterDepartmentSelect.value = saved.departmentId || "";
        filterDeviceSelect.value = saved.deviceId || "";
        filterAssetStatusSelect.value = saved.assetStatus || "";
        filterConditionStatusSelect.value = saved.conditionStatus || "";
      }
    };
  }

  function registerEnhancementEvents() {
    [searchInput, filterDepartmentSelect, filterDeviceSelect, filterAssetStatusSelect, filterConditionStatusSelect].forEach((element) => {
      element.addEventListener("change", resetToFirstInventoryPage);
      element.addEventListener("input", resetToFirstInventoryPage);
    });

    sortBySelect.addEventListener("change", () => {
      resetToFirstInventoryPage();
      loadInventory({ silent: true }).catch(handleError);
    });

    sortDirectionSelect.addEventListener("change", () => {
      resetToFirstInventoryPage();
      loadInventory({ silent: true }).catch(handleError);
    });

    pageSizeSelect.addEventListener("change", () => {
      resetToFirstInventoryPage();
      loadInventory({ silent: true }).catch(handleError);
    });

    previousPageButton.addEventListener("click", () => {
      enhancementState.inventoryPagination.page = Math.max(1, (enhancementState.inventoryPagination.page || 1) - 1);
      loadInventory({ silent: true }).catch(handleError);
    });

    nextPageButton.addEventListener("click", () => {
      const totalPages = enhancementState.inventoryPagination.totalPages || 1;
      enhancementState.inventoryPagination.page = Math.min(totalPages, (enhancementState.inventoryPagination.page || 1) + 1);
      loadInventory({ silent: true }).catch(handleError);
    });

    saveFiltersButton.addEventListener("click", () => {
      persistFilters();
      showStatus("Joriy filterlar brauzerda saqlandi.");
    });

    applySavedFiltersButton.addEventListener("click", () => {
      applyStoredFilters();
      resetToFirstInventoryPage();
      loadInventory({ silent: true }).catch(handleError);
      showStatus("Saqlangan filterlar qo'llandi.");
    });

    clearFiltersButton.addEventListener("click", () => {
      clearInventoryFilters();
      resetToFirstInventoryPage();
      loadInventory({ silent: true }).catch(handleError);
    });

    previewImportButton.addEventListener("click", () => previewImportFileInput.click());
    previewImportFileInput.addEventListener("change", handleImportPreviewSelection);
    cancelImportPreviewButton.addEventListener("click", clearImportPreview);
    confirmImportButton.addEventListener("click", confirmPreviewImport);
    importConflictStrategySelect.addEventListener("change", updateImportConfirmState);

    refreshDetailButton.addEventListener("click", () => {
      if (!enhancementState.detailRecordId) {
        return;
      }

      loadInventoryDetail(enhancementState.detailRecordId).catch(handleError);
    });
    detailEditButton.addEventListener("click", () => {
      const record = enhancementState.detail?.record;

      if (!record) {
        showStatus("Avval aktiv tanlang.", "error");
        return;
      }

      originalFillInventoryForm(record);
      purchasePriceInput.value = record.purchasePrice || "";
      branchInput.value = record.branch || "";
      roomInput.value = record.room || "";
      deskInput.value = record.desk || "";
    });
    detailTransferButton.addEventListener("click", () => openTransferPanel());
    detailRepairButton.addEventListener("click", () => openTransferPanel("repair"));
    detailRetireButton.addEventListener("click", () => openTransferPanel("retired"));
    transferCancelButton.addEventListener("click", () => transferForm.classList.add("hidden"));
    transferForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitTransfer().catch(handleError);
    });

    serviceLogForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!enhancementState.detailRecordId) {
        showStatus("Avval aktiv tanlang.", "error");
        return;
      }

      serviceLogSubmitButton.disabled = true;

      try {
        await request(`/api/inventory/${enhancementState.detailRecordId}/service-logs`, {
          body: {
            cost: serviceCostInput.value,
            notes: serviceNotesInput.value.trim(),
            serviceDate: serviceDateInput.value,
            serviceType: serviceTypeInput.value.trim(),
            vendor: serviceVendorInput.value.trim(),
          },
          method: "POST",
        });
        serviceLogForm.reset();
        await loadInventoryDetail(enhancementState.detailRecordId, { silent: true });
        await refreshDashboardData();
        showStatus("Servis yozuvi qo'shildi.");
      } catch (error) {
        showStatus(error.message, "error");
      } finally {
        serviceLogSubmitButton.disabled = !state.permissions.manageService;
      }
    });

    attachmentPickButton.addEventListener("click", () => attachmentFileInput.click());
    attachmentFileInput.addEventListener("change", () => {
      enhancementState.pendingAttachmentFile = attachmentFileInput.files?.[0] || null;
      if (enhancementState.pendingAttachmentFile) {
        showStatus(`${enhancementState.pendingAttachmentFile.name} fayl yuklash uchun tanlandi.`);
      }
    });
    attachmentUploadButton.addEventListener("click", uploadAttachmentForSelectedRecord);

    globalSearchInput.addEventListener("input", () => {
      window.clearTimeout(enhancementState.globalSearchDebounceId);
      enhancementState.globalSearchDebounceId = window.setTimeout(() => {
        runGlobalSearch().catch(handleError);
      }, 220);
    });
    document.addEventListener("click", (event) => {
      if (!globalSearchBox.contains(event.target)) {
        hideGlobalSearchResults();
      }
    });

    themeToggleButton.addEventListener("click", toggleTheme);

    passwordChangeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      passwordChangeButton.disabled = true;

      try {
        const response = await request("/api/auth/change-password", {
          body: {
            confirmPassword: confirmPasswordInput.value,
            currentPassword: currentPasswordInput.value,
            newPassword: newPasswordInput.value,
          },
          method: "POST",
        });

        passwordChangeForm.reset();
        showAuth();
        showAuthFeedback(response.message || "Parol yangilandi.");
        showStatus("Parol yangilandi. Qayta login qiling.");
      } catch (error) {
        showStatus(error.message, "error");
      } finally {
        passwordChangeButton.disabled = false;
      }
    });

    openHtmlReportButton.addEventListener("click", () => {
      window.open("/api/reports/summary?format=html", "_blank", "noopener");
    });

    downloadJsonReportButton.addEventListener("click", async () => {
      try {
        const summary = await request("/api/reports/summary");
        downloadBlob(
          JSON.stringify(summary, null, 2),
          `inventory-summary-${new Date().toISOString().slice(0, 10)}.json`,
          "application/json"
        );
      } catch (error) {
        showStatus(error.message, "error");
      }
    });

    refreshSystemButton.addEventListener("click", async () => {
      try {
        await refreshSystemSummary();
        showStatus("Tizim xulosasi yangilandi.");
      } catch (error) {
        showStatus(error.message, "error");
      }
    });

    downloadBackupButton.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/system/backup", { credentials: "same-origin" });

        if (!response.ok) {
          throw new Error("Zaxira nusxasini yuklab bo'lmadi.");
        }

        const blob = await response.blob();
        downloadBlob(blob, `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
        await refreshSystemSummary();
        showStatus("Zaxira nusxasi yuklandi va tizim ko'rsatkichlari yangilandi.");
      } catch (error) {
        showStatus(error.message, "error");
      }
    });

    pickRestoreFileButton.addEventListener("click", () => restoreFileInput.click());
    restoreFileInput.addEventListener("change", () => {
      enhancementState.pendingRestoreFile = restoreFileInput.files?.[0] || null;
      if (enhancementState.pendingRestoreFile) {
        showStatus(`${enhancementState.pendingRestoreFile.name} tiklash uchun tanlandi.`);
      }
    });

    restoreBackupButton.addEventListener("click", restoreBackupFromSelectedFile);
  }

  async function recoverSessionAfterEnhancements() {
    try {
      const session = await request("/api/session");

      if (session?.user?.mustChangePassword) {
        applySession(session);
        showApp();
        activateTab("settings");
        renderSettingsSummary();
      }
    } catch (_error) {
    }
  }

  function resetToFirstInventoryPage() {
    enhancementState.inventoryPagination.page = 1;
  }

  function persistFilters() {
    const payload = {
      assetStatus: filterAssetStatusSelect.value,
      conditionStatus: filterConditionStatusSelect.value,
      departmentId: filterDepartmentSelect.value,
      deviceId: filterDeviceSelect.value,
      pageSize: pageSizeSelect.value,
      search: searchInput.value,
      sortBy: sortBySelect.value,
      sortDir: sortDirectionSelect.value,
    };

    window.localStorage.setItem(STORAGE_KEYS.inventoryFilters, JSON.stringify(payload));
  }

  function applyStoredFilters() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.inventoryFilters);

    if (!raw) {
      return;
    }

    try {
      const saved = JSON.parse(raw);
      enhancementState.pendingSavedFilters = saved;
      searchInput.value = saved.search || "";
      filterDepartmentSelect.value = saved.departmentId || "";
      filterDeviceSelect.value = saved.deviceId || "";
      filterAssetStatusSelect.value = saved.assetStatus || "";
      filterConditionStatusSelect.value = saved.conditionStatus || "";
      sortBySelect.value = saved.sortBy || "updatedAt";
      sortDirectionSelect.value = saved.sortDir || "desc";
      pageSizeSelect.value = saved.pageSize || "25";
      enhancementState.inventoryPagination.pageSize = Number(pageSizeSelect.value) || 25;
    } catch (_error) {
      window.localStorage.removeItem(STORAGE_KEYS.inventoryFilters);
    }
  }

  function clearInventoryFilters() {
    searchInput.value = "";
    filterDepartmentSelect.value = "";
    filterDeviceSelect.value = "";
    filterAssetStatusSelect.value = "";
    filterConditionStatusSelect.value = "";
    sortBySelect.value = "updatedAt";
    sortDirectionSelect.value = "desc";
    pageSizeSelect.value = "25";
    enhancementState.pendingSavedFilters = null;
    window.localStorage.removeItem(STORAGE_KEYS.inventoryFilters);
    showStatus("Filterlar tozalandi.");
  }

  async function handleImportPreviewSelection() {
    const file = previewImportFileInput.files?.[0];

    if (!file) {
      return;
    }

    enhancementState.pendingImportFile = file;
    previewImportButton.disabled = true;
    confirmImportButton.disabled = true;
    importPreviewErrors.classList.add("hidden");
    importPreviewErrors.textContent = "";

    try {
      const formData = new FormData();
      formData.append("file", file);
      const preview = await request("/api/inventory/import-preview", {
        body: formData,
        method: "POST",
      });

      renderImportPreview(preview);
      importPreviewPanel.classList.remove("hidden");
      updateImportConfirmState();
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      previewImportButton.disabled = false;
    }
  }

  function renderImportPreview(preview) {
    importPreviewTableBody.innerHTML = "";
    const conflicts = preview.conflicts || [];
    const errors = preview.errors || [];
    const fileDuplicateConflicts = conflicts.filter((conflict) => conflict.type === "file_duplicate");
    enhancementState.pendingImportHasBlockingConflicts = Boolean(errors.length || fileDuplicateConflicts.length);
    importPreviewSummary.textContent = `${preview.validRows || 0} ta yaroqli qator, jami ${preview.totalRows || 0} ta satr. ${conflicts.length} konflikt.`;

    if (errors.length || conflicts.length) {
      importPreviewErrors.innerHTML = "";
      [...errors, ...conflicts.map((conflict) => conflict.message || `${conflict.rowNumber}-qator: konflikt topildi.`)]
        .slice(0, 8)
        .forEach((message) => {
          const item = document.createElement("div");
          item.textContent = message;
          importPreviewErrors.appendChild(item);
        });
      importPreviewErrors.classList.remove("hidden");
    } else {
      importPreviewErrors.classList.add("hidden");
      importPreviewErrors.textContent = "";
    }

    (preview.previewRows || []).forEach((row) => {
      const tr = document.createElement("tr");
      appendCell(tr, "Egasi", `${row.firstName} ${row.lastName}`);
      appendCell(tr, "Bo'lim", localizeDepartmentName(row.department));
      appendCell(tr, "Texnika", row.deviceName);
      appendCell(tr, "Aktiv", row.assetTag || "-");
      importPreviewTableBody.appendChild(tr);
    });

    if (!preview.previewRows?.length) {
      const tr = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Ko'rib chiqish uchun yaroqli qator topilmadi.";
      tr.appendChild(cell);
      importPreviewTableBody.appendChild(tr);
    }
  }

  function updateImportConfirmState() {
    const hasAnyConflict = !importPreviewErrors.classList.contains("hidden");
    const needsStrategy = hasAnyConflict && !enhancementState.pendingImportHasBlockingConflicts;
    confirmImportButton.disabled = !enhancementState.pendingImportFile ||
      enhancementState.pendingImportHasBlockingConflicts ||
      (needsStrategy && !importConflictStrategySelect.value);
  }

  async function confirmPreviewImport() {
    if (!enhancementState.pendingImportFile) {
      showStatus("Importni ko'rib chiqish uchun fayl tanlanmagan.", "error");
      return;
    }

    confirmImportButton.disabled = true;

    try {
      const formData = new FormData();
      formData.append("file", enhancementState.pendingImportFile);
      if (importConflictStrategySelect.value) {
        formData.append("conflictStrategy", importConflictStrategySelect.value);
      }
      const response = await request("/api/inventory/import", {
        body: formData,
        method: "POST",
      });

      clearImportPreview();
      await refreshDashboardData();
      await loadInventory();
      showStatus(`${response.result.insertedCount || 0} ta qo'shildi, ${response.result.updatedCount || 0} ta yangilandi, ${response.result.skippedCount || 0} ta o'tkazib yuborildi.`);
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      confirmImportButton.disabled = false;
    }
  }

  function clearImportPreview() {
    enhancementState.pendingImportFile = null;
    enhancementState.pendingImportHasBlockingConflicts = false;
    previewImportFileInput.value = "";
    importConflictStrategySelect.value = "";
    importPreviewPanel.classList.add("hidden");
    importPreviewErrors.classList.add("hidden");
    importPreviewErrors.textContent = "";
    importPreviewTableBody.innerHTML = "";
    importPreviewSummary.textContent = "Fayl tanlangach qatorlar shu yerda ko'rinadi.";
  }

  async function loadInventoryDetail(recordId, options = {}) {
    if (!recordId) {
      clearInventoryDetail();
      return;
    }

    const payload = await request(`/api/inventory/${recordId}/detail`);
    enhancementState.detailRecordId = recordId;
    enhancementState.detail = payload;
    renderInventoryDetail();

    if (!options.silent) {
      activateTab("inventory");
    }
  }

  function clearInventoryDetail() {
    enhancementState.detailRecordId = null;
    enhancementState.detail = null;
    inventoryDetailPanel.classList.add("hidden");
    detailTitle.textContent = "Aktiv tanlanmagan";
    detailSubtitle.textContent = "Qatorni tanlab, QR, servis tarixi va fayllarni ko'ring.";
    detailMetaList.innerHTML = "";
    transferTimeline.innerHTML = "";
    serviceLogList.innerHTML = "";
    attachmentList.innerHTML = "";
    detailQrImage.removeAttribute("src");
    detailQrLink.removeAttribute("href");
    transferForm.classList.add("hidden");
    applyPermissionUI();
  }

  function renderInventoryDetail() {
    const detail = enhancementState.detail;

    if (!detail?.record) {
      clearInventoryDetail();
      return;
    }

    const record = detail.record;
    inventoryDetailPanel.classList.remove("hidden");
    detailTitle.textContent = `${record.assetTag || "Inventar raqamsiz"} · ${record.deviceName}`;
    detailSubtitle.textContent = `${record.currentHolder || "Egasi ko'rsatilmagan"} · ${localizeDepartmentName(record.department)} · ${getAssetStatusLabel(record.assetStatus)}`;

    renderDetailMeta(record);
    renderTransferTimeline(detail.transfers || []);
    renderServiceLogs(detail.serviceLogs || []);
    renderAttachments(detail.attachments || [], record.id);
    detailQrImage.src = detail.qrUrl;
    detailQrLink.href = detail.qrUrl;
    detailQrImage.classList.toggle("hidden", false);
    transferForm.classList.add("hidden");
    applyPermissionUI();
  }

  function openTransferPanel(statusOverride = "") {
    const record = enhancementState.detail?.record;

    if (!record) {
      showStatus("Avval aktiv tanlang.", "error");
      return;
    }

    transferHolderInput.value = record.currentHolder || "";
    transferDepartmentSelect.value = String(record.departmentId || "");
    transferStatusSelect.value = statusOverride || record.assetStatus || state.assetStatuses[0]?.value || "";
    transferDateInput.value = new Date().toISOString().slice(0, 10);
    transferNotesInput.value = statusOverride === "repair"
      ? "Servisga yuborildi."
      : statusOverride === "retired"
        ? "Hisobdan chiqarildi."
        : "";
    transferForm.classList.remove("hidden");
    transferHolderInput.focus();
  }

  async function submitTransfer() {
    if (!enhancementState.detailRecordId) {
      showStatus("Transfer uchun aktiv tanlanmagan.", "error");
      return;
    }

    transferSubmitButton.disabled = true;

    try {
      await request(`/api/inventory/${enhancementState.detailRecordId}/transfer`, {
        body: {
          assetStatus: transferStatusSelect.value,
          departmentId: transferDepartmentSelect.value,
          notes: transferNotesInput.value.trim(),
          toHolder: transferHolderInput.value.trim(),
          transferDate: transferDateInput.value,
        },
        method: "POST",
      });

      await refreshDashboardData();
      await loadInventory({ silent: true });
      await loadInventoryDetail(enhancementState.detailRecordId, { silent: true });
      showStatus("Aktiv transferi audit bilan saqlandi.");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      transferSubmitButton.disabled = !state.permissions.manageInventory;
    }
  }

  function renderDetailMeta(record) {
    detailMetaList.innerHTML = "";
    const items = [
      ["Aktiv tegi", record.assetTag || "-"],
      ["Serial raqam", record.serialNumber || "-"],
      ["Holati", getAssetStatusLabel(record.assetStatus)],
      ["Holat", getConditionStatusLabel(record.conditionStatus)],
      ["Xarid", formatDateOrDash(record.purchaseDate)],
      ["Narx", record.purchasePrice ? `${formatCurrency(record.purchasePrice)} so'm` : "-"],
      ["Kafolat", formatDateOrDash(record.warrantyUntil)],
      ["Yetkazib beruvchi", record.supplier || "-"],
      ["Filial", record.branch || "-"],
      ["Xona/Stol", [record.room, record.desk].filter(Boolean).join(" / ") || "-"],
      ["Joylashuv", record.officeLocation || "-"],
      ["Mayda texnika", record.accessories || "-"],
      ["Izoh", record.notes || "-"],
    ];

    items.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "detail-list__row";
      const key = document.createElement("span");
      key.className = "detail-list__label";
      key.textContent = label;
      const content = document.createElement("strong");
      content.className = "detail-list__value";
      content.textContent = value;
      row.append(key, content);
      detailMetaList.appendChild(row);
    });
  }

  function renderTransferTimeline(transfers) {
    transferTimeline.innerHTML = "";

    if (!transfers.length) {
      transferTimeline.appendChild(createEmptyDetailRow("Transfer tarixi hozircha yo'q."));
      return;
    }

    transfers.forEach((transfer) => {
      const item = document.createElement("div");
      item.className = "timeline__item";
      const header = document.createElement("div");
      header.className = "timeline__header";
      header.innerHTML = `<strong>${formatDateOrDash(transfer.transferDate)}</strong><span>${getAssetStatusLabel(transfer.toStatus)}</span>`;
      const body = document.createElement("div");
      body.className = "timeline__body";
      body.textContent = `${transfer.fromHolder || "-"} -> ${transfer.toHolder || "-"} | ${localizeDepartmentName(transfer.fromDepartment) || "-"} -> ${localizeDepartmentName(transfer.toDepartment) || "-"}${transfer.notes ? ` | ${transfer.notes}` : ""}`;
      item.append(header, body);
      transferTimeline.appendChild(item);
    });
  }

  function renderServiceLogs(serviceLogs) {
    serviceLogList.innerHTML = "";

    if (!serviceLogs.length) {
      serviceLogList.appendChild(createEmptyDetailRow("Servis yozuvi hozircha yo'q."));
      return;
    }

    serviceLogs.forEach((log) => {
      const row = document.createElement("div");
      row.className = "detail-list__row detail-list__row--stack";
      row.innerHTML = `
        <strong class="detail-list__value">${formatDateOrDash(log.serviceDate)} | ${log.serviceType}</strong>
        <span class="detail-list__subvalue">${log.vendor || "Servis markazi ko'rsatilmagan"}${log.cost ? ` | ${formatCurrency(log.cost)} so'm` : ""}</span>
        <span class="detail-list__subvalue">${log.notes || "Izoh yo'q"}</span>
      `;
      serviceLogList.appendChild(row);
    });
  }

  function renderAttachments(attachments, recordId) {
    attachmentList.innerHTML = "";

    if (!attachments.length) {
      attachmentList.appendChild(createEmptyDetailRow("Fayllar hozircha yo'q."));
      return;
    }

    attachments.forEach((attachment) => {
      const row = document.createElement("div");
      row.className = "detail-list__row detail-list__row--actions";
      const meta = document.createElement("div");
      meta.className = "detail-list__stack";
      meta.innerHTML = `
        <strong class="detail-list__value">${attachment.fileName}</strong>
        <span class="detail-list__subvalue">${formatBytes(attachment.fileSize)} | ${formatDate(attachment.createdAt)}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "row-actions";
      const downloadLink = document.createElement("a");
      downloadLink.className = "row-action";
      downloadLink.href = `/api/inventory/${recordId}/attachments/${attachment.id}/download`;
      downloadLink.textContent = "Yuklash";
      actions.appendChild(downloadLink);

      if (state.permissions.manageAttachments) {
        actions.appendChild(createRowButton("O'chirish", async () => {
          await request(`/api/inventory/${recordId}/attachments/${attachment.id}`, { method: "DELETE" });
          await loadInventoryDetail(recordId, { silent: true });
          showStatus("Fayl o'chirildi.");
        }));
      }

      row.append(meta, actions);
      attachmentList.appendChild(row);
    });
  }

  async function uploadAttachmentForSelectedRecord() {
    if (!enhancementState.detailRecordId) {
      showStatus("Avval aktiv tanlang.", "error");
      return;
    }

    if (!enhancementState.pendingAttachmentFile) {
      showStatus("Yuklash uchun fayl tanlanmagan.", "error");
      return;
    }

    attachmentUploadButton.disabled = true;

    try {
      const formData = new FormData();
      formData.append("file", enhancementState.pendingAttachmentFile);
      await request(`/api/inventory/${enhancementState.detailRecordId}/attachments`, {
        body: formData,
        method: "POST",
      });
      enhancementState.pendingAttachmentFile = null;
      attachmentFileInput.value = "";
      await loadInventoryDetail(enhancementState.detailRecordId, { silent: true });
      showStatus("Fayl yuklandi.");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      attachmentUploadButton.disabled = !state.permissions.manageAttachments;
    }
  }

  async function runGlobalSearch() {
    const query = globalSearchInput.value.trim();

    if (!query || state.user?.mustChangePassword) {
      hideGlobalSearchResults();
      return;
    }

    const payload = await request(`/api/global-search?query=${encodeURIComponent(query)}`);
    renderGlobalSearchResults(payload.results || {});
  }

  function renderGlobalSearchResults(results) {
    globalSearchResults.innerHTML = "";
    const sections = [
      ["Inventar", results.inventory || [], (item) => {
        hideGlobalSearchResults();
        globalSearchInput.value = "";
        activateTab("inventory");
        loadInventoryDetail(item.id).catch(handleError);
      }, (item) => `${item.assetTag || "Tag yo'q"} | ${item.deviceName} | ${localizeDepartmentName(item.department)}`],
      ["Bo'limlar", results.departments || [], (item) => {
        hideGlobalSearchResults();
        activateTab("catalogs");
        departmentCatalogSearchInput.value = item.name || "";
        scheduleCatalogRender();
      }, (item) => `${localizeDepartmentName(item.name)}${item.code ? ` (${item.code})` : ""}`],
      ["Texnikalar", results.devices || [], (item) => {
        hideGlobalSearchResults();
        activateTab("catalogs");
        deviceCatalogSearchInput.value = item.name || "";
        scheduleCatalogRender();
      }, (item) => `${item.name}${item.model ? ` | ${item.model}` : ""}`],
      ["Foydalanuvchilar", results.users || [], (item) => {
        hideGlobalSearchResults();
        activateTab("users");
        fillUserForm(item);
      }, (item) => `${item.fullName} | ${getRoleLabel(item.role)}`],
      ["Audit log", results.audit || [], (item) => {
        hideGlobalSearchResults();
        activateTab("audit");
        auditSearchInput.value = item.action || "";
        loadAuditLogs().catch(handleError);
      }, (item) => `${formatAuditActionLabel(item.action)} | ${localizeUiText(item.summary) || "-"}`],
    ];

    sections.forEach(([title, items, onClick, formatter]) => {
      if (!items.length) {
        return;
      }

      const group = document.createElement("section");
      group.className = "search-results__group";
      const heading = document.createElement("strong");
      heading.className = "search-results__title";
      heading.textContent = title;
      group.appendChild(heading);

      items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "search-result";
        button.textContent = formatter(item);
        button.addEventListener("click", () => onClick(item));
        group.appendChild(button);
      });

      globalSearchResults.appendChild(group);
    });

    if (!globalSearchResults.childElementCount) {
      globalSearchResults.appendChild(createEmptyDetailRow("Hech narsa topilmadi."));
    }

    globalSearchResults.classList.remove("hidden");
  }

  function hideGlobalSearchResults() {
    globalSearchResults.classList.add("hidden");
    globalSearchResults.innerHTML = "";
  }

  async function refreshSystemSummary() {
    if (state.permissions.manageSettings) {
      const payload = await request("/api/system/metrics");
      enhancementState.systemMetrics = payload.metrics || null;
      state.backupRuns = payload.backups || [];
    }

    if (state.permissions.viewReports) {
      enhancementState.reportSummary = await request("/api/reports/summary");
    }

    renderSettingsSummary();
  }

  function renderSettingsSummary() {
    renderMetricsGrid();
    renderBackupRuns();
  }

  function renderMetricsGrid() {
    systemMetricsGrid.innerHTML = "";

    const reportOverview = enhancementState.reportSummary?.overview?.stats || state.dashboardOverview?.stats || {};
    const metrics = enhancementState.systemMetrics || enhancementState.reportSummary?.metrics || null;
    const autoBackup = metrics?.autoBackup || null;
    const cards = [
      ["Manzil", window.location.origin],
      ["Yozuvlar", String(reportOverview.totalRecords || state.inventoryRecords.length || 0)],
      ["Aktiv sessiyalar", metrics?.activeSessions != null ? String(metrics.activeSessions) : "-"],
      ["Servis loglar", metrics?.serviceLogs != null ? String(metrics.serviceLogs) : "-"],
      ["Transferlar", metrics?.transfers != null ? String(metrics.transfers) : "-"],
      ["Fayllar hajmi", metrics ? formatBytes(metrics.uploadsSizeBytes || 0) : "-"],
      ["DB hajmi", metrics ? formatBytes(metrics.databaseSizeBytes || 0) : "-"],
      ["Backup papkasi", metrics ? formatBytes(metrics.backupStorageBytes || 0) : "-"],
      ["Zaxira nusxalari soni", metrics?.backupCount != null ? String(metrics.backupCount) : String((state.backupRuns || []).length)],
      ["Auto backup", autoBackup?.enabled ? autoBackup.scheduleLabel : "O'chirilgan"],
      ["Oxirgi auto backup", autoBackup?.lastRunAt ? formatDate(autoBackup.lastRunAt) : "-"],
      ["Backup saqlash", autoBackup?.keepDays ? `${autoBackup.keepDays} kun` : "-"],
      ["Auto backup holati", autoBackup?.lastStatus || "-"],
    ];

    cards.forEach(([label, value]) => {
      const card = document.createElement("article");
      card.className = "metric-card";
      const key = document.createElement("span");
      key.className = "metric-card__label";
      key.textContent = label;
      const content = document.createElement("strong");
      content.className = "metric-card__value";
      content.textContent = value;
      card.append(key, content);
      systemMetricsGrid.appendChild(card);
    });
  }

  function renderBackupRuns() {
    backupRunsList.innerHTML = "";
    const items = state.backupRuns || [];

    if (!items.length) {
      backupRunsList.appendChild(createEmptyDetailRow("Zaxira nusxalari tarixi hozircha yo'q."));
      return;
    }

    items.forEach((backup) => {
      const row = document.createElement("div");
      row.className = "detail-list__row detail-list__row--stack";
      row.innerHTML = `
        <strong class="detail-list__value">${backup.fileName}</strong>
        <span class="detail-list__subvalue">${localizeUiText(backup.summary) || "-"}</span>
        <span class="detail-list__subvalue">${formatDate(backup.createdAt)}</span>
      `;
      backupRunsList.appendChild(row);
    });
  }

  async function restoreBackupFromSelectedFile() {
    if (!enhancementState.pendingRestoreFile) {
      showStatus("Tiklash uchun zaxira fayli tanlanmagan.", "error");
      return;
    }

    if (!window.confirm("Tiklash jarayoni joriy ma'lumotlarni almashtiradi. Davom etamizmi?")) {
      return;
    }

    restoreBackupButton.disabled = true;

    try {
      const formData = new FormData();
      formData.append("file", enhancementState.pendingRestoreFile);
      const response = await request("/api/system/restore", {
        body: formData,
        method: "POST",
      });
      enhancementState.pendingRestoreFile = null;
      restoreFileInput.value = "";
      showAuth();
      showAuthFeedback(response.message || "Tiklash bajarildi.");
      showStatus("Zaxira nusxasi tiklandi. Qayta login qiling.");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      restoreBackupButton.disabled = false;
    }
  }

  function syncPasswordChangeState(forceNotice = false) {
    const mustChangePassword = Boolean(state.user?.mustChangePassword);
    passwordChangeNotice.classList.toggle("hidden", !(mustChangePassword || forceNotice));
    passwordChangeRequiredBanner.classList.toggle("hidden", !(mustChangePassword || forceNotice));
  }

  function applyStoredTheme() {
    const theme = window.localStorage.getItem(STORAGE_KEYS.theme) || "light";
    document.body.dataset.theme = theme;
    renderThemeToggleState(theme);
  }

  function toggleTheme() {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = nextTheme;
    window.localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    renderThemeToggleState(nextTheme);
  }

  function renderThemeToggleState(theme) {
    const isDark = theme === "dark";
    const currentLabel = isDark ? "Tungi rejim" : "Kunduzgi rejim";
    const currentState = isDark ? "Oy faol" : "Quyosh faol";
    const nextLabel = isDark ? "kunduzgi rejimga o'tish" : "tungi rejimga o'tish";

    themeToggleButton.innerHTML = `
      <span class="theme-toggle__icon" aria-hidden="true">${getThemeIconSvg(theme)}</span>
      <span class="theme-toggle__copy">
        <span class="theme-toggle__label">${currentLabel}</span>
        <span class="theme-toggle__state">${currentState}</span>
      </span>
    `;
    themeToggleButton.dataset.themeMode = theme;
    themeToggleButton.setAttribute("aria-label", `${currentLabel}. Bosilsa ${nextLabel}.`);
    themeToggleButton.title = `${currentLabel}. Bosilsa ${nextLabel}.`;
  }

  function getThemeIconSvg(theme) {
    if (theme === "dark") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3c-.06.33-.1.67-.1 1.02A8 8 0 0 0 19 12c.35 0 .69-.03 1.02-.1Z"></path>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2"></circle>
        <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"></path>
      </svg>
    `;
  }

  function createEmptyDetailRow(text) {
    const row = document.createElement("div");
    row.className = "detail-list__row detail-list__row--empty";
    row.textContent = text;
    return row;
  }

  function formatDateOrDash(value) {
    if (!value) {
      return "-";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      return formatShortDate(value);
    }

    return formatDate(value);
  }

  function formatBytes(value) {
    const size = Number(value || 0);

    if (!size) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    let current = size;
    let index = 0;

    while (current >= 1024 && index < units.length - 1) {
      current /= 1024;
      index += 1;
    }

    return `${current.toFixed(current >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("uz-UZ", {
      maximumFractionDigits: 2,
      minimumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  }

  function downloadBlob(content, fileName, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
})();
