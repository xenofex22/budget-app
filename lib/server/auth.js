const crypto = require("node:crypto");

const COOKIE_NAME = "budget_session";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function configuredAccounts() {
  const accounts = [];

  if (process.env.BUDGET_USERNAME && process.env.BUDGET_PASSWORD_HASH) {
    accounts.push({
      username: process.env.BUDGET_USERNAME,
      passwordHash: process.env.BUDGET_PASSWORD_HASH,
      defaultCurrency: process.env.BUDGET_DEFAULT_CURRENCY || "AED",
      shortcutEnabled: true,
    });
  }

  if (process.env.BUDGET_SECONDARY_USERNAME && process.env.BUDGET_SECONDARY_PASSWORD_HASH) {
    accounts.push({
      username: process.env.BUDGET_SECONDARY_USERNAME,
      passwordHash: process.env.BUDGET_SECONDARY_PASSWORD_HASH,
      defaultCurrency: process.env.BUDGET_SECONDARY_DEFAULT_CURRENCY || "TRY",
      shortcutEnabled: false,
    });
  }

  return accounts;
}

function authConfigured() {
  return Boolean(configuredAccounts().length && process.env.SESSION_SECRET);
}

function findAccount(username) {
  return configuredAccounts().find((account) => safeEqual(username, account.username)) || null;
}

function validateCredentials(username, password) {
  if (!authConfigured()) return false;

  const account = findAccount(username);
  if (!account) return false;

  return safeEqual(sha256(password), account.passwordHash);
}

function getAccountProfile(username) {
  const account = findAccount(username);
  if (!account) return null;
  return {
    username: account.username,
    defaultCurrency: account.defaultCurrency,
    shortcutEnabled: account.shortcutEnabled,
  };
}

function signPayload(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSessionToken(username, ttlSeconds) {
  const payload = Buffer.from(
    JSON.stringify({
      u: username,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    })
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, item) => {
    const index = item.indexOf("=");
    if (index === -1) return acc;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function getSessionUser(req) {
  try {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;

    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    if (!safeEqual(signature, signPayload(payload))) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded?.u || !decoded?.exp) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (!findAccount(decoded.u)) return null;

    return decoded.u;
  } catch {
    return null;
  }
}

function setSessionCookie(res, username, remember) {
  const ttlSeconds = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const token = createSessionToken(username, ttlSeconds);
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  const maxAge = remember ? `; Max-Age=${ttlSeconds}` : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/${secure}${maxAge}`
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=0`
  );
}

function requireSession(req, res) {
  const username = getSessionUser(req);
  if (!username) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return username;
}

module.exports = {
  authConfigured,
  clearSessionCookie,
  getAccountProfile,
  getSessionUser,
  requireSession,
  setSessionCookie,
  validateCredentials,
};
