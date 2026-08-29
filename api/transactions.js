const crypto = require("node:crypto");
const { command, transactionsKey } = require("../lib/server/store");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function cleanText(value, max = 120) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedToken = process.env.SMS_DEVICE_TOKEN;
  const providedToken = req.headers["x-device-token"];
  if (!expectedToken || !safeEqual(providedToken, expectedToken)) {
    return res.status(401).json({ error: "Invalid device token" });
  }

  const username = process.env.BUDGET_USERNAME;
  if (!username) return res.status(503).json({ error: "Account is not configured" });

  const body = req.body || {};
  const type = cleanText(body.type, 30).toLowerCase();
  const allowedTypes = new Set(["expense", "income", "transfer", "refund", "card_purchase", "card_status"]);
  if (!allowedTypes.has(type)) return res.status(400).json({ error: "Unsupported transaction type" });

  const amount = Number(body.amount || 0);
  const availableLimit = body.availableLimit === undefined ? null : Number(body.availableLimit);
  const balance = body.balance === undefined ? null : Number(body.balance);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Invalid amount" });
  if (availableLimit !== null && !Number.isFinite(availableLimit)) return res.status(400).json({ error: "Invalid available limit" });
  if (balance !== null && !Number.isFinite(balance)) return res.status(400).json({ error: "Invalid balance" });

  const transaction = {
    id: crypto.randomUUID(),
    type,
    amount,
    currency: cleanText(body.currency || "AED", 5).toUpperCase(),
    merchant: cleanText(body.merchant, 100),
    account: cleanText(body.account, 50),
    cardLast4: cleanText(body.cardLast4, 4).replace(/\D/g, ""),
    availableLimit,
    balance,
    occurredAt: body.occurredAt ? cleanText(body.occurredAt, 40) : new Date().toISOString(),
    source: "iphone-shortcut",
    receivedAt: new Date().toISOString(),
    status: "inbox",
  };

  try {
    await command("LPUSH", transactionsKey(username), JSON.stringify(transaction));
    await command("LTRIM", transactionsKey(username), "0", "999");
    return res.status(201).json({ ok: true, id: transaction.id });
  } catch (error) {
    console.error("transaction ingest", error);
    return res.status(500).json({ error: "Could not store transaction" });
  }
};
