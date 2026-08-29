const GENERAL_KEY = "userBudgetData";

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
