const assetStatuses = [
  { value: "in_use", label: "Ishlatilmoqda" },
  { value: "in_stock", label: "Zaxirada" },
  { value: "repair", label: "Ta'mirda" },
  { value: "reserved", label: "Rezervda" },
  { value: "retired", label: "Hisobdan chiqarilgan" },
];

const conditionStatuses = [
  { value: "new", label: "Yangi" },
  { value: "excellent", label: "A'lo" },
  { value: "good", label: "Yaxshi" },
  { value: "fair", label: "O'rtacha" },
  { value: "damaged", label: "Nosoz" },
];

const DEFAULT_ASSET_STATUS = assetStatuses[0].value;
const DEFAULT_CONDITION_STATUS = conditionStatuses[2].value;

function listAssetStatuses() {
  return assetStatuses.map((item) => ({ ...item }));
}

function listConditionStatuses() {
  return conditionStatuses.map((item) => ({ ...item }));
}

function isKnownAssetStatus(value) {
  return assetStatuses.some((item) => item.value === value);
}

function isKnownConditionStatus(value) {
  return conditionStatuses.some((item) => item.value === value);
}

function getAssetStatusLabel(value) {
  return assetStatuses.find((item) => item.value === value)?.label || value;
}

function getConditionStatusLabel(value) {
  return conditionStatuses.find((item) => item.value === value)?.label || value;
}

function normalizeAssetStatus(value) {
  return normalizeOptionValue(value, assetStatuses, DEFAULT_ASSET_STATUS);
}

function normalizeConditionStatus(value) {
  return normalizeOptionValue(value, conditionStatuses, DEFAULT_CONDITION_STATUS);
}

function normalizeOptionValue(value, options, fallback) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const exactMatch = options.find((item) => item.value === normalized);

  if (exactMatch) {
    return exactMatch.value;
  }

  const labelMatch = options.find((item) => item.label.toLowerCase() === normalized);

  if (labelMatch) {
    return labelMatch.value;
  }

  return "";
}

module.exports = {
  DEFAULT_ASSET_STATUS,
  DEFAULT_CONDITION_STATUS,
  getAssetStatusLabel,
  getConditionStatusLabel,
  isKnownAssetStatus,
  isKnownConditionStatus,
  listAssetStatuses,
  listConditionStatuses,
  normalizeAssetStatus,
  normalizeConditionStatus,
};
