const { requireSession } = require("../lib/server/auth");
const { budgetKey, getJson, setJson } = require("../lib/server/store");

module.exports = async function handler(req, res) {
  const username = requireSession(req, res);
  if (!username) return;

  try {
    const key = budgetKey(username);

    if (req.method === "GET") {
      const data = await getJson(key, null);
      return res.status(200).json({ data });
    }

    if (req.method === "PUT") {
      const data = req.body?.data;
      if (!data || typeof data !== "object") {
        return res.status(400).json({ error: "Invalid budget payload" });
      }

      const payload = {
        version: 2,
        updatedAt: new Date().toISOString(),
        ...data,
      };
      await setJson(key, payload);
      return res.status(200).json({ ok: true, updatedAt: payload.updatedAt });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("budget api", error);
    return res.status(500).json({ error: "Cloud storage is unavailable" });
  }
};
