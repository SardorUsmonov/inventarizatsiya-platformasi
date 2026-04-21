const ROLE_LABELS = {
  admin: "Administrator",
  manager: "Manager",
  viewer: "Kuzatuvchi",
};

const ROLE_DESCRIPTIONS = {
  admin: "Tizim, foydalanuvchi, katalog va auditni to'liq boshqaradi.",
  manager: "Inventar va kataloglar bilan ishlaydi, auditni ko'ra oladi.",
  viewer: "Faqat ko'rish va eksport qilish huquqiga ega.",
};

const PERMISSION_MATRIX = {
  admin: [
    "exportInventory",
    "importInventory",
    "manageCatalogs",
    "manageInventory",
    "manageUsers",
    "viewAudit",
    "viewInventory",
  ],
  manager: [
    "exportInventory",
    "importInventory",
    "manageCatalogs",
    "manageInventory",
    "viewAudit",
    "viewInventory",
  ],
  viewer: [
    "exportInventory",
    "viewInventory",
  ],
};

const ALL_PERMISSIONS = [
  "exportInventory",
  "importInventory",
  "manageCatalogs",
  "manageInventory",
  "manageUsers",
  "viewAudit",
  "viewInventory",
];

function getPermissions(role) {
  const activePermissions = new Set(PERMISSION_MATRIX[role] || []);

  return ALL_PERMISSIONS.reduce((result, permissionName) => {
    result[permissionName] = activePermissions.has(permissionName);
    return result;
  }, {});
}

function hasPermission(role, permissionName) {
  return Boolean(getPermissions(role)[permissionName]);
}

function isKnownRole(role) {
  return Object.prototype.hasOwnProperty.call(PERMISSION_MATRIX, role);
}

function listRoles() {
  return Object.keys(PERMISSION_MATRIX).map((role) => ({
    description: ROLE_DESCRIPTIONS[role],
    label: ROLE_LABELS[role],
    value: role,
  }));
}

module.exports = {
  getPermissions,
  hasPermission,
  isKnownRole,
  listRoles,
};
