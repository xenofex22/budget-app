const crypto = require("node:crypto");
const { budgetKey, getJson, setJson } = require("../lib/server/store");

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function last4(value) {
  return String(value || "").replace(/\D/g, "").slice(-4);
}

function ensureMonth(snapshot, year, month) {
  snapshot.monthly = snapshot.monthly || {};
  snapshot.monthly[year] = snapshot.monthly[year] || {};
  snapshot.monthly[year][month] = snapshot.monthly[year][month] || {
    current: 0,
    expenses: [],
    income: 0,
    expense: 0,
  };
  return snapshot.monthly[year][month];
}

function syncCardsRow(snapshot, year, month) {
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  const used = cards.reduce(
    (sum, card) => sum + Math.max(0, Number(card.limit || 0) - Number(card.available || 0)),
    0
  );

  const monthData = ensureMonth(snapshot, year, month);
  const expenses = Array.isArray(monthData.expenses) ? [...monthData.expenses] : [];
  const index = expenses.findIndex(
    (item) => String(item?.name || "").trim().toLowerCase() === "cards"
  );

  const row = {
    name: "Cards",
    expected: Number(used.toFixed(2)),
    actual: index >= 0 ? Number(expenses[index]?.actual || 0) : 0,
  };

  if (index >= 0) expenses[index] = { ...expenses[index], ...row };
  else expenses.push(row);
  monthData.expenses = expenses;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configuredToken = process.env.SMS_DEVICE_TOKEN;
  const providedToken = req.headers["x-device-token"];
  if (!configuredToken || !safeEqual(configuredToken, providedToken)) {
    return res.status(401).json({ error: "Invalid device token" });
  }

  const username = process.env.BUDGET_USERNAME;
  if (!username) return res.status(503).json({ error: "Account is not configured" });

  const source = String(req.body?.source || "").toLowerCase();
  const value = Number(req.body?.value);
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: "Invalid value" });
  }

  const occurredAt = req.body?.occurredAt ? new Date(req.body.occurredAt) : new Date();
  const when = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
  const year = String(when.getFullYear());
  const month = months[when.getMonth()];

  try {
    const key = budgetKey(username);
    const snapshot = (await getJson(key, null)) || { general: null, monthly: {}, cards: [] };

    if (source === "enbd-current") {
      ensureMonth(snapshot, year, month).current = value;
    } else if (source === "ei-card") {
      const cardDigits = last4(req.body?.cardLast4);
      const cards = Array.isArray(snapshot.cards) ? [...snapshot.cards] : [];
      let index = cards.findIndex((card) => cardDigits && last4(card?.last4) === cardDigits);
      if (index === -1 && cards.length === 1) index = 0;
      if (index === -1) return res.status(409).json({ error: "Matching card not found" });

      cards[index] = {
        ...cards[index],
        last4: cardDigits || cards[index].last4,
        available: value,
      };
      snapshot.cards = cards;
      syncCardsRow(snapshot, year, month);
    } else {
      return res.status(400).json({ error: "Unsupported source" });
    }

    snapshot.updatedAt = new Date().toISOString();
    await setJson(key, snapshot);
    return res.status(200).json({ ok: true, source, updatedAt: snapshot.updatedAt });
  } catch (error) {
    console.error("status update", error);
    return res.status(500).json({ error: "Could not update budget status" });
  }
};
