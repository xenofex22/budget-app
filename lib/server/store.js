function getConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Cloud database is not configured");
  return { url: url.replace(/\/$/, ""), token };
}

async function command(...args) {
  const { url, token } = getConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`Database request failed (${response.status})`);
  }

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function getJson(key, fallback = null) {
  const raw = await command("GET", key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function setJson(key, value) {
  await command("SET", key, JSON.stringify(value));
}

function budgetKey(username) {
  return `budget:v2:${username}`;
}

function transactionsKey(username) {
  return `budget:v2:${username}:transactions`;
}

module.exports = { budgetKey, command, getJson, setJson, transactionsKey };
