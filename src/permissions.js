const ROLE_LABELS = {
  admin: "Administrator",
  auditor: "Auditor",
  manager: "Manager",
  support: "IT Support",
  viewer: "Kuzatuvchi",
  warehouse: "Ombor mas'uli",
};

const ROLE_DESCRIPTIONS = {
  admin: "Tizim, foydalanuvchi, backup, audit va barcha aktivlarni to'liq boshqaradi.",
  auditor: "Audit, hisobot va inventar ma'lumotlarini nazorat qiladi, lekin o'zgartira olmaydi.",
  manager: "Inventar, katalog, servis, attachment va hisobotlar bilan ishlaydi.",
  support: "Servis, attachment va aktivlarning texnik holati bilan ishlaydi.",
  viewer: "Faqat ko'rish va eksport qilish huquqiga ega.",
  warehouse: "Aktiv kirim-chiqimi, zaxira va biriktirish jarayonlarini yuritadi.",
};

const PERMISSION_MATRIX = {
  admin: [
    "exportInventory",
    "importInventory",
    "manageAttachments",
    "manageBackups",
    "manageCatalogs",
    "manageInventory",
    "manageService",
    "manageSettings",
    "manageUsers",
    "viewAudit",
    "viewInventory",
    "viewReports",
  ],
  auditor: [
    "exportInventory",
    "viewAudit",
    "viewInventory",
    "viewReports",
  ],
  manager: [
    "exportInventory",
    "importInventory",
    "manageAttachments",
    "manageCatalogs",
    "manageInventory",
    "manageService",
    "viewAudit",
    "viewInventory",
    "viewReports",
  ],
  support: [
    "exportInventory",
    "manageAttachments",
    "manageInventory",
    "manageService",
    "viewInventory",
    "viewReports",
  ],
  viewer: [
    "exportInventory",
    "viewInventory",
    "viewReports",
  ],
  warehouse: [
    "exportInventory",
    "importInventory",
    "manageAttachments",
    "manageInventory",
    "manageService",
    "viewInventory",
    "viewReports",
  ],
};

const ALL_PERMISSIONS = [
  "exportInventory",
  "importInventory",
  "manageAttachments",
  "manageBackups",
  "manageCatalogs",
  "manageInventory",
  "manageService",
  "manageSettings",
  "manageUsers",
  "viewAudit",
  "viewInventory",
  "viewReports",
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
