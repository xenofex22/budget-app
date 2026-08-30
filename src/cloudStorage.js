const GENERAL_KEY = "userBudgetData";
const MIGRATION_KEY = "budgetCloudMigrationV2Complete";
const PRODUCTION_HOST = "budget-app-zeta-silk.vercel.app";

export function collectBudgetSnapshot() {
  const monthly = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("monthlyData_")) continue;
    const year = key.replace("monthlyData_", "");
    try {
      monthly[year] = JSON.parse(localStorage.getItem(key));
    } catch {
      // Ignore malformed legacy data.
    }
  }

  let general = null;
  try {
    const raw = localStorage.getItem(GENERAL_KEY);
    general = raw ? JSON.parse(raw) : null;
  } catch {
    general = null;
  }

  let cards = [];
  try {
    cards = JSON.parse(localStorage.getItem("budgetCards") || "[]");
  } catch {
    cards = [];
  }

  return { general, monthly, cards };
}

export function hasLocalBudget(snapshot = collectBudgetSnapshot()) {
  return Boolean(snapshot.general || Object.keys(snapshot.monthly || {}).length || snapshot.cards?.length);
}

function mergeExpenses(localExpenses, cloudExpenses) {
  const local = Array.isArray(localExpenses) ? localExpenses.map((item) => ({ ...item })) : [];
  const cloud = Array.isArray(cloudExpenses) ? cloudExpenses : [];

  // Legacy browser data is authoritative for normal expense rows. The Cards
  // row is new cloud-backed state and should keep the latest SMS-derived value.
  const cloudCards = cloud.find(
    (item) => String(item?.name || "").trim().toLowerCase() === "cards"
  );

  if (!cloudCards) return local.length ? local : cloud.map((item) => ({ ...item }));

  const cardIndex = local.findIndex(
    (item) => String(item?.name || "").trim().toLowerCase() === "cards"
  );

  if (cardIndex >= 0) {
    local[cardIndex] = {
      ...local[cardIndex],
      ...cloudCards,
      actual: Number(local[cardIndex]?.actual ?? cloudCards?.actual ?? 0),
    };
  } else {
    local.push({ ...cloudCards });
  }

  return local;
}

function mergeMonth(localMonth, cloudMonth) {
  if (!localMonth) return cloudMonth ? { ...cloudMonth } : undefined;
  if (!cloudMonth) return { ...localMonth };

  const localCurrent = Number(localMonth.current || 0);
  const cloudCurrent = Number(cloudMonth.current || 0);

  return {
    ...cloudMonth,
    ...localMonth,
    // A non-zero cloud current balance is normally the latest ENBD SMS value.
    current: cloudCurrent !== 0 ? cloudCurrent : localCurrent,
    // Preserve established legacy forecasts; use cloud only when legacy is blank.
    income: Number(localMonth.income || 0) !== 0 ? localMonth.income : cloudMonth.income,
    expense: Number(localMonth.expense || 0) !== 0 ? localMonth.expense : cloudMonth.expense,
    expenses: mergeExpenses(localMonth.expenses, cloudMonth.expenses),
  };
}

export function mergeBudgetSnapshots(localSnapshot, cloudSnapshot) {
  const local = localSnapshot || { general: null, monthly: {}, cards: [] };
  const cloud = cloudSnapshot || { general: null, monthly: {}, cards: [] };
  const monthly = {};
  const years = new Set([
    ...Object.keys(local.monthly || {}),
    ...Object.keys(cloud.monthly || {}),
  ]);

  years.forEach((year) => {
    const localYear = local.monthly?.[year] || {};
    const cloudYear = cloud.monthly?.[year] || {};
    const mergedYear = {};
    const monthNames = new Set([...Object.keys(localYear), ...Object.keys(cloudYear)]);

    monthNames.forEach((month) => {
      const merged = mergeMonth(localYear[month], cloudYear[month]);
      if (merged) mergedYear[month] = merged;
    });

    monthly[year] = mergedYear;
  });

  return {
    general: local.general || cloud.general || null,
    monthly,
    cards: Array.isArray(cloud.cards) && cloud.cards.length
      ? cloud.cards.map((card) => ({ ...card }))
      : Array.isArray(local.cards)
        ? local.cards.map((card) => ({ ...card }))
        : [],
  };
}

export function shouldRunLegacyProductionMigration(snapshot = collectBudgetSnapshot()) {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === PRODUCTION_HOST &&
    localStorage.getItem(MIGRATION_KEY) !== "1" &&
    hasLocalBudget(snapshot)
  );
}

export function markLegacyProductionMigrationComplete() {
  localStorage.setItem(MIGRATION_KEY, "1");
}

export function applyBudgetSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;

  if (snapshot.general) {
    localStorage.setItem(GENERAL_KEY, JSON.stringify(snapshot.general));
  }

  Object.entries(snapshot.monthly || {}).forEach(([year, data]) => {
    localStorage.setItem(`monthlyData_${year}`, JSON.stringify(data));
  });

  if (Array.isArray(snapshot.cards)) {
    localStorage.setItem("budgetCards", JSON.stringify(snapshot.cards));
  }
}

export function clearBudgetCache() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key === GENERAL_KEY || key === "budgetCards" || key?.startsWith("monthlyData_")) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

export async function fetchCloudBudget() {
  const response = await fetch("/api/budget", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Could not load cloud budget");
  return response.json();
}

export async function saveCloudBudget(data) {
  const response = await fetch("/api/budget", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) throw new Error("Could not save cloud budget");
  return response.json();
}
