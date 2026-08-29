function cleanEnv(value) {
  if (value == null) return "";
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getConfig() {
  // Prefer the explicit Upstash variables configured for this app.
  // Fall back to Vercel KV-compatible names only when those are absent.
  const upstashUrl = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
  const upstashToken = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  const kvUrl = cleanEnv(process.env.KV_REST_API_URL);
  const kvToken = cleanEnv(process.env.KV_REST_API_TOKEN);

  const url = upstashUrl || kvUrl;
  const token = upstashToken || kvToken;

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
    let detail = "";
    try {
      const body = await response.text();
      if (body) detail = `: ${body.slice(0, 200)}`;
    } catch {
      // Ignore response-body parsing failures.
    }
    throw new Error(`Database request failed (${response.status})${detail}`);
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
