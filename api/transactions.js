const crypto = require("node:crypto");
const {
  command,
  dailySpendSettingsKey,
  getJson,
  merchantRulesKey,
  setJson,
  transactionsKey,
} = require("../lib/server/store");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function cleanText(value, max = 120) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function merchantKey(value) {
  return cleanText(value, 100).toUpperCase().replace(/\s+/g, " ");
}

function parseRawSpendMessage(value) {
  const text = cleanText(value, 500);
  if (!text) return null;

  // Never accept authentication/security messages into the budget inbox.
  if (/\b(otp|one[- ]?time password|verification code|passcode|password|cvv|pin)\b/i.test(text)) {
    return { blocked: true };
  }

  let currency = "AED";
  let amount = null;

  const prefixMatch = text.match(/\b(AED|USD|EUR|TRY)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  const suffixMatch = text.match(/\b([0-9][0-9,]*(?:\.\d{1,2})?)\s*(AED|USD|EUR|TRY)\b/i);

  if (prefixMatch) {
    currency = prefixMatch[1].toUpperCase();
    amount = Number(prefixMatch[2].replace(/,/g, ""));
  } else if (suffixMatch) {
    amount = Number(suffixMatch[1].replace(/,/g, ""));
    currency = suffixMatch[2].toUpperCase();
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return { blocked: false, error: "Could not find transaction amount" };
  }

  const merchantPatterns = [
    /\b(?:spent|purchase(?:d)?|transaction|paid|payment|used)\b[\s\S]{0,100}?\b(?:at|@|to)\s+(.+?)(?=\s+(?:on|using|with|via|card|ending|ref(?:erence)?|available|balance)\b|[.;]|$)/i,
    /\b(?:at|@)\s+(.+?)(?=\s+(?:on|using|with|via|card|ending|ref(?:erence)?|available|balance)\b|[.;]|$)/i,
  ];

  let merchant = "";
  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      merchant = cleanText(match[1], 100);
      break;
    }
  }

  return {
    blocked: false,
    amount,
    currency,
    merchant: merchant || "Unparsed purchase",
  };
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
  const rawParsed = body.rawMessage ? parseRawSpendMessage(body.rawMessage) : null;
  if (rawParsed?.blocked) {
    return res.status(400).json({ error: "Security/OTP messages are not accepted" });
  }
  if (rawParsed?.error) {
    return res.status(422).json({ error: rawParsed.error });
  }

  const type = cleanText(body.type || (rawParsed ? "card_purchase" : ""), 30).toLowerCase();
  const allowedTypes = new Set(["expense", "income", "transfer", "refund", "card_purchase", "card_status"]);
  if (!allowedTypes.has(type)) return res.status(400).json({ error: "Unsupported transaction type" });

  const amount = rawParsed ? rawParsed.amount : Number(body.amount || 0);
  const availableLimit = body.availableLimit === undefined ? null : Number(body.availableLimit);
  const balance = body.balance === undefined ? null : Number(body.balance);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Invalid amount" });
  if (availableLimit !== null && !Number.isFinite(availableLimit)) return res.status(400).json({ error: "Invalid available limit" });
  if (balance !== null && !Number.isFinite(balance)) return res.status(400).json({ error: "Invalid balance" });

  const merchant = cleanText(rawParsed?.merchant || body.merchant, 100);

  try {
    const rules = (await getJson(merchantRulesKey(username), {})) || {};
    const remembered = rules[merchantKey(merchant)];
    const isSpend = type === "expense" || type === "card_purchase";
    const classification = !isSpend
      ? "ignored"
      : ["daily_spend", "already_budgeted", "ignored"].includes(remembered)
        ? remembered
        : "pending";

    const transaction = {
    id: crypto.randomUUID(),
    type,
    amount,
    currency: cleanText(rawParsed?.currency || body.currency || "AED", 5).toUpperCase(),
    merchant,
    account: cleanText(body.account || body.sender, 50),
    cardLast4: cleanText(body.cardLast4, 4).replace(/\D/g, ""),
    availableLimit,
    balance,
    occurredAt: body.occurredAt ? cleanText(body.occurredAt, 40) : new Date().toISOString(),
    source: "iphone-shortcut",
    receivedAt: new Date().toISOString(),
    status: classification === "pending" ? "inbox" : "classified",
    classification,
    classifiedBy: classification === "pending" ? null : "merchant_rule",
  };

    await command("LPUSH", transactionsKey(username), JSON.stringify(transaction));

    const settingsKey = dailySpendSettingsKey(username);
    const settings = (await getJson(settingsKey, {})) || {};
    if (!settings.trackingStartedAt) {
      settings.trackingStartedAt = transaction.occurredAt;
      await setJson(settingsKey, settings);
    }

    return res.status(201).json({
      ok: true,
      id: transaction.id,
      classification,
    });
  } catch (error) {
    console.error("transaction ingest", error);
    return res.status(500).json({ error: "Could not store transaction" });
  }
};
