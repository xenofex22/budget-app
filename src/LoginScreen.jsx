import { useState } from "react";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Login failed");
      await onLogin(payload.username);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 ring-1 ring-gray-200 dark:ring-gray-700">
        <h1 className="text-4xl font-extrabold text-indigo-700 dark:text-indigo-300 text-center">Smart Budget</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 mb-8">Sign in to your budget account</p>

        <label className="block text-sm font-semibold mb-2">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="w-full p-3 rounded-xl border mb-5" required />

        <label className="block text-sm font-semibold mb-2">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="w-full p-3 rounded-xl border mb-4" required />

        <label className="flex items-center gap-2 text-sm mb-5">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me on this device
        </label>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

        <button disabled={busy} className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-lg">
          {busy ? "Signing in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
