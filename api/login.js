const { authConfigured, setSessionCookie, validateCredentials } = require("../lib/server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!authConfigured()) {
    return res.status(503).json({ error: "Authentication is not configured yet" });
  }

  const { username = "", password = "", remember = true } = req.body || {};
  if (!validateCredentials(username, password)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  setSessionCookie(res, username, Boolean(remember));
  return res.status(200).json({ ok: true, username });
};
