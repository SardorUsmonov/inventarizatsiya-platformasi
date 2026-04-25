const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { hashPassword } = require("./auth");
const { defaultDepartments, defaultDevices } = require("./catalog-presets");
const {
  DEFAULT_ASSET_STATUS,
  DEFAULT_CONDITION_STATUS,
} = require("./inventory-options");

const AUDIT_AUTO_REFRESH_SECONDS = 30;
const AUDIT_RETENTION_OPTIONS = [30, 90, 180];
const DEFAULT_AUDIT_RETENTION_DAYS = 90;
const DEFAULT_AUTO_BACKUP_HOUR = 3;
const DEFAULT_AUTO_BACKUP_KEEP_DAYS = 14;

function createDatabase(config) {
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  fs.mkdirSync(config.attachmentsDir, { recursive: true });
  fs.mkdirSync(config.backupsDir, { recursive: true });

  const database = new DatabaseSync(config.databasePath);
  initializeDatabase(database);
  seedSystemSettings(database, config);
  seedDefaultAdmin(database, config);
  seedRecommendedCatalogs(database);
  seedCatalogsFromInventory(database);
  syncInventoryCatalogLinks(database);
  pruneAuditLogsByRetention(database);

  return {
    close() {
      database.close();
    },
    countOtherActiveAdmins(userId) {
      return database
        .prepare(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE role = 'admin'
            AND is_active = 1
            AND id <> ?
        `)
        .get(userId).total;
    },
    createDepartment(payload) {
      const now = getNow();
      const result = database
        .prepare(`
          INSERT INTO departments (
            name,
            code,
            description,
            is_active,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(payload.name, payload.code, payload.description, payload.isActive ? 1 : 0, now, now);

      return this.getDepartmentById(result.lastInsertRowid);
    },
    createDevice(payload) {
      const now = getNow();
      const result = database
        .prepare(`
          INSERT INTO devices (
            name,
            category,
            model,
            description,
            is_active,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          payload.name,
          payload.category,
          payload.model,
          payload.description,
          payload.isActive ? 1 : 0,
          now,
          now
        );

      return this.getDeviceById(result.lastInsertRowid);
    },
    createInventory(payload, userId) {
      const now = getNow();
      const department = this.getDepartmentById(payload.departmentId);
      const device = this.getDeviceById(payload.deviceId);
      const result = database
        .prepare(`
          INSERT INTO inventory_records (
            first_name,
            last_name,
            department,
            department_id,
            device_name,
            device_id,
            asset_tag,
            serial_number,
            asset_status,
            condition_status,
            purchase_date,
            purchase_price,
            assigned_at,
            warranty_until,
            supplier,
            branch,
            room,
            desk,
            office_location,
            accessories,
            notes,
            previous_holder,
            current_holder,
            created_by,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          payload.firstName,
          payload.lastName,
          department.name,
          department.id,
          device.name,
          device.id,
          payload.assetTag,
          payload.serialNumber,
          payload.assetStatus,
          payload.conditionStatus,
          payload.purchaseDate,
          payload.purchasePrice,
          payload.assignedAt,
          payload.warrantyUntil,
          payload.supplier,
          payload.branch,
          payload.room,
          payload.desk,
          payload.officeLocation,
          payload.accessories,
          payload.notes,
          payload.previousHolder,
          payload.currentHolder,
          userId,
          userId,
          now,
          now
        );

      return this.getInventoryById(result.lastInsertRowid);
    },
    createSession(userId, tokenHash, expiresAt) {
      const now = getNow();
      database
        .prepare(`
          INSERT INTO sessions (
            token_hash,
            user_id,
            expires_at,
            created_at,
            last_seen_at
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .run(tokenHash, userId, expiresAt, now, now);
    },
    createUser(payload) {
      const now = getNow();
      const result = database
        .prepare(`
          INSERT INTO users (
            username,
            full_name,
            password_hash,
            role,
            is_active,
            must_change_password,
            password_changed_at,
            failed_login_attempts,
            locked_until,
            last_login_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          payload.username,
          payload.fullName,
          payload.passwordHash,
          payload.role,
          payload.isActive ? 1 : 0,
          payload.mustChangePassword ? 1 : 0,
          payload.passwordChangedAt || now,
          0,
          "",
          "",
          now,
          now
        );

      return this.getUserById(result.lastInsertRowid);
    },
    deleteInventory(recordId) {
      const existingRecord = this.getInventoryById(recordId);

      if (!existingRecord) {
        return null;
      }

      database.prepare("DELETE FROM inventory_records WHERE id = ?").run(recordId);
      return existingRecord;
    },
    deleteDepartment(departmentId) {
      const existingDepartment = this.getDepartmentById(departmentId);

      if (!existingDepartment) {
        return null;
      }

      database.prepare("DELETE FROM departments WHERE id = ?").run(departmentId);
      return existingDepartment;
    },
    deleteSessionByTokenHash(tokenHash) {
      database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    },
    deleteSessionsByUserId(userId) {
      database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    },
    deleteDevice(deviceId) {
      const existingDevice = this.getDeviceById(deviceId);

      if (!existingDevice) {
        return null;
      }

      database.prepare("DELETE FROM devices WHERE id = ?").run(deviceId);
      return existingDevice;
    },
    getDepartmentById(departmentId) {
      return mapDepartment(
        database
          .prepare(`
            SELECT
              id,
              name,
              code,
              description,
              is_active AS isActive,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM departments
            WHERE id = ?
            LIMIT 1
          `)
          .get(departmentId)
      );
    },
    getDepartmentByName(name) {
      return mapDepartment(
        database
          .prepare(`
            SELECT
              id,
              name,
              code,
              description,
              is_active AS isActive,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM departments
            WHERE name = ?
            LIMIT 1
          `)
          .get(name)
      );
    },
    getDeviceById(deviceId) {
      return mapDevice(
        database
          .prepare(`
            SELECT
              id,
              name,
              category,
              model,
              description,
              is_active AS isActive,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM devices
            WHERE id = ?
            LIMIT 1
          `)
          .get(deviceId)
      );
    },
    getDeviceByName(name) {
      return mapDevice(
        database
          .prepare(`
            SELECT
              id,
              name,
              category,
              model,
              description,
              is_active AS isActive,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM devices
            WHERE name = ?
            LIMIT 1
          `)
          .get(name)
      );
    },
    getInventoryById(recordId) {
      return mapInventoryRecord(
        database
          .prepare(`
            SELECT
              id,
              first_name AS firstName,
              last_name AS lastName,
              department,
              department_id AS departmentId,
              device_name AS deviceName,
              device_id AS deviceId,
              asset_tag AS assetTag,
              serial_number AS serialNumber,
              asset_status AS assetStatus,
              condition_status AS conditionStatus,
              purchase_date AS purchaseDate,
              purchase_price AS purchasePrice,
              assigned_at AS assignedAt,
              warranty_until AS warrantyUntil,
              supplier,
              branch,
              room,
              desk,
              office_location AS officeLocation,
              accessories,
              notes,
              previous_holder AS previousHolder,
              current_holder AS currentHolder,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM inventory_records
            WHERE id = ?
            LIMIT 1
          `)
          .get(recordId)
      );
    },
    getInventoryByAssetTag(assetTag) {
      const normalizedAssetTag = normalizeText(assetTag);

      if (!normalizedAssetTag) {
        return null;
      }

      return mapInventoryRecord(
        database
          .prepare(`
            SELECT
              id,
              first_name AS firstName,
              last_name AS lastName,
              department,
              department_id AS departmentId,
              device_name AS deviceName,
              device_id AS deviceId,
              asset_tag AS assetTag,
              serial_number AS serialNumber,
              asset_status AS assetStatus,
              condition_status AS conditionStatus,
              purchase_date AS purchaseDate,
              purchase_price AS purchasePrice,
              assigned_at AS assignedAt,
              warranty_until AS warrantyUntil,
              supplier,
              branch,
              room,
              desk,
              office_location AS officeLocation,
              accessories,
              notes,
              previous_holder AS previousHolder,
              current_holder AS currentHolder,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM inventory_records
            WHERE lower(asset_tag) = lower(?)
            LIMIT 1
          `)
          .get(normalizedAssetTag)
      );
    },
    getInventoryBySerialNumber(serialNumber) {
      const normalizedSerialNumber = normalizeText(serialNumber);

      if (!normalizedSerialNumber) {
        return null;
      }

      return mapInventoryRecord(
        database
          .prepare(`
            SELECT
              id,
              first_name AS firstName,
              last_name AS lastName,
              department,
              department_id AS departmentId,
              device_name AS deviceName,
              device_id AS deviceId,
              asset_tag AS assetTag,
              serial_number AS serialNumber,
              asset_status AS assetStatus,
              condition_status AS conditionStatus,
              purchase_date AS purchaseDate,
              purchase_price AS purchasePrice,
              assigned_at AS assignedAt,
              warranty_until AS warrantyUntil,
              supplier,
              branch,
              room,
              desk,
              office_location AS officeLocation,
              accessories,
              notes,
              previous_holder AS previousHolder,
              current_holder AS currentHolder,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM inventory_records
            WHERE lower(serial_number) = lower(?)
            LIMIT 1
          `)
          .get(normalizedSerialNumber)
      );
    },
    getInventoryStats(filters) {
      return database
        .prepare(`
          SELECT
            COUNT(*) AS totalRecords,
            COUNT(DISTINCT CASE WHEN trim(department) <> '' THEN lower(trim(department)) END) AS totalDepartments,
            COALESCE(SUM(CASE WHEN asset_status = 'in_use' THEN 1 ELSE 0 END), 0) AS activeDevices,
            COALESCE(SUM(CASE WHEN asset_status = 'in_use' THEN 1 ELSE 0 END), 0) AS inUseCount,
            COALESCE(SUM(CASE WHEN asset_status = 'in_stock' THEN 1 ELSE 0 END), 0) AS inStockCount,
            COALESCE(SUM(CASE WHEN asset_status = 'repair' THEN 1 ELSE 0 END), 0) AS repairCount,
            COALESCE(SUM(CASE WHEN asset_status = 'retired' THEN 1 ELSE 0 END), 0) AS retiredCount,
            COALESCE(SUM(CASE WHEN accessories <> '' THEN 1 ELSE 0 END), 0) AS accessoryCount,
            COALESCE(SUM(CASE WHEN purchase_date >= :yearStart THEN 1 ELSE 0 END), 0) AS purchasedThisYearCount,
            COALESCE(SUM(CASE WHEN warranty_until <> '' AND warranty_until >= :today AND warranty_until <= :warrantyLimit THEN 1 ELSE 0 END), 0) AS warrantyExpiringCount,
            COALESCE(SUM(CASE WHEN asset_status = 'repair' OR condition_status = 'damaged' THEN 1 ELSE 0 END), 0) AS attentionCount
          FROM inventory_records
          ${buildInventoryWhereClause()}
        `)
        .get(buildInventoryStatsParams(filters));
    },
    getDashboardOverview() {
      return {
        attentionItems: this.listAttentionInventory(),
        byCondition: this.listInventoryConditionBreakdown(),
        byDepartment: this.listInventoryDepartmentBreakdown(),
        byStatus: this.listInventoryStatusBreakdown(),
        latestChanges: this.listLatestInventoryChanges(),
        recentPurchases: this.listRecentInventoryPurchases(),
        stats: this.getInventoryStats(),
        upcomingWarranty: this.listUpcomingWarranty(),
      };
    },
    getInventoryUsageByDepartmentId(departmentId) {
      return database
        .prepare(`
          SELECT COUNT(*) AS total
          FROM inventory_records
          WHERE department_id = ?
        `)
        .get(departmentId).total;
    },
    getInventoryUsageByDeviceId(deviceId) {
      return database
        .prepare(`
          SELECT COUNT(*) AS total
          FROM inventory_records
          WHERE device_id = ?
        `)
        .get(deviceId).total;
    },
    listAttentionInventory(limit = 6) {
      return database
        .prepare(`
          SELECT
            id,
            first_name AS firstName,
            last_name AS lastName,
            department,
            department_id AS departmentId,
            device_name AS deviceName,
            device_id AS deviceId,
            asset_tag AS assetTag,
            serial_number AS serialNumber,
            asset_status AS assetStatus,
            condition_status AS conditionStatus,
            purchase_date AS purchaseDate,
            purchase_price AS purchasePrice,
            assigned_at AS assignedAt,
            warranty_until AS warrantyUntil,
            supplier,
            branch,
            room,
            desk,
            office_location AS officeLocation,
            accessories,
            notes,
            previous_holder AS previousHolder,
            current_holder AS currentHolder,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM inventory_records
          WHERE asset_status = 'repair'
             OR condition_status = 'damaged'
          ORDER BY updated_at DESC, id DESC
          LIMIT ?
        `)
        .all(limit)
        .map(mapInventoryRecord);
    },
    listInventoryConditionBreakdown(limit = 6) {
      return database
        .prepare(`
          SELECT
            condition_status AS value,
            COUNT(*) AS total
          FROM inventory_records
          GROUP BY condition_status
          ORDER BY total DESC, condition_status ASC
          LIMIT ?
        `)
        .all(limit);
    },
    listInventoryDepartmentBreakdown(limit = 8) {
      return database
        .prepare(`
          SELECT
            department AS label,
            COUNT(*) AS total
          FROM inventory_records
          GROUP BY department
          ORDER BY total DESC, department COLLATE NOCASE ASC
          LIMIT ?
        `)
        .all(limit);
    },
    listInventoryStatusBreakdown(limit = 6) {
      return database
        .prepare(`
          SELECT
            asset_status AS value,
            COUNT(*) AS total
          FROM inventory_records
          GROUP BY asset_status
          ORDER BY total DESC, asset_status ASC
          LIMIT ?
        `)
        .all(limit);
    },
    getSessionByTokenHash(tokenHash) {
      return database
        .prepare(`
          SELECT
            id,
            user_id AS userId,
            expires_at AS expiresAt,
            last_seen_at AS lastSeenAt
          FROM sessions
          WHERE token_hash = ?
          LIMIT 1
        `)
        .get(tokenHash);
    },
    getUserById(userId) {
      return mapUser(
        database
          .prepare(`
            SELECT
              id,
              username,
              full_name AS fullName,
              password_hash AS passwordHash,
              role,
              is_active AS isActive,
              must_change_password AS mustChangePassword,
              password_changed_at AS passwordChangedAt,
              failed_login_attempts AS failedLoginAttempts,
              locked_until AS lockedUntil,
              last_login_at AS lastLoginAt,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM users
            WHERE id = ?
            LIMIT 1
          `)
          .get(userId)
      );
    },
    getUserByUsername(username) {
      return mapUser(
        database
          .prepare(`
            SELECT
              id,
              username,
              full_name AS fullName,
              password_hash AS passwordHash,
              role,
              is_active AS isActive,
              must_change_password AS mustChangePassword,
              password_changed_at AS passwordChangedAt,
              failed_login_attempts AS failedLoginAttempts,
              locked_until AS lockedUntil,
              last_login_at AS lastLoginAt,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM users
            WHERE username = ?
            LIMIT 1
          `)
          .get(username)
      );
    },
    importInventoryRows(rows, userId, options = {}) {
      const conflictStrategy = ["skip", "update"].includes(options.conflictStrategy)
        ? options.conflictStrategy
        : "reject";
      const createdDepartments = [];
      const createdDevices = [];
      let insertedCount = 0;
      let skippedCount = 0;
      let updatedCount = 0;

      database.exec("BEGIN IMMEDIATE");

      try {
        rows.forEach((row) => {
          const existingRecord = findExistingInventoryForImport(database, row);

          if (existingRecord && conflictStrategy === "skip") {
            skippedCount += 1;
            return;
          }

          if (existingRecord && conflictStrategy === "reject") {
            throw new Error(`Konflikt: ${row.assetTag || row.serialNumber} aktiv yozuvi allaqachon mavjud.`);
          }

          const departmentRef = ensureDepartmentByName(database, row.department);
          const deviceRef = ensureDeviceByName(database, row.deviceName);

          if (departmentRef.created) {
            createdDepartments.push(departmentRef.record.name);
          }

          if (deviceRef.created) {
            createdDevices.push(deviceRef.record.name);
          }

          const now = getNow();

          if (existingRecord && conflictStrategy === "update") {
            database
              .prepare(`
                UPDATE inventory_records
                SET
                  first_name = ?,
                  last_name = ?,
                  department = ?,
                  department_id = ?,
                  device_name = ?,
                  device_id = ?,
                  asset_tag = ?,
                  serial_number = ?,
                  asset_status = ?,
                  condition_status = ?,
                  purchase_date = ?,
                  purchase_price = ?,
                  assigned_at = ?,
                  warranty_until = ?,
                  supplier = ?,
                  branch = ?,
                  room = ?,
                  desk = ?,
                  office_location = ?,
                  accessories = ?,
                  notes = ?,
                  previous_holder = ?,
                  current_holder = ?,
                  updated_by = ?,
                  updated_at = ?
                WHERE id = ?
              `)
              .run(
                row.firstName,
                row.lastName,
                departmentRef.record.name,
                departmentRef.record.id,
                deviceRef.record.name,
                deviceRef.record.id,
                row.assetTag,
                row.serialNumber,
                row.assetStatus || DEFAULT_ASSET_STATUS,
                row.conditionStatus || DEFAULT_CONDITION_STATUS,
                row.purchaseDate,
                row.purchasePrice,
                row.assignedAt,
                row.warrantyUntil,
                row.supplier,
                row.branch,
                row.room,
                row.desk,
                row.officeLocation,
                row.accessories,
                row.notes,
                existingRecord.current_holder || "-",
                row.currentHolder,
                userId,
                now,
                existingRecord.id
              );

            database
              .prepare(`
                INSERT INTO inventory_transfers (
                  inventory_record_id,
                  from_holder,
                  to_holder,
                  from_department,
                  to_department,
                  from_status,
                  to_status,
                  transfer_date,
                  notes,
                  created_by,
                  created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .run(
                existingRecord.id,
                existingRecord.current_holder || "",
                row.currentHolder || "",
                existingRecord.department || "",
                departmentRef.record.name,
                existingRecord.asset_status || "",
                row.assetStatus || DEFAULT_ASSET_STATUS,
                row.assignedAt || now.slice(0, 10),
                "Excel import orqali mavjud yozuv yangilandi.",
                userId,
                now
              );

            updatedCount += 1;
            return;
          }

          database
            .prepare(`
              INSERT INTO inventory_records (
                first_name,
                last_name,
                department,
                department_id,
                device_name,
                device_id,
                asset_tag,
                serial_number,
                asset_status,
                condition_status,
                purchase_date,
                purchase_price,
                assigned_at,
                warranty_until,
                supplier,
                branch,
                room,
                desk,
                office_location,
                accessories,
                notes,
                previous_holder,
                current_holder,
                created_by,
                updated_by,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              row.firstName,
              row.lastName,
              departmentRef.record.name,
              departmentRef.record.id,
              deviceRef.record.name,
              deviceRef.record.id,
              row.assetTag,
              row.serialNumber,
              row.assetStatus || DEFAULT_ASSET_STATUS,
              row.conditionStatus || DEFAULT_CONDITION_STATUS,
              row.purchaseDate,
              row.purchasePrice,
              row.assignedAt,
              row.warrantyUntil,
              row.supplier,
              row.branch,
              row.room,
              row.desk,
              row.officeLocation,
              row.accessories,
              row.notes,
              row.previousHolder || "-",
              row.currentHolder,
              userId,
              userId,
              now,
              now
            );

          insertedCount += 1;
        });

        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }

      return {
        createdDepartments: unique(createdDepartments),
        createdDevices: unique(createdDevices),
        insertedCount,
        skippedCount,
        updatedCount,
      };
    },
    listAuditLogs(filters = {}) {
      pruneAuditLogsByRetention(database);
      const params = buildAuditParams(filters);
      return database
        .prepare(`
          SELECT
            id,
            actor_user_id AS actorUserId,
            actor_username AS actorUsername,
            actor_name AS actorName,
            actor_role AS actorRole,
            action,
            entity_type AS entityType,
            entity_id AS entityId,
            summary,
            details_json AS detailsJson,
            ip_address AS ipAddress,
            created_at AS createdAt
          FROM audit_logs
          ${buildAuditWhereClause()}
          ORDER BY created_at DESC, id DESC
          LIMIT :limit
        `)
        .all(params)
        .map(mapAuditLog);
    },
    listDepartments() {
      return database
        .prepare(`
          SELECT
            id,
            name,
            code,
            description,
            is_active AS isActive,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM departments
          ORDER BY is_active DESC, name COLLATE NOCASE ASC
        `)
        .all()
        .map(mapDepartment);
    },
    listDevices() {
      return database
        .prepare(`
          SELECT
            id,
            name,
            category,
            model,
            description,
            is_active AS isActive,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM devices
          ORDER BY is_active DESC, name COLLATE NOCASE ASC
        `)
        .all()
        .map(mapDevice);
    },
    listInventory(filters = {}) {
      const orderBy = buildInventoryOrderBy(filters);
      return database
        .prepare(`
          SELECT
            id,
            first_name AS firstName,
            last_name AS lastName,
            department,
            department_id AS departmentId,
            device_name AS deviceName,
            device_id AS deviceId,
            asset_tag AS assetTag,
            serial_number AS serialNumber,
            asset_status AS assetStatus,
            condition_status AS conditionStatus,
            purchase_date AS purchaseDate,
            purchase_price AS purchasePrice,
            assigned_at AS assignedAt,
            warranty_until AS warrantyUntil,
            supplier,
            branch,
            room,
            desk,
            office_location AS officeLocation,
            accessories,
            notes,
            previous_holder AS previousHolder,
            current_holder AS currentHolder,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM inventory_records
          ${buildInventoryWhereClause()}
          ORDER BY ${orderBy}
          LIMIT :limit OFFSET :offset
        `)
        .all(buildInventoryParams(filters))
        .map(mapInventoryRecord);
    },
    listLatestInventoryChanges(limit = 6) {
      return database
        .prepare(`
          SELECT
            id,
            first_name AS firstName,
            last_name AS lastName,
            department,
            department_id AS departmentId,
            device_name AS deviceName,
            device_id AS deviceId,
            asset_tag AS assetTag,
            serial_number AS serialNumber,
            asset_status AS assetStatus,
            condition_status AS conditionStatus,
            purchase_date AS purchaseDate,
            purchase_price AS purchasePrice,
            assigned_at AS assignedAt,
            warranty_until AS warrantyUntil,
            supplier,
            branch,
            room,
            desk,
            office_location AS officeLocation,
            accessories,
            notes,
            previous_holder AS previousHolder,
            current_holder AS currentHolder,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM inventory_records
          ORDER BY updated_at DESC, id DESC
          LIMIT ?
        `)
        .all(limit)
        .map(mapInventoryRecord);
    },
    listRecentInventoryPurchases(limit = 6) {
      return database
        .prepare(`
          SELECT
            id,
            first_name AS firstName,
            last_name AS lastName,
            department,
            department_id AS departmentId,
            device_name AS deviceName,
            device_id AS deviceId,
            asset_tag AS assetTag,
            serial_number AS serialNumber,
            asset_status AS assetStatus,
            condition_status AS conditionStatus,
            purchase_date AS purchaseDate,
            purchase_price AS purchasePrice,
            assigned_at AS assignedAt,
            warranty_until AS warrantyUntil,
            supplier,
            branch,
            room,
            desk,
            office_location AS officeLocation,
            accessories,
            notes,
            previous_holder AS previousHolder,
            current_holder AS currentHolder,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM inventory_records
          WHERE purchase_date <> ''
          ORDER BY purchase_date DESC, updated_at DESC
          LIMIT ?
        `)
        .all(limit)
        .map(mapInventoryRecord);
    },
    listUpcomingWarranty(limit = 6) {
      return database
        .prepare(`
          SELECT
            id,
            first_name AS firstName,
            last_name AS lastName,
            department,
            department_id AS departmentId,
            device_name AS deviceName,
            device_id AS deviceId,
            asset_tag AS assetTag,
            serial_number AS serialNumber,
            asset_status AS assetStatus,
            condition_status AS conditionStatus,
            purchase_date AS purchaseDate,
            purchase_price AS purchasePrice,
            assigned_at AS assignedAt,
            warranty_until AS warrantyUntil,
            supplier,
            branch,
            room,
            desk,
            office_location AS officeLocation,
            accessories,
            notes,
            previous_holder AS previousHolder,
            current_holder AS currentHolder,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM inventory_records
          WHERE warranty_until <> ''
            AND warranty_until >= ?
          ORDER BY warranty_until ASC, updated_at DESC
          LIMIT ?
        `)
        .all(getTodayIsoDate(), limit)
        .map(mapInventoryRecord);
    },
    listUsers() {
      return database
        .prepare(`
          SELECT
            id,
            username,
            full_name AS fullName,
            role,
            is_active AS isActive,
            must_change_password AS mustChangePassword,
            password_changed_at AS passwordChangedAt,
            failed_login_attempts AS failedLoginAttempts,
            locked_until AS lockedUntil,
            last_login_at AS lastLoginAt,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM users
          ORDER BY full_name COLLATE NOCASE ASC
        `)
        .all()
        .map(mapUser);
    },
    searchGlobal(queryText) {
      const search = normalizeSearch(queryText);
      const params = {
        search,
        searchPattern: search ? `%${escapeLike(search)}%` : "%",
      };

      if (!search) {
        return {
          audit: [],
          departments: [],
          devices: [],
          inventory: [],
          users: [],
        };
      }

      return {
        audit: database
          .prepare(`
            SELECT id, action, summary, created_at AS createdAt
            FROM audit_logs
            WHERE lower(action) LIKE :searchPattern ESCAPE '\\'
               OR lower(summary) LIKE :searchPattern ESCAPE '\\'
            ORDER BY created_at DESC, id DESC
            LIMIT 5
          `)
          .all(params),
        departments: database
          .prepare(`
            SELECT id, name, code
            FROM departments
            WHERE lower(name) LIKE :searchPattern ESCAPE '\\'
               OR lower(code) LIKE :searchPattern ESCAPE '\\'
            ORDER BY name COLLATE NOCASE ASC
            LIMIT 5
          `)
          .all(params),
        devices: database
          .prepare(`
            SELECT id, name, category, model
            FROM devices
            WHERE lower(name) LIKE :searchPattern ESCAPE '\\'
               OR lower(category) LIKE :searchPattern ESCAPE '\\'
               OR lower(model) LIKE :searchPattern ESCAPE '\\'
            ORDER BY name COLLATE NOCASE ASC
            LIMIT 5
          `)
          .all(params),
        inventory: database
          .prepare(`
            SELECT
              id,
              first_name AS firstName,
              last_name AS lastName,
              device_name AS deviceName,
              department,
              asset_tag AS assetTag
            FROM inventory_records
            WHERE lower(first_name) LIKE :searchPattern ESCAPE '\\'
               OR lower(last_name) LIKE :searchPattern ESCAPE '\\'
               OR lower(device_name) LIKE :searchPattern ESCAPE '\\'
               OR lower(department) LIKE :searchPattern ESCAPE '\\'
               OR lower(asset_tag) LIKE :searchPattern ESCAPE '\\'
            ORDER BY updated_at DESC, id DESC
            LIMIT 8
          `)
          .all(params),
        users: database
          .prepare(`
            SELECT id, username, full_name AS fullName, role
            FROM users
            WHERE lower(username) LIKE :searchPattern ESCAPE '\\'
               OR lower(full_name) LIKE :searchPattern ESCAPE '\\'
            ORDER BY full_name COLLATE NOCASE ASC
            LIMIT 5
          `)
          .all(params),
      };
    },
    countActiveSessions() {
      return database
        .prepare(`
          SELECT COUNT(*) AS total
          FROM sessions
          WHERE expires_at > ?
        `)
        .get(getNow()).total;
    },
    getAuditSettings() {
      return buildAuditSettings(database);
    },
    getAutoBackupSettings() {
      return buildAutoBackupSettings(database, config);
    },
    getSystemMetrics() {
      const databaseStat = fs.existsSync(config.databasePath) ? fs.statSync(config.databasePath) : null;
      const auditSettings = buildAuditSettings(database);

      return {
        activeSessions: this.countActiveSessions(),
        auditLogs: database.prepare("SELECT COUNT(*) AS total FROM audit_logs").get().total,
        auditRetentionDays: auditSettings.retentionDays,
        autoBackup: buildAutoBackupSettings(database, config),
        attachmentFiles: database.prepare("SELECT COUNT(*) AS total FROM inventory_attachments").get().total,
        backupCount: database.prepare("SELECT COUNT(*) AS total FROM backup_runs").get().total,
        backupStorageBytes: getDirectorySize(config.backupsDir),
        databaseSizeBytes: databaseStat?.size || 0,
        records: this.getInventoryStats(),
        serviceLogs: database.prepare("SELECT COUNT(*) AS total FROM inventory_service_logs").get().total,
        totalUsers: database.prepare("SELECT COUNT(*) AS total FROM users").get().total,
        transfers: database.prepare("SELECT COUNT(*) AS total FROM inventory_transfers").get().total,
        uploadsSizeBytes: getDirectorySize(config.attachmentsDir),
      };
    },
    markUserLoginFailed(userId, payload = {}) {
      const currentUser = this.getUserById(userId);

      if (!currentUser) {
        return null;
      }

      const nextAttemptCount = Number(currentUser.failedLoginAttempts || 0) + 1;
      const lockedUntil =
        nextAttemptCount >= config.loginMaxAttempts
          ? new Date(Date.now() + config.loginLockDurationMs).toISOString()
          : "";

      database
        .prepare(`
          UPDATE users
          SET
            failed_login_attempts = ?,
            locked_until = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(nextAttemptCount, lockedUntil, getNow(), userId);

      return {
        failedLoginAttempts: nextAttemptCount,
        lockedUntil,
        username: payload.username || currentUser.username,
      };
    },
    markUserLoginSuccess(userId) {
      const now = getNow();
      database
        .prepare(`
          UPDATE users
          SET
            failed_login_attempts = 0,
            locked_until = '',
            last_login_at = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(now, now, userId);

      return this.getUserById(userId);
    },
    createAttachment(recordId, payload, userId) {
      const now = getNow();
      const result = database
        .prepare(`
          INSERT INTO inventory_attachments (
            inventory_record_id,
            file_name,
            stored_name,
            mime_type,
            file_size,
            file_path,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          recordId,
          payload.fileName,
          payload.storedName,
          payload.mimeType,
          payload.fileSize,
          payload.filePath,
          userId,
          now
        );

      return this.getAttachmentById(result.lastInsertRowid);
    },
    createBackupRun(fileName, summary, userId) {
      const now = getNow();
      const result = database
        .prepare(`
          INSERT INTO backup_runs (
            file_name,
            summary,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?)
        `)
        .run(fileName, summary, userId, now);

      return database
        .prepare(`
          SELECT
            id,
            file_name AS fileName,
            summary,
            created_by AS createdBy,
            created_at AS createdAt
          FROM backup_runs
          WHERE id = ?
        `)
        .get(result.lastInsertRowid);
    },
    createServiceLog(recordId, payload, userId) {
      const now = getNow();
      const result = database
        .prepare(`
          INSERT INTO inventory_service_logs (
            inventory_record_id,
            service_date,
            service_type,
            vendor,
            cost,
            notes,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          recordId,
          payload.serviceDate,
          payload.serviceType,
          payload.vendor,
          payload.cost,
          payload.notes,
          userId,
          now
        );

      return this.getServiceLogById(result.lastInsertRowid);
    },
    createTransfer(recordId, payload, userId) {
      const now = getNow();
      const result = database
        .prepare(`
          INSERT INTO inventory_transfers (
            inventory_record_id,
            from_holder,
            to_holder,
            from_department,
            to_department,
            from_status,
            to_status,
            transfer_date,
            notes,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          recordId,
          payload.fromHolder || "",
          payload.toHolder || "",
          payload.fromDepartment || "",
          payload.toDepartment || "",
          payload.fromStatus || "",
          payload.toStatus || "",
          payload.transferDate || now.slice(0, 10),
          payload.notes || "",
          userId,
          now
        );

      return this.getTransferById(result.lastInsertRowid);
    },
    exportBackupPayload() {
      return {
        backupVersion: 1,
        createdAt: getNow(),
        data: {
          attachments: database.prepare("SELECT * FROM inventory_attachments ORDER BY id ASC").all(),
          auditLogs: database.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all(),
          backupRuns: database.prepare("SELECT * FROM backup_runs ORDER BY id ASC").all(),
          departments: database.prepare("SELECT * FROM departments ORDER BY id ASC").all(),
          devices: database.prepare("SELECT * FROM devices ORDER BY id ASC").all(),
          inventoryRecords: database.prepare("SELECT * FROM inventory_records ORDER BY id ASC").all(),
          serviceLogs: database.prepare("SELECT * FROM inventory_service_logs ORDER BY id ASC").all(),
          systemSettings: database.prepare("SELECT * FROM system_settings ORDER BY setting_key ASC").all(),
          transfers: database.prepare("SELECT * FROM inventory_transfers ORDER BY id ASC").all(),
          users: database.prepare("SELECT * FROM users ORDER BY id ASC").all(),
        },
      };
    },
    getAttachmentById(attachmentId) {
      return database
        .prepare(`
          SELECT
            id,
            inventory_record_id AS inventoryRecordId,
            file_name AS fileName,
            stored_name AS storedName,
            mime_type AS mimeType,
            file_size AS fileSize,
            file_path AS filePath,
            created_by AS createdBy,
            created_at AS createdAt
          FROM inventory_attachments
          WHERE id = ?
          LIMIT 1
        `)
        .get(attachmentId);
    },
    getServiceLogById(serviceLogId) {
      return database
        .prepare(`
          SELECT
            id,
            inventory_record_id AS inventoryRecordId,
            service_date AS serviceDate,
            service_type AS serviceType,
            vendor,
            cost,
            notes,
            created_by AS createdBy,
            created_at AS createdAt
          FROM inventory_service_logs
          WHERE id = ?
          LIMIT 1
        `)
        .get(serviceLogId);
    },
    getTransferById(transferId) {
      return database
        .prepare(`
          SELECT
            id,
            inventory_record_id AS inventoryRecordId,
            from_holder AS fromHolder,
            to_holder AS toHolder,
            from_department AS fromDepartment,
            to_department AS toDepartment,
            from_status AS fromStatus,
            to_status AS toStatus,
            transfer_date AS transferDate,
            notes,
            created_by AS createdBy,
            created_at AS createdAt
          FROM inventory_transfers
          WHERE id = ?
          LIMIT 1
        `)
        .get(transferId);
    },
    listAttachments(recordId) {
      return database
        .prepare(`
          SELECT
            id,
            inventory_record_id AS inventoryRecordId,
            file_name AS fileName,
            stored_name AS storedName,
            mime_type AS mimeType,
            file_size AS fileSize,
            file_path AS filePath,
            created_by AS createdBy,
            created_at AS createdAt
          FROM inventory_attachments
          WHERE inventory_record_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(recordId);
    },
    listBackupRuns(limit = 20) {
      return database
        .prepare(`
          SELECT
            id,
            file_name AS fileName,
            summary,
            created_by AS createdBy,
            created_at AS createdAt
          FROM backup_runs
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `)
        .all(limit);
    },
    listServiceLogs(recordId) {
      return database
        .prepare(`
          SELECT
            id,
            inventory_record_id AS inventoryRecordId,
            service_date AS serviceDate,
            service_type AS serviceType,
            vendor,
            cost,
            notes,
            created_by AS createdBy,
            created_at AS createdAt
          FROM inventory_service_logs
          WHERE inventory_record_id = ?
          ORDER BY service_date DESC, id DESC
        `)
        .all(recordId);
    },
    listTransfers(recordId) {
      return database
        .prepare(`
          SELECT
            id,
            inventory_record_id AS inventoryRecordId,
            from_holder AS fromHolder,
            to_holder AS toHolder,
            from_department AS fromDepartment,
            to_department AS toDepartment,
            from_status AS fromStatus,
            to_status AS toStatus,
            transfer_date AS transferDate,
            notes,
            created_by AS createdBy,
            created_at AS createdAt
          FROM inventory_transfers
          WHERE inventory_record_id = ?
          ORDER BY transfer_date DESC, id DESC
        `)
        .all(recordId);
    },
    removeAttachment(attachmentId) {
      const attachment = this.getAttachmentById(attachmentId);

      if (!attachment) {
        return null;
      }

      database.prepare("DELETE FROM inventory_attachments WHERE id = ?").run(attachmentId);
      return attachment;
    },
    restoreBackupPayload(payload) {
      database.exec("BEGIN IMMEDIATE");

      try {
        database.exec(`
          DELETE FROM system_settings;
          DELETE FROM inventory_attachments;
          DELETE FROM inventory_service_logs;
          DELETE FROM inventory_transfers;
          DELETE FROM audit_logs;
          DELETE FROM backup_runs;
          DELETE FROM sessions;
          DELETE FROM inventory_records;
          DELETE FROM departments;
          DELETE FROM devices;
          DELETE FROM users;
        `);

        insertMany(database, "system_settings", payload.data.systemSettings || []);
        insertMany(database, "users", payload.data.users || []);
        insertMany(database, "departments", payload.data.departments || []);
        insertMany(database, "devices", payload.data.devices || []);
        insertMany(database, "inventory_records", payload.data.inventoryRecords || []);
        insertMany(database, "inventory_service_logs", payload.data.serviceLogs || []);
        insertMany(database, "inventory_transfers", payload.data.transfers || []);
        insertMany(database, "inventory_attachments", payload.data.attachments || []);
        insertMany(database, "backup_runs", payload.data.backupRuns || []);
        insertMany(database, "audit_logs", payload.data.auditLogs || []);

        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    setAuditRetentionDays(retentionDays) {
      const pruneResult = pruneAuditLogsByRetention(database, retentionDays);

      return {
        ...buildAuditSettings(database),
        deletedCount: pruneResult.deletedCount,
        prunedAt: pruneResult.prunedAt,
      };
    },
    setAutoBackupMeta(payload = {}) {
      if ("enabled" in payload) {
        setSettingValue(database, "auto_backup_enabled", payload.enabled ? "true" : "false");
      }

      if ("hour" in payload) {
        setSettingValue(
          database,
          "auto_backup_hour",
          String(normalizeAutoBackupHour(payload.hour, config.autoBackupHour))
        );
      }

      if ("keepDays" in payload) {
        setSettingValue(
          database,
          "auto_backup_keep_days",
          String(normalizeAutoBackupKeepDays(payload.keepDays, config.autoBackupKeepDays))
        );
      }

      if ("lastFileName" in payload) {
        setSettingValue(database, "auto_backup_last_file_name", payload.lastFileName || "");
      }

      if ("lastRunAt" in payload) {
        setSettingValue(database, "auto_backup_last_run_at", payload.lastRunAt || "");
      }

      if ("lastStatus" in payload) {
        setSettingValue(database, "auto_backup_last_status", payload.lastStatus || "");
      }

      return buildAutoBackupSettings(database, config);
    },
    logAudit(payload) {
      database
        .prepare(`
          INSERT INTO audit_logs (
            actor_user_id,
            actor_username,
            actor_name,
            actor_role,
            action,
            entity_type,
            entity_id,
            summary,
            details_json,
            ip_address,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          payload.actorUserId || null,
          payload.actorUsername || null,
          payload.actorName || null,
          payload.actorRole || null,
          payload.action,
          payload.entityType,
          payload.entityId || null,
          payload.summary,
          JSON.stringify(payload.details || {}),
          payload.ipAddress || null,
          getNow()
        );

      pruneAuditLogsByRetention(database);
    },
    pruneAuditLogs() {
      return pruneAuditLogsByRetention(database);
    },
    pruneExpiredSessions() {
      database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(getNow());
    },
    touchSession(sessionId, seenAt) {
      database.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(seenAt, sessionId);
    },
    updateDepartment(departmentId, payload) {
      const now = getNow();

      database
        .prepare(`
          UPDATE departments
          SET
            name = ?,
            code = ?,
            description = ?,
            is_active = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(payload.name, payload.code, payload.description, payload.isActive ? 1 : 0, now, departmentId);

      database
        .prepare(`
          UPDATE inventory_records
          SET
            department = ?,
            updated_at = ?
          WHERE department_id = ?
        `)
        .run(payload.name, now, departmentId);

      return this.getDepartmentById(departmentId);
    },
    updateDevice(deviceId, payload) {
      const now = getNow();

      database
        .prepare(`
          UPDATE devices
          SET
            name = ?,
            category = ?,
            model = ?,
            description = ?,
            is_active = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          payload.name,
          payload.category,
          payload.model,
          payload.description,
          payload.isActive ? 1 : 0,
          now,
          deviceId
        );

      database
        .prepare(`
          UPDATE inventory_records
          SET
            device_name = ?,
            updated_at = ?
          WHERE device_id = ?
        `)
        .run(payload.name, now, deviceId);

      return this.getDeviceById(deviceId);
    },
    updateInventory(recordId, payload, userId) {
      const now = getNow();
      const department = this.getDepartmentById(payload.departmentId);
      const device = this.getDeviceById(payload.deviceId);

      database
        .prepare(`
          UPDATE inventory_records
          SET
            first_name = ?,
            last_name = ?,
            department = ?,
            department_id = ?,
            device_name = ?,
            device_id = ?,
            asset_tag = ?,
            serial_number = ?,
            asset_status = ?,
            condition_status = ?,
            purchase_date = ?,
            purchase_price = ?,
            assigned_at = ?,
            warranty_until = ?,
            supplier = ?,
            branch = ?,
            room = ?,
            desk = ?,
            office_location = ?,
            accessories = ?,
            notes = ?,
            previous_holder = ?,
            current_holder = ?,
            updated_by = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          payload.firstName,
          payload.lastName,
          department.name,
          department.id,
          device.name,
          device.id,
          payload.assetTag,
          payload.serialNumber,
          payload.assetStatus,
          payload.conditionStatus,
          payload.purchaseDate,
          payload.purchasePrice,
          payload.assignedAt,
          payload.warrantyUntil,
          payload.supplier,
          payload.branch,
          payload.room,
          payload.desk,
          payload.officeLocation,
          payload.accessories,
          payload.notes,
          payload.previousHolder,
          payload.currentHolder,
          userId,
          now,
          recordId
        );

      return this.getInventoryById(recordId);
    },
    transferInventory(recordId, payload, userId) {
      const existingRecord = this.getInventoryById(recordId);
      const department = this.getDepartmentById(payload.departmentId);

      if (!existingRecord || !department) {
        return null;
      }

      const now = getNow();
      database
        .prepare(`
          UPDATE inventory_records
          SET
            previous_holder = ?,
            current_holder = ?,
            department = ?,
            department_id = ?,
            asset_status = ?,
            assigned_at = ?,
            updated_by = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          existingRecord.currentHolder || "-",
          payload.toHolder,
          department.name,
          department.id,
          payload.assetStatus,
          payload.transferDate || now.slice(0, 10),
          userId,
          now,
          recordId
        );

      const transfer = this.createTransfer(recordId, {
        fromDepartment: existingRecord.department,
        fromHolder: existingRecord.currentHolder,
        fromStatus: existingRecord.assetStatus,
        notes: payload.notes,
        toDepartment: department.name,
        toHolder: payload.toHolder,
        toStatus: payload.assetStatus,
        transferDate: payload.transferDate || now.slice(0, 10),
      }, userId);

      return {
        record: this.getInventoryById(recordId),
        transfer,
      };
    },
    updateUser(userId, payload) {
      const now = getNow();

      database
        .prepare(`
          UPDATE users
          SET
            username = ?,
            full_name = ?,
            role = ?,
            is_active = ?,
            must_change_password = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          payload.username,
          payload.fullName,
          payload.role,
          payload.isActive ? 1 : 0,
          payload.mustChangePassword ? 1 : 0,
          now,
          userId
        );

      if (payload.passwordHash) {
        database
          .prepare(`
            UPDATE users
            SET
              password_hash = ?,
              must_change_password = 0,
              password_changed_at = ?,
              failed_login_attempts = 0,
              locked_until = '',
              updated_at = ?
            WHERE id = ?
          `)
          .run(payload.passwordHash, getNow(), getNow(), userId);
      }

      return this.getUserById(userId);
    },
    updateUserPassword(userId, passwordHash, options = {}) {
      const now = getNow();
      database
        .prepare(`
          UPDATE users
          SET
            password_hash = ?,
            must_change_password = ?,
            password_changed_at = ?,
            failed_login_attempts = 0,
            locked_until = '',
            updated_at = ?
          WHERE id = ?
        `)
        .run(passwordHash, options.mustChangePassword ? 1 : 0, now, now, userId);

      return this.getUserById(userId);
    },
  };
}

function initializeDatabase(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      password_changed_at TEXT NOT NULL DEFAULT '',
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT NOT NULL DEFAULT '',
      last_login_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      code TEXT DEFAULT '',
      description TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT DEFAULT '',
      model TEXT DEFAULT '',
      description TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      department TEXT NOT NULL,
      department_id INTEGER,
      device_name TEXT NOT NULL,
      device_id INTEGER,
      asset_tag TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      asset_status TEXT NOT NULL DEFAULT 'in_use',
      condition_status TEXT NOT NULL DEFAULT 'good',
      purchase_date TEXT NOT NULL DEFAULT '',
      purchase_price REAL NOT NULL DEFAULT 0,
      assigned_at TEXT NOT NULL DEFAULT '',
      warranty_until TEXT NOT NULL DEFAULT '',
      supplier TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      room TEXT NOT NULL DEFAULT '',
      desk TEXT NOT NULL DEFAULT '',
      office_location TEXT NOT NULL DEFAULT '',
      accessories TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      previous_holder TEXT NOT NULL DEFAULT '-',
      current_holder TEXT NOT NULL,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_service_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_record_id INTEGER NOT NULL,
      service_date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      vendor TEXT NOT NULL DEFAULT '',
      cost REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (inventory_record_id) REFERENCES inventory_records(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_record_id INTEGER NOT NULL,
      from_holder TEXT NOT NULL DEFAULT '',
      to_holder TEXT NOT NULL DEFAULT '',
      from_department TEXT NOT NULL DEFAULT '',
      to_department TEXT NOT NULL DEFAULT '',
      from_status TEXT NOT NULL DEFAULT '',
      to_status TEXT NOT NULL DEFAULT '',
      transfer_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (inventory_record_id) REFERENCES inventory_records(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_record_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (inventory_record_id) REFERENCES inventory_records(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS backup_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_username TEXT,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      summary TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn(database, "users", "role", "TEXT NOT NULL DEFAULT 'admin'");
  ensureColumn(database, "users", "is_active", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(database, "users", "must_change_password", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "users", "password_changed_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "users", "failed_login_attempts", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "users", "locked_until", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "users", "last_login_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "department_id", "INTEGER");
  ensureColumn(database, "inventory_records", "device_id", "INTEGER");
  ensureColumn(database, "inventory_records", "asset_tag", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "serial_number", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "asset_status", `TEXT NOT NULL DEFAULT '${DEFAULT_ASSET_STATUS}'`);
  ensureColumn(database, "inventory_records", "condition_status", `TEXT NOT NULL DEFAULT '${DEFAULT_CONDITION_STATUS}'`);
  ensureColumn(database, "inventory_records", "purchase_date", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "purchase_price", "REAL NOT NULL DEFAULT 0");
  ensureColumn(database, "inventory_records", "assigned_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "warranty_until", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "supplier", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "branch", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "room", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "desk", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "office_location", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "accessories", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "notes", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "inventory_records", "updated_by", "INTEGER");

  database.exec(`
    UPDATE inventory_records
    SET
      asset_tag = COALESCE(asset_tag, ''),
      serial_number = COALESCE(serial_number, ''),
      asset_status = COALESCE(NULLIF(asset_status, ''), '${DEFAULT_ASSET_STATUS}'),
      condition_status = COALESCE(NULLIF(condition_status, ''), '${DEFAULT_CONDITION_STATUS}'),
      purchase_date = COALESCE(purchase_date, ''),
      purchase_price = COALESCE(purchase_price, 0),
      assigned_at = COALESCE(assigned_at, ''),
      warranty_until = COALESCE(warranty_until, ''),
      supplier = COALESCE(supplier, ''),
      branch = COALESCE(branch, ''),
      room = COALESCE(room, ''),
      desk = COALESCE(desk, ''),
      office_location = COALESCE(office_location, ''),
      accessories = COALESCE(accessories, ''),
      notes = COALESCE(notes, '')
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
    CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
    CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
    CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
    CREATE INDEX IF NOT EXISTS idx_inventory_department_id ON inventory_records(department_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_device_id ON inventory_records(device_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_asset_status ON inventory_records(asset_status);
    CREATE INDEX IF NOT EXISTS idx_inventory_condition_status ON inventory_records(condition_status);
    CREATE INDEX IF NOT EXISTS idx_inventory_asset_tag ON inventory_records(asset_tag);
    CREATE INDEX IF NOT EXISTS idx_inventory_purchase_date ON inventory_records(purchase_date DESC);
    CREATE INDEX IF NOT EXISTS idx_inventory_warranty_until ON inventory_records(warranty_until ASC);
    CREATE INDEX IF NOT EXISTS idx_inventory_updated_at ON inventory_records(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_service_logs_record_date ON inventory_service_logs(inventory_record_id, service_date DESC);
    CREATE INDEX IF NOT EXISTS idx_transfers_record_date ON inventory_transfers(inventory_record_id, transfer_date DESC);
    CREATE INDEX IF NOT EXISTS idx_attachments_record ON inventory_attachments(inventory_record_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
  `);
}

function seedDefaultAdmin(database, config) {
  const existingUsers = database.prepare("SELECT COUNT(*) AS total FROM users").get();

  if (existingUsers.total > 0) {
    return;
  }

  const now = getNow();

  database
    .prepare(`
      INSERT INTO users (
        username,
        full_name,
        password_hash,
        role,
        is_active,
        must_change_password,
        password_changed_at,
        failed_login_attempts,
        locked_until,
        last_login_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'admin', 1, ?, ?, 0, '', '', ?, ?)
    `)
    .run(
      config.defaultAdminUsername,
      config.defaultAdminName,
      hashPassword(config.defaultAdminPassword),
      config.forceDefaultAdminPasswordChange ? 1 : 0,
      now,
      now,
      now
    );
}

function seedSystemSettings(database, config) {
  const now = getNow();
  database
    .prepare(`
      INSERT OR IGNORE INTO system_settings (
        setting_key,
        setting_value,
        updated_at
      ) VALUES (?, ?, ?)
    `)
    .run("audit_retention_days", String(DEFAULT_AUDIT_RETENTION_DAYS), now);

  database
    .prepare(`
      INSERT OR IGNORE INTO system_settings (
        setting_key,
        setting_value,
        updated_at
      ) VALUES (?, ?, ?)
    `)
    .run("audit_last_pruned_at", "", now);

  const defaultSettings = [
    ["auto_backup_enabled", config.autoBackupEnabled ? "true" : "false"],
    ["auto_backup_hour", String(normalizeAutoBackupHour(config.autoBackupHour, DEFAULT_AUTO_BACKUP_HOUR))],
    ["auto_backup_keep_days", String(normalizeAutoBackupKeepDays(config.autoBackupKeepDays, DEFAULT_AUTO_BACKUP_KEEP_DAYS))],
    ["auto_backup_last_run_at", ""],
    ["auto_backup_last_status", config.autoBackupEnabled ? "Kutilmoqda" : "O'chirilgan"],
    ["auto_backup_last_file_name", ""],
  ];

  const insertSetting = database.prepare(`
    INSERT OR IGNORE INTO system_settings (
      setting_key,
      setting_value,
      updated_at
    ) VALUES (?, ?, ?)
  `);

  defaultSettings.forEach(([settingKey, settingValue]) => {
    insertSetting.run(settingKey, settingValue, now);
  });
}

function seedCatalogsFromInventory(database) {
  const departmentNames = database
    .prepare(`
      SELECT DISTINCT trim(department) AS name
      FROM inventory_records
      WHERE trim(department) <> ''
    `)
    .all();

  departmentNames.forEach((item) => {
    insertDepartmentIfMissing(database, item.name);
  });

  const deviceNames = database
    .prepare(`
      SELECT DISTINCT trim(device_name) AS name
      FROM inventory_records
      WHERE trim(device_name) <> ''
    `)
    .all();

  deviceNames.forEach((item) => {
    insertDeviceIfMissing(database, item.name);
  });
}

function seedRecommendedCatalogs(database) {
  defaultDepartments.forEach((department) => {
    insertDepartmentIfMissing(database, department);
  });

  defaultDevices.forEach((device) => {
    insertDeviceIfMissing(database, device);
  });
}

function syncInventoryCatalogLinks(database) {
  database.exec(`
    UPDATE inventory_records
    SET department_id = (
      SELECT id
      FROM departments
      WHERE lower(departments.name) = lower(inventory_records.department)
      LIMIT 1
    )
    WHERE department_id IS NULL OR department_id = 0;

    UPDATE inventory_records
    SET device_id = (
      SELECT id
      FROM devices
      WHERE lower(devices.name) = lower(inventory_records.device_name)
      LIMIT 1
    )
    WHERE device_id IS NULL OR device_id = 0;
  `);
}

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function ensureDepartmentByName(database, name) {
  const normalizedName = normalizeText(name);
  let record = database
    .prepare(`
      SELECT
        id,
        name,
        code,
        description,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM departments
      WHERE name = ?
      LIMIT 1
    `)
    .get(normalizedName);

  if (record) {
    return {
      created: false,
      record: mapDepartment(record),
    };
  }

  insertDepartmentIfMissing(database, normalizedName);

  record = database
    .prepare(`
      SELECT
        id,
        name,
        code,
        description,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM departments
      WHERE name = ?
      LIMIT 1
    `)
    .get(normalizedName);

  return {
    created: true,
    record: mapDepartment(record),
  };
}

function ensureDeviceByName(database, name) {
  const normalizedName = normalizeText(name);
  let record = database
    .prepare(`
      SELECT
        id,
        name,
        category,
        model,
        description,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM devices
      WHERE name = ?
      LIMIT 1
    `)
    .get(normalizedName);

  if (record) {
    return {
      created: false,
      record: mapDevice(record),
    };
  }

  insertDeviceIfMissing(database, normalizedName);

  record = database
    .prepare(`
      SELECT
        id,
        name,
        category,
        model,
        description,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM devices
      WHERE name = ?
      LIMIT 1
    `)
    .get(normalizedName);

  return {
    created: true,
    record: mapDevice(record),
  };
}

function insertDepartmentIfMissing(database, name) {
  const payload =
    typeof name === "string"
      ? {
          code: "",
          description: "",
          isActive: true,
          name,
        }
      : {
          code: name.code || "",
          description: name.description || "",
          isActive: name.isActive !== false,
          name: name.name,
        };
  const now = getNow();
  database
    .prepare(`
      INSERT OR IGNORE INTO departments (
        name,
        code,
        description,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      normalizeText(payload.name),
      normalizeText(payload.code),
      normalizeText(payload.description),
      payload.isActive ? 1 : 0,
      now,
      now
    );
}

function insertDeviceIfMissing(database, name) {
  const payload =
    typeof name === "string"
      ? {
          category: "",
          description: "",
          isActive: true,
          model: "",
          name,
        }
      : {
          category: name.category || "",
          description: name.description || "",
          isActive: name.isActive !== false,
          model: name.model || "",
          name: name.name,
        };
  const now = getNow();
  database
    .prepare(`
      INSERT OR IGNORE INTO devices (
        name,
        category,
        model,
        description,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      normalizeText(payload.name),
      normalizeText(payload.category),
      normalizeText(payload.model),
      normalizeText(payload.description),
      payload.isActive ? 1 : 0,
      now,
      now
    );
}

function findExistingInventoryForImport(database, row) {
  const assetTag = normalizeText(row.assetTag);
  const serialNumber = normalizeText(row.serialNumber);

  if (assetTag) {
    return database
      .prepare(`
        SELECT
          id,
          department,
          asset_status,
          current_holder
        FROM inventory_records
        WHERE lower(asset_tag) = lower(?)
        LIMIT 1
      `)
      .get(assetTag);
  }

  if (serialNumber) {
    return database
      .prepare(`
        SELECT
          id,
          department,
          asset_status,
          current_holder
        FROM inventory_records
        WHERE lower(serial_number) = lower(?)
        LIMIT 1
      `)
      .get(serialNumber);
  }

  return null;
}

function buildInventoryWhereClause() {
  return `
    WHERE (:search = '' OR
      lower(first_name) LIKE :searchPattern ESCAPE '\\' OR
      lower(last_name) LIKE :searchPattern ESCAPE '\\' OR
      lower(department) LIKE :searchPattern ESCAPE '\\' OR
      lower(device_name) LIKE :searchPattern ESCAPE '\\' OR
      lower(asset_tag) LIKE :searchPattern ESCAPE '\\' OR
      lower(serial_number) LIKE :searchPattern ESCAPE '\\' OR
      lower(asset_status) LIKE :searchPattern ESCAPE '\\' OR
      lower(condition_status) LIKE :searchPattern ESCAPE '\\' OR
      lower(purchase_date) LIKE :searchPattern ESCAPE '\\' OR
      lower(warranty_until) LIKE :searchPattern ESCAPE '\\' OR
      lower(supplier) LIKE :searchPattern ESCAPE '\\' OR
      lower(branch) LIKE :searchPattern ESCAPE '\\' OR
      lower(room) LIKE :searchPattern ESCAPE '\\' OR
      lower(desk) LIKE :searchPattern ESCAPE '\\' OR
      lower(office_location) LIKE :searchPattern ESCAPE '\\' OR
      lower(accessories) LIKE :searchPattern ESCAPE '\\' OR
      lower(notes) LIKE :searchPattern ESCAPE '\\' OR
      lower(previous_holder) LIKE :searchPattern ESCAPE '\\' OR
      lower(current_holder) LIKE :searchPattern ESCAPE '\\'
    )
    AND (:departmentId = 0 OR department_id = :departmentId)
    AND (:deviceId = 0 OR device_id = :deviceId)
    AND (:assetStatus = '' OR asset_status = :assetStatus)
    AND (:conditionStatus = '' OR condition_status = :conditionStatus)
  `;
}

function buildInventoryParams(filters = {}) {
  return {
    ...buildInventoryFilterParams(filters),
    limit: clampInteger(filters.pageSize, 25, 5, 100),
    offset: (clampInteger(filters.page, 1, 1, 999999) - 1) * clampInteger(filters.pageSize, 25, 5, 100),
  };
}

function buildInventoryStatsParams(filters = {}) {
  return {
    ...buildInventoryFilterParams(filters),
    today: getTodayIsoDate(),
    warrantyLimit: getFutureIsoDate(30),
    yearStart: getYearStartIsoDate(),
  };
}

function buildInventoryFilterParams(filters = {}) {
  const search = normalizeSearch(filters.search);

  return {
    assetStatus: normalizeSearch(filters.assetStatus),
    conditionStatus: normalizeSearch(filters.conditionStatus),
    departmentId: Number(filters.departmentId) || 0,
    deviceId: Number(filters.deviceId) || 0,
    search,
    searchPattern: search ? `%${escapeLike(search)}%` : "%",
  };
}

function buildAuditWhereClause() {
  return `
    WHERE (:search = '' OR
      lower(action) LIKE :searchPattern ESCAPE '\\' OR
      lower(entity_type) LIKE :searchPattern ESCAPE '\\' OR
      lower(COALESCE(actor_name, actor_username, '')) LIKE :searchPattern ESCAPE '\\' OR
      lower(summary) LIKE :searchPattern ESCAPE '\\'
    )
    AND (:entityType = '' OR entity_type = :entityType)
  `;
}

function buildAuditParams(filters = {}) {
  const search = normalizeSearch(filters.search);

  return {
    entityType: normalizeSearch(filters.entityType),
    limit: Number(filters.limit) || 100,
    search,
    searchPattern: search ? `%${escapeLike(search)}%` : "%",
  };
}

function buildAuditSettings(database) {
  return {
    autoRefreshSeconds: AUDIT_AUTO_REFRESH_SECONDS,
    lastPrunedAt: getSettingValue(database, "audit_last_pruned_at", ""),
    retentionDays: getAuditRetentionDays(database),
    retentionOptions: [...AUDIT_RETENTION_OPTIONS],
  };
}

function buildAutoBackupSettings(database, config) {
  const enabled = normalizeSettingBoolean(
    getSettingValue(database, "auto_backup_enabled", String(config.autoBackupEnabled)),
    config.autoBackupEnabled
  );
  const hour = normalizeAutoBackupHour(
    getSettingValue(database, "auto_backup_hour", String(config.autoBackupHour)),
    config.autoBackupHour
  );
  const keepDays = normalizeAutoBackupKeepDays(
    getSettingValue(database, "auto_backup_keep_days", String(config.autoBackupKeepDays)),
    config.autoBackupKeepDays
  );
  const lastRunAt = getSettingValue(database, "auto_backup_last_run_at", "");
  const lastStatus = getSettingValue(
    database,
    "auto_backup_last_status",
    enabled ? "Kutilmoqda" : "O'chirilgan"
  );

  return {
    enabled,
    hour,
    keepDays,
    lastFileName: getSettingValue(database, "auto_backup_last_file_name", ""),
    lastRunAt,
    lastStatus,
    scheduleLabel: `Har kuni ${String(hour).padStart(2, "0")}:00`,
  };
}

function getAuditRetentionDays(database) {
  return normalizeAuditRetentionDays(
    getSettingValue(database, "audit_retention_days", String(DEFAULT_AUDIT_RETENTION_DAYS))
  );
}

function normalizeAuditRetentionDays(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return AUDIT_RETENTION_OPTIONS.includes(parsed) ? parsed : DEFAULT_AUDIT_RETENTION_DAYS;
}

function normalizeAutoBackupHour(value, fallbackValue = DEFAULT_AUTO_BACKUP_HOUR) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(parsed)) {
    return fallbackValue;
  }

  return Math.min(23, Math.max(0, parsed));
}

function normalizeAutoBackupKeepDays(value, fallbackValue = DEFAULT_AUTO_BACKUP_KEEP_DAYS) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(parsed)) {
    return fallbackValue;
  }

  return Math.max(1, parsed);
}

function normalizeSettingBoolean(value, fallbackValue = false) {
  if (value == null || value === "") {
    return fallbackValue;
  }

  return String(value).trim().toLowerCase() === "true";
}

function pruneAuditLogsByRetention(database, retentionDays = getAuditRetentionDays(database)) {
  const normalizedRetentionDays = normalizeAuditRetentionDays(retentionDays);
  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - normalizedRetentionDays);
  const cutoffIso = cutoffDate.toISOString();
  const deletedCount = database
    .prepare(`
      SELECT COUNT(*) AS total
      FROM audit_logs
      WHERE created_at < ?
    `)
    .get(cutoffIso).total;

  if (deletedCount) {
    database
      .prepare(`
        DELETE FROM audit_logs
        WHERE created_at < ?
      `)
      .run(cutoffIso);
  }

  const prunedAt = getNow();
  setSettingValue(database, "audit_retention_days", String(normalizedRetentionDays));
  setSettingValue(database, "audit_last_pruned_at", prunedAt);

  return {
    cutoffIso,
    deletedCount,
    prunedAt,
    retentionDays: normalizedRetentionDays,
  };
}

function getSettingValue(database, settingKey, fallbackValue = "") {
  const row = database
    .prepare(`
      SELECT setting_value AS settingValue
      FROM system_settings
      WHERE setting_key = ?
      LIMIT 1
    `)
    .get(settingKey);

  return row ? row.settingValue : fallbackValue;
}

function setSettingValue(database, settingKey, settingValue) {
  database
    .prepare(`
      INSERT INTO system_settings (
        setting_key,
        setting_value,
        updated_at
      ) VALUES (?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = excluded.updated_at
    `)
    .run(settingKey, String(settingValue ?? ""), getNow());
}

function mapDepartment(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    isActive: Boolean(row.isActive),
  };
}

function mapDevice(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    isActive: Boolean(row.isActive),
  };
}

function mapInventoryRecord(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    accessories: row.accessories || "",
    assetStatus: row.assetStatus || DEFAULT_ASSET_STATUS,
    assetTag: row.assetTag || "",
    assignedAt: row.assignedAt || "",
    branch: row.branch || "",
    conditionStatus: row.conditionStatus || DEFAULT_CONDITION_STATUS,
    desk: row.desk || "",
    notes: row.notes || "",
    officeLocation: row.officeLocation || "",
    purchaseDate: row.purchaseDate || "",
    purchasePrice: Number(row.purchasePrice || 0),
    room: row.room || "",
    serialNumber: row.serialNumber || "",
    supplier: row.supplier || "",
    warrantyUntil: row.warrantyUntil || "",
  };
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  const mappedRow = {
    ...row,
    failedLoginAttempts: Number(row.failedLoginAttempts || 0),
    isActive: Boolean(row.isActive),
    mustChangePassword: Boolean(row.mustChangePassword),
  };

  if (!mappedRow.passwordHash) {
    delete mappedRow.passwordHash;
  }

  return mappedRow;
}

function mapAuditLog(row) {
  return {
    ...row,
    details: safeJsonParse(row.detailsJson),
  };
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch (_error) {
    return {};
  }
}

function normalizeSearch(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function buildInventoryOrderBy(filters = {}) {
  const sortBy = String(filters.sortBy || "updatedAt");
  const direction = String(filters.sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const sortableColumns = {
    assetTag: "asset_tag",
    currentHolder: "current_holder",
    department: "department",
    deviceName: "device_name",
    purchaseDate: "purchase_date",
    updatedAt: "updated_at",
    warrantyUntil: "warranty_until",
  };
  const sortColumn = sortableColumns[sortBy] || "updated_at";
  return `${sortColumn} ${direction}, id DESC`;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getNow() {
  return new Date().toISOString();
}

function getTodayIsoDate() {
  return getNow().slice(0, 10);
}

function getFutureIsoDate(days) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  return futureDate.toISOString().slice(0, 10);
}

function getYearStartIsoDate() {
  return `${new Date().getFullYear()}-01-01`;
}

function unique(items) {
  return [...new Set(items)];
}

function insertMany(database, tableName, rows) {
  rows.forEach((row) => {
    const keys = Object.keys(row || {});

    if (!keys.length) {
      return;
    }

    const placeholders = keys.map(() => "?").join(", ");
    const columns = keys.join(", ");
    const statement = database.prepare(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`);
    statement.run(...keys.map((key) => row[key]));
  });
}

function getDirectorySize(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    return stat.size;
  }

  return fs.readdirSync(targetPath).reduce((total, entry) => {
    return total + getDirectorySize(path.join(targetPath, entry));
  }, 0);
}

module.exports = {
  createDatabase,
};
