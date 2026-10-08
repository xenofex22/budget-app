const crypto = require("node:crypto");
const { requireSession } = require("../lib/server/auth");
const {
  command,
  dailySpendSettingsKey,
  getJson,
  merchantRulesKey,
  setJson,
  transactionsKey,
} = require("../lib/server/store");

const CLASSIFICATIONS = new Set([
  "pending",
  "daily_spend",
  "already_budgeted",
  "ignored",
]);

function cleanText(value, max = 120) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function merchantKey(value) {
  return cleanText(value, 100).toUpperCase().replace(/\s+/g, " ");
}

function parseTransactions(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    try {
      const item = typeof row === "string" ? JSON.parse(row) : row;
      return {
        ...item,
        classification: CLASSIFICATIONS.has(item?.classification)
          ? item.classification
          : "pending",
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function loadTransactions(username) {
  const rows = await command("LRANGE", transactionsKey(username), "0", "-1");
  return parseTransactions(rows);
}

async function saveTransactions(username, transactions) {
  const key = transactionsKey(username);
  await command("DEL", key);
  if (transactions.length) {
    await command("RPUSH", key, ...transactions.map((item) => JSON.stringify(item)));
  }
}

async function ensureTrackingStart(username, fallbackDate = new Date()) {
  const key = dailySpendSettingsKey(username);
  const current = await getJson(key, {});
  if (current?.trackingStartedAt) return current;
  const next = {
    ...current,
    trackingStartedAt: fallbackDate.toISOString(),
  };
  await setJson(key, next);
  return next;
}

module.exports = async function handler(req, res) {
  const username = requireSession(req, res);
  if (!username) return;

  try {
    if (req.method === "GET") {
      const [transactions, rules, settings] = await Promise.all([
        loadTransactions(username),
        getJson(merchantRulesKey(username), {}),
        getJson(dailySpendSettingsKey(username), {}),
      ]);

      return res.status(200).json({
        transactions,
        rules: rules || {},
        settings: settings || {},
      });
    }

    if (req.method === "POST") {
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const merchant = cleanText(req.body?.merchant, 100);
      if (!merchant) {
        return res.status(400).json({ error: "Merchant is required" });
      }

      const occurredAtInput = req.body?.occurredAt
        ? new Date(req.body.occurredAt)
        : new Date();
      const occurredAt = Number.isNaN(occurredAtInput.getTime())
        ? new Date()
        : occurredAtInput;

      const rules = (await getJson(merchantRulesKey(username), {})) || {};
      const remembered = rules[merchantKey(merchant)];
      const classification = CLASSIFICATIONS.has(remembered)
        ? remembered
        : "pending";

      const transaction = {
        id: crypto.randomUUID(),
        type: "expense",
        amount,
        currency: cleanText(req.body?.currency || "AED", 5).toUpperCase(),
        merchant,
        account: cleanText(req.body?.account || "Manual", 50),
        cardLast4: "",
        availableLimit: null,
        balance: null,
        occurredAt: occurredAt.toISOString(),
        source: "manual-web",
        receivedAt: new Date().toISOString(),
        status: classification === "pending" ? "inbox" : "classified",
        classification,
        classifiedBy: classification === "pending" ? null : "merchant_rule",
      };

      await command("LPUSH", transactionsKey(username), JSON.stringify(transaction));
      await ensureTrackingStart(username, occurredAt);

      return res.status(201).json({ ok: true, transaction });
    }

    if (req.method === "PATCH") {
      const id = cleanText(req.body?.id, 80);
      const classification = cleanText(req.body?.classification, 40).toLowerCase();
      const rememberMerchant = Boolean(req.body?.rememberMerchant);

      if (!id || !CLASSIFICATIONS.has(classification) || classification === "pending") {
        return res.status(400).json({ error: "Invalid classification update" });
      }

      const transactions = await loadTransactions(username);
      const index = transactions.findIndex((item) => item.id === id);
      if (index === -1) return res.status(404).json({ error: "Transaction not found" });

      const current = transactions[index];
      const updated = {
        ...current,
        classification,
        status: "classified",
        classifiedBy: "manual",
        classifiedAt: new Date().toISOString(),
      };
      transactions[index] = updated;

      if (rememberMerchant && current.merchant) {
        const rules = (await getJson(merchantRulesKey(username), {})) || {};
        rules[merchantKey(current.merchant)] = classification;
        await setJson(merchantRulesKey(username), rules);

        for (let i = 0; i < transactions.length; i += 1) {
          const item = transactions[i];
          if (
            item.id !== id &&
            merchantKey(item.merchant) === merchantKey(current.merchant) &&
            (!item.classification || item.classification === "pending")
          ) {
            transactions[i] = {
              ...item,
              classification,
              status: "classified",
              classifiedBy: "merchant_rule",
              classifiedAt: new Date().toISOString(),
            };
          }
        }
      }

      await saveTransactions(username, transactions);
      await ensureTrackingStart(username, new Date(current.occurredAt || Date.now()));

      return res.status(200).json({ ok: true, transaction: updated });
    }

    if (req.method === "DELETE") {
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((value) => cleanText(value, 80)).filter(Boolean)
        : [];

      if (ids.length) {
        const idSet = new Set(ids);
        const transactions = await loadTransactions(username);
        const next = transactions.filter((item) => !idSet.has(item.id));
        const deletedCount = transactions.length - next.length;

        if (!deletedCount) {
          return res.status(404).json({ error: "No matching transactions found" });
        }

        await saveTransactions(username, next);
        return res.status(200).json({ ok: true, deletedCount });
      }

      const id = cleanText(req.body?.id, 80);
      if (id) {
        const transactions = await loadTransactions(username);
        const next = transactions.filter((item) => item.id !== id);
        if (next.length === transactions.length) {
          return res.status(404).json({ error: "Transaction not found" });
        }
        await saveTransactions(username, next);
        return res.status(200).json({ ok: true, deleted: id });
      }

      const merchant = merchantKey(req.body?.merchant);
      if (!merchant) return res.status(400).json({ error: "Merchant, transaction id, or ids are required" });

      const rules = (await getJson(merchantRulesKey(username), {})) || {};
      delete rules[merchant];
      await setJson(merchantRulesKey(username), rules);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("daily spend api", error);
    return res.status(500).json({ error: "Could not update daily spend data" });
  }
};
