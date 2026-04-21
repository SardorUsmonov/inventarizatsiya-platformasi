const ExcelJS = require("exceljs");

async function createInventoryWorkbook(records) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventar");

  sheet.columns = [
    { header: "Ism", key: "firstName", width: 18 },
    { header: "Familya", key: "lastName", width: 22 },
    { header: "Bo'lim", key: "department", width: 24 },
    { header: "Texnika nomi", key: "deviceName", width: 28 },
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
        currentHolder: "",
        department: "",
        deviceName: "",
        firstName: "",
        lastName: "",
        previousHolder: "-",
        rowNumber: row.number,
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
        row.previousHolder ||
        row.currentHolder
      );
    }) || [];
}

const HEADER_TO_FIELD = {
  "bolim": "department",
  "bo lim": "department",
  "bo'lim": "department",
  "familya": "lastName",
  "hozir kimda": "currentHolder",
  "ism": "firstName",
  "oldin kimda": "previousHolder",
  "texnika": "deviceName",
  "texnika nomi": "deviceName",
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
