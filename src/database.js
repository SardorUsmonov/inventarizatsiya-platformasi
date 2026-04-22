const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { hashPassword } = require("./auth");
const { defaultDepartments, defaultDevices } = require("./catalog-presets");

function createDatabase(config) {
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

  const database = new DatabaseSync(config.databasePath);
  initializeDatabase(database);
  seedDefaultAdmin(database, config);
  seedRecommendedCatalogs(database);
  seedCatalogsFromInventory(database);
  syncInventoryCatalogLinks(database);

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
            previous_holder,
            current_holder,
            created_by,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          payload.firstName,
          payload.lastName,
          department.name,
          department.id,
          device.name,
          device.id,
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
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          payload.username,
          payload.fullName,
          payload.passwordHash,
          payload.role,
          payload.isActive ? 1 : 0,
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
    deleteSessionByTokenHash(tokenHash) {
      database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
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
    getInventoryStats(filters) {
      return database
        .prepare(`
          SELECT
            COUNT(*) AS totalRecords,
            COUNT(DISTINCT lower(trim(department))) AS totalDepartments,
            COALESCE(SUM(CASE WHEN trim(current_holder) <> '' THEN 1 ELSE 0 END), 0) AS activeDevices
          FROM inventory_records
          ${buildInventoryWhereClause()}
        `)
        .get(buildInventoryParams(filters));
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
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM users
            WHERE username = ?
            LIMIT 1
          `)
          .get(username)
      );
    },
    importInventoryRows(rows, userId) {
      const createdDepartments = [];
      const createdDevices = [];
      let insertedCount = 0;

      database.exec("BEGIN IMMEDIATE");

      try {
        rows.forEach((row) => {
          const departmentRef = ensureDepartmentByName(database, row.department);
          const deviceRef = ensureDeviceByName(database, row.deviceName);

          if (departmentRef.created) {
            createdDepartments.push(departmentRef.record.name);
          }

          if (deviceRef.created) {
            createdDevices.push(deviceRef.record.name);
          }

          const now = getNow();

          database
            .prepare(`
              INSERT INTO inventory_records (
                first_name,
                last_name,
                department,
                department_id,
                device_name,
                device_id,
                previous_holder,
                current_holder,
                created_by,
                updated_by,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              row.firstName,
              row.lastName,
              departmentRef.record.name,
              departmentRef.record.id,
              deviceRef.record.name,
              deviceRef.record.id,
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
      };
    },
    listAuditLogs(filters = {}) {
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
            previous_holder AS previousHolder,
            current_holder AS currentHolder,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM inventory_records
          ${buildInventoryWhereClause()}
          ORDER BY updated_at DESC, id DESC
        `)
        .all(buildInventoryParams(filters))
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
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM users
          ORDER BY full_name COLLATE NOCASE ASC
        `)
        .all()
        .map(mapUser);
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
          payload.previousHolder,
          payload.currentHolder,
          userId,
          now,
          recordId
        );

      return this.getInventoryById(recordId);
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
            updated_at = ?
          WHERE id = ?
        `)
        .run(payload.username, payload.fullName, payload.role, payload.isActive ? 1 : 0, now, userId);

      if (payload.passwordHash) {
        database
          .prepare(`
            UPDATE users
            SET
              password_hash = ?,
              updated_at = ?
            WHERE id = ?
          `)
          .run(payload.passwordHash, getNow(), userId);
      }

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
      device_name TEXT NOT NULL,
      previous_holder TEXT NOT NULL DEFAULT '-',
      current_holder TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
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
  ensureColumn(database, "inventory_records", "department_id", "INTEGER");
  ensureColumn(database, "inventory_records", "device_id", "INTEGER");
  ensureColumn(database, "inventory_records", "updated_by", "INTEGER");

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
    CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
    CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
    CREATE INDEX IF NOT EXISTS idx_inventory_department_id ON inventory_records(department_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_device_id ON inventory_records(device_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_updated_at ON inventory_records(updated_at DESC);
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
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'admin', 1, ?, ?)
    `)
    .run(
      config.defaultAdminUsername,
      config.defaultAdminName,
      hashPassword(config.defaultAdminPassword),
      now,
      now
    );
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

function buildInventoryWhereClause() {
  return `
    WHERE (:search = '' OR
      lower(first_name) LIKE :searchPattern ESCAPE '\\' OR
      lower(last_name) LIKE :searchPattern ESCAPE '\\' OR
      lower(department) LIKE :searchPattern ESCAPE '\\' OR
      lower(device_name) LIKE :searchPattern ESCAPE '\\' OR
      lower(previous_holder) LIKE :searchPattern ESCAPE '\\' OR
      lower(current_holder) LIKE :searchPattern ESCAPE '\\'
    )
    AND (:departmentId = 0 OR department_id = :departmentId)
    AND (:deviceId = 0 OR device_id = :deviceId)
  `;
}

function buildInventoryParams(filters = {}) {
  const search = normalizeSearch(filters.search);

  return {
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

  return row;
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  const mappedRow = {
    ...row,
    isActive: Boolean(row.isActive),
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

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getNow() {
  return new Date().toISOString();
}

function unique(items) {
  return [...new Set(items)];
}

module.exports = {
  createDatabase,
};
