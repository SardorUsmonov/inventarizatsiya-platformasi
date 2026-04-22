const ExcelJS = require("exceljs");
const {
  getAssetStatusLabel,
  getConditionStatusLabel,
  listAssetStatuses,
  listConditionStatuses,
} = require("./inventory-options");

async function createInventoryWorkbook(records) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventar");

  sheet.columns = [
    { header: "Ism", key: "firstName", width: 18 },
    { header: "Familya", key: "lastName", width: 22 },
    { header: "Bo'lim", key: "department", width: 24 },
    { header: "Texnika nomi", key: "deviceName", width: 28 },
    { header: "Asset tag", key: "assetTag", width: 18 },
    { header: "Serial raqam", key: "serialNumber", width: 24 },
    { header: "Status", key: "assetStatus", width: 18 },
    { header: "Holati", key: "conditionStatus", width: 18 },
    { header: "Sotib olingan sana", key: "purchaseDate", width: 18 },
    { header: "Sotib olish narxi", key: "purchasePrice", width: 16 },
    { header: "Biriktirilgan sana", key: "assignedAt", width: 18 },
    { header: "Kafolat muddati", key: "warrantyUntil", width: 18 },
    { header: "Yetkazib beruvchi", key: "supplier", width: 22 },
    { header: "Filial", key: "branch", width: 20 },
    { header: "Xona", key: "room", width: 14 },
    { header: "Stol", key: "desk", width: 14 },
    { header: "Joylashuv", key: "officeLocation", width: 22 },
    { header: "Qo'shimcha texnikalar", key: "accessories", width: 30 },
    { header: "Izoh", key: "notes", width: 30 },
    { header: "Oldin kimda", key: "previousHolder", width: 24 },
    { header: "Hozir kimda", key: "currentHolder", width: 24 },
    { header: "Yaratilgan sana", key: "createdAt", width: 22 },
    { header: "Yangilangan sana", key: "updatedAt", width: 22 },
  ];

  styleHeader(sheet.getRow(1));

  records.forEach((record) => {
    sheet.addRow({
      createdAt: formatDate(record.createdAt),
      currentHolder: record.currentHolder,
      department: record.department,
      deviceName: record.deviceName,
      firstName: record.firstName,
      lastName: record.lastName,
      assetTag: record.assetTag,
      serialNumber: record.serialNumber,
      assetStatus: getAssetStatusLabel(record.assetStatus),
      conditionStatus: getConditionStatusLabel(record.conditionStatus),
      purchaseDate: record.purchaseDate,
      purchasePrice: record.purchasePrice,
      assignedAt: record.assignedAt,
      warrantyUntil: record.warrantyUntil,
      supplier: record.supplier,
      branch: record.branch,
      room: record.room,
      desk: record.desk,
      officeLocation: record.officeLocation,
      accessories: record.accessories,
      notes: record.notes,
      previousHolder: record.previousHolder,
      updatedAt: formatDate(record.updatedAt),
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createInventoryTemplateWorkbook(payload) {
  const workbook = new ExcelJS.Workbook();
  const inventorySheet = workbook.addWorksheet("Inventar");

  inventorySheet.columns = [
    { header: "Ism", key: "firstName", width: 18 },
    { header: "Familya", key: "lastName", width: 22 },
    { header: "Bo'lim", key: "department", width: 24 },
    { header: "Texnika nomi", key: "deviceName", width: 28 },
    { header: "Asset tag", key: "assetTag", width: 18 },
    { header: "Serial raqam", key: "serialNumber", width: 24 },
    { header: "Status", key: "assetStatus", width: 18 },
    { header: "Holati", key: "conditionStatus", width: 18 },
    { header: "Sotib olingan sana", key: "purchaseDate", width: 18 },
    { header: "Sotib olish narxi", key: "purchasePrice", width: 16 },
    { header: "Biriktirilgan sana", key: "assignedAt", width: 18 },
    { header: "Kafolat muddati", key: "warrantyUntil", width: 18 },
    { header: "Yetkazib beruvchi", key: "supplier", width: 22 },
    { header: "Filial", key: "branch", width: 20 },
    { header: "Xona", key: "room", width: 14 },
    { header: "Stol", key: "desk", width: 14 },
    { header: "Joylashuv", key: "officeLocation", width: 22 },
    { header: "Qo'shimcha texnikalar", key: "accessories", width: 30 },
    { header: "Izoh", key: "notes", width: 30 },
    { header: "Oldin kimda", key: "previousHolder", width: 24 },
    { header: "Hozir kimda", key: "currentHolder", width: 24 },
  ];

  styleHeader(inventorySheet.getRow(1));
  inventorySheet.addRow({
    currentHolder: "Ali Karimov",
    department: payload.departments[0]?.name || "IT bo'limi",
    deviceName: payload.devices[0]?.name || "Dell Latitude 5520",
    firstName: "Ali",
    lastName: "Karimov",
    assetTag: "NB-001",
    serialNumber: "SN-4455-2026",
    assetStatus: getAssetStatusLabel("in_use"),
    conditionStatus: getConditionStatusLabel("excellent"),
    purchaseDate: "2026-01-12",
    purchasePrice: 1450,
    assignedAt: "2026-01-15",
    warrantyUntil: "2028-01-12",
    supplier: "Dell Uzbekistan",
    branch: "Toshkent HQ",
    room: "304",
    desk: "D-12",
    officeLocation: "Toshkent HQ, 3-qavat",
    accessories: "Dock, sichqoncha, sumka",
    notes: "Frontend developer uchun tayinlangan",
    previousHolder: "Murod Usmonov",
  });

  const departmentsSheet = workbook.addWorksheet("Bo'limlar");
  departmentsSheet.columns = [
    { header: "Bo'lim nomi", key: "name", width: 28 },
    { header: "Kod", key: "code", width: 16 },
  ];
  styleHeader(departmentsSheet.getRow(1));
  payload.departments.forEach((department) => {
    departmentsSheet.addRow({
      code: department.code || "",
      name: department.name,
    });
  });

  const devicesSheet = workbook.addWorksheet("Texnikalar");
  devicesSheet.columns = [
    { header: "Texnika nomi", key: "name", width: 28 },
    { header: "Kategoriya", key: "category", width: 18 },
    { header: "Model", key: "model", width: 22 },
  ];
  styleHeader(devicesSheet.getRow(1));
  payload.devices.forEach((device) => {
    devicesSheet.addRow({
      category: device.category || "",
      model: device.model || "",
      name: device.name,
    });
  });

  const assetStatusesSheet = workbook.addWorksheet("Statuslar");
  assetStatusesSheet.columns = [
    { header: "Kod", key: "value", width: 20 },
    { header: "Nomi", key: "label", width: 28 },
  ];
  styleHeader(assetStatusesSheet.getRow(1));
  listAssetStatuses().forEach((status) => {
    assetStatusesSheet.addRow(status);
  });

  const conditionStatusesSheet = workbook.addWorksheet("Holatlar");
  conditionStatusesSheet.columns = [
    { header: "Kod", key: "value", width: 20 },
    { header: "Nomi", key: "label", width: 28 },
  ];
  styleHeader(conditionStatusesSheet.getRow(1));
  listConditionStatuses().forEach((status) => {
    conditionStatusesSheet.addRow(status);
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function parseInventoryWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return [];
  }

  const headerRow = sheet.getRow(1);
  const columnMap = {};

  headerRow.eachCell((cell, columnNumber) => {
    const normalizedHeader = normalizeHeader(valueToString(cell.value));
    const fieldName = HEADER_TO_FIELD[normalizedHeader];

    if (fieldName) {
      columnMap[columnNumber] = fieldName;
    }
  });

  return sheet
    .getRows(2, Math.max(sheet.rowCount - 1, 0))
    ?.map((row) => {
      const parsedRow = {
        accessories: "",
        assetStatus: "",
        assetTag: "",
        assignedAt: "",
        branch: "",
        conditionStatus: "",
        currentHolder: "",
        desk: "",
        department: "",
        deviceName: "",
        firstName: "",
        lastName: "",
        notes: "",
        officeLocation: "",
        previousHolder: "-",
        purchaseDate: "",
        purchasePrice: "",
        room: "",
        rowNumber: row.number,
        serialNumber: "",
        supplier: "",
        warrantyUntil: "",
      };

      row.eachCell((cell, columnNumber) => {
        const fieldName = columnMap[columnNumber];

        if (!fieldName) {
          return;
        }

        parsedRow[fieldName] = valueToString(cell.value).trim();
      });

      if (!parsedRow.previousHolder) {
        parsedRow.previousHolder = "-";
      }

      return parsedRow;
    })
    .filter((row) => {
      return (
        row.firstName ||
        row.lastName ||
        row.department ||
        row.deviceName ||
        row.assetTag ||
        row.serialNumber ||
        row.assetStatus ||
        row.conditionStatus ||
        row.purchaseDate ||
        row.purchasePrice ||
        row.assignedAt ||
        row.warrantyUntil ||
        row.supplier ||
        row.branch ||
        row.room ||
        row.desk ||
        row.officeLocation ||
        row.accessories ||
        row.notes ||
        row.previousHolder ||
        row.currentHolder
      );
    }) || [];
}

const HEADER_TO_FIELD = {
  "asset tag": "assetTag",
  "bolim": "department",
  "bo lim": "department",
  "bo'lim": "department",
  "familya": "lastName",
  "holati": "conditionStatus",
  "hozir kimda": "currentHolder",
  "ism": "firstName",
  "izoh": "notes",
  "joylashuv": "officeLocation",
  "kafolat muddati": "warrantyUntil",
  "oldin kimda": "previousHolder",
  "qoshimcha texnikalar": "accessories",
  "qo shimcha texnikalar": "accessories",
  "qo'shimcha texnikalar": "accessories",
  "serial": "serialNumber",
  "serial raqam": "serialNumber",
  "sotib olingan sana": "purchaseDate",
  "status": "assetStatus",
  "supplier": "supplier",
  "ta'minotchi": "supplier",
  "texnika": "deviceName",
  "oldin kimda": "previousHolder",
  "texnika nomi": "deviceName",
  "biriktirilgan sana": "assignedAt",
  "filial": "branch",
  "yetkazib beruvchi": "supplier",
  "xona": "room",
  "stol": "desk",
  "sotib olish narxi": "purchasePrice",
};

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[`’']/g, "'")
    .replace(/[^a-z0-9а-яёўқғҳ\s']/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function valueToString(value) {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("");
    }

    if (value.text) {
      return value.text;
    }

    if (value.result) {
      return String(value.result);
    }
  }

  return String(value);
}

function styleHeader(row) {
  row.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  row.fill = {
    fgColor: { argb: "0D6F5F" },
    pattern: "solid",
    type: "pattern",
  };
  row.alignment = {
    vertical: "middle",
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

module.exports = {
  createInventoryTemplateWorkbook,
  createInventoryWorkbook,
  parseInventoryWorkbook,
};
