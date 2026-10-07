import { useEffect, useMemo, useState } from "react";
import { getBudgetPeriod } from "./budgetPeriod";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatMoney(value, currency) {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetweenInclusive(start, end) {
  const s = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const e = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.floor((e - s) / DAY_MS) + 1);
}

function getActiveAllowance() {
  const period = getBudgetPeriod();
  let monthly = {};
  try {
    monthly = JSON.parse(localStorage.getItem(`monthlyData_${period.year}`) || "{}");
  } catch {
    monthly = {};
  }

  const month = monthly?.[period.month] || {};
  const expected = (month.expenses || []).reduce(
    (sum, item) => sum + Number(item.expected || 0),
    0
  );
  const remaining = Number(month.current || 0) - expected;

  const now = new Date();
  const target = new Date(period.year, period.monthIndex, 27);
  const daysLeft = Math.max(
    1,
    Math.ceil(
      (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
        DAY_MS
    )
  );

  return remaining / daysLeft;
}

function DailySpend({ onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [rules, setRules] = useState({});
  const [settings, setSettings] = useState({});
  const [tab, setTab] = useState("pending");
  const [remember, setRemember] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 10)
  );

  let general = {};
  try {
    general = JSON.parse(localStorage.getItem("userBudgetData") || "{}");
  } catch {
    general = {};
  }

  const currency = general.currency || "AED";
  const startingEstimate = Number(general.dailySpendTarget ?? 450);
  const dailyAllowance = getActiveAllowance();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/daily-spend", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Could not load Daily Spend");
      const data = await response.json();
      setTransactions(data.transactions || []);
      setRules(data.rules || {});
      setSettings(data.settings || {});
    } catch (err) {
      setError(err.message || "Could not load Daily Spend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function classify(transaction, classification) {
    setError("");
    try {
      const response = await fetch("/api/daily-spend", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transaction.id,
          classification,
          rememberMerchant: Boolean(remember[transaction.id]),
        }),
      });
      if (!response.ok) throw new Error("Could not update transaction");
      await load();
    } catch (err) {
      setError(err.message || "Could not update transaction");
    }
  }

  async function addTransaction(e) {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/daily-spend", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant,
          amount: Number(amount),
          currency,
          occurredAt: new Date(`${occurredAt}T12:00:00`).toISOString(),
        }),
      });
      if (!response.ok) throw new Error("Could not add transaction");
      setMerchant("");
      setAmount("");
      await load();
    } catch (err) {
      setError(err.message || "Could not add transaction");
    }
  }

  async function forgetMerchant(key) {
    setError("");
    try {
      const response = await fetch("/api/daily-spend", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: key }),
      });
      if (!response.ok) throw new Error("Could not remove merchant rule");
      await load();
    } catch (err) {
      setError(err.message || "Could not remove merchant rule");
    }
  }

  const now = new Date();
  const today = dateOnly(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dailyTransactions = useMemo(
    () => transactions.filter((item) => item.classification === "daily_spend"),
    [transactions]
  );

  const trackingStart = settings.trackingStartedAt
    ? dateOnly(new Date(settings.trackingStartedAt))
    : dailyTransactions.length
      ? dateOnly(new Date(dailyTransactions[dailyTransactions.length - 1].occurredAt))
      : today;

  const completedDays = trackingStart <= yesterday
    ? daysBetweenInclusive(trackingStart, yesterday)
    : 0;

  const completedSpend = dailyTransactions.reduce((sum, item) => {
    const when = new Date(item.occurredAt);
    return dateOnly(when) <= yesterday ? sum + Number(item.amount || 0) : sum;
  }, 0);

  const actualAverage = completedDays > 0 ? completedSpend / completedDays : 0;
  const forecastAverage = completedDays >= 7 ? actualAverage : startingEstimate;
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const daysRemaining = daysBetweenInclusive(today, yearEnd);
  const projectedAdditionalSaving =
    (dailyAllowance - forecastAverage) * daysRemaining;

  const todaySpend = dailyTransactions.reduce((sum, item) => {
    const when = dateOnly(new Date(item.occurredAt));
    return when.getTime() === today.getTime()
      ? sum + Number(item.amount || 0)
      : sum;
  }, 0);

  const counts = {
    pending: transactions.filter((item) => !item.classification || item.classification === "pending").length,
    daily_spend: transactions.filter((item) => item.classification === "daily_spend").length,
    already_budgeted: transactions.filter((item) => item.classification === "already_budgeted").length,
    ignored: transactions.filter((item) => item.classification === "ignored").length,
  };

  const filtered = transactions.filter((item) => {
    const c = item.classification || "pending";
    return c === tab;
  });

  const tabs = [
    ["pending", "Pending"],
    ["daily_spend", "Daily Spend"],
    ["already_budgeted", "Already Budgeted"],
    ["ignored", "Ignored"],
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
            Daily Spend
          </h2>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">
            Review purchases once, then let remembered merchants classify future ones.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3 rounded-xl bg-white text-indigo-700 font-bold shadow ring-1 ring-indigo-200"
        >
          Back to Monthly Budget
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl bg-red-50 p-4 font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 shadow-xl">
          <div className="text-sm font-extrabold uppercase tracking-wide text-white/75">
            Until End of Year
          </div>
          <div className="mt-2 text-4xl font-extrabold">
            {formatMoney(projectedAdditionalSaving, currency)}
          </div>
          <div className="mt-4 text-sm font-semibold text-white/90">
            {formatMoney(dailyAllowance, currency)} daily allowance
            {" · "}
            {formatMoney(forecastAverage, currency)} forecast daily spend
            {" · "}
            {daysRemaining} days left
          </div>
          <div className="mt-2 text-xs text-white/75">
            {completedDays >= 7
              ? `Forecast uses your actual ${completedDays}-day average.`
              : `Using your starting estimate until 7 completed tracking days are available.`}
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow">
          <div className="text-sm font-bold text-gray-500">Today so far</div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
            {formatMoney(todaySpend, currency)}
          </div>
          <div className="mt-2 text-xs font-semibold text-gray-500">
            Today is not included in the completed-day average yet.
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow">
          <div className="text-sm font-bold text-gray-500">Actual daily average</div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
            {completedDays ? formatMoney(actualAverage, currency) : "Not enough data"}
          </div>
          <div className="mt-2 text-xs font-semibold text-gray-500">
            {completedDays} completed tracking day{completedDays === 1 ? "" : "s"}, including zero-spend days.
          </div>
        </div>
      </section>

      <form
        onSubmit={addTransaction}
        className="mb-6 rounded-3xl bg-white dark:bg-gray-800 p-5 shadow"
      >
        <h3 className="text-lg font-extrabold text-gray-800 dark:text-white mb-4">
          Add a transaction manually
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Merchant / description"
            className="p-3 rounded-xl border"
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="p-3 rounded-xl border"
            required
          />
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="p-3 rounded-xl border"
            required
          />
          <button
            type="submit"
            className="p-3 rounded-xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-700"
          >
            Add
          </button>
        </div>
      </form>

      <section className="rounded-3xl bg-white dark:bg-gray-800 shadow overflow-hidden">
        <div className="flex flex-wrap gap-2 p-4 border-b dark:border-gray-700">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl font-bold ${
                tab === key
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-50 text-indigo-700"
              }`}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center font-semibold text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center font-semibold text-gray-500">
            Nothing here yet.
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {filtered.map((item) => (
              <div key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="font-extrabold text-gray-900 dark:text-white">
                      {item.merchant || "Unknown merchant"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-500">
                      {new Date(item.occurredAt).toLocaleString()} · {item.source || "unknown source"}
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
                      {formatMoney(item.amount, item.currency || currency)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {tab === "pending" && (
                      <label className="text-sm font-bold text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={Boolean(remember[item.id])}
                          onChange={(e) =>
                            setRemember((prev) => ({
                              ...prev,
                              [item.id]: e.target.checked,
                            }))
                          }
                          className="mr-2"
                        />
                        Remember this merchant
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => classify(item, "daily_spend")}
                        className="px-3 py-2 rounded-xl bg-green-600 text-white font-bold"
                      >
                        Daily Spend
                      </button>
                      <button
                        type="button"
                        onClick={() => classify(item, "already_budgeted")}
                        className="px-3 py-2 rounded-xl bg-amber-500 text-white font-bold"
                      >
                        Already Budgeted
                      </button>
                      <button
                        type="button"
                        onClick={() => classify(item, "ignored")}
                        className="px-3 py-2 rounded-xl bg-gray-600 text-white font-bold"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl bg-white dark:bg-gray-800 p-5 shadow">
        <h3 className="text-lg font-extrabold text-gray-800 dark:text-white">
          Remembered merchants
        </h3>
        <p className="text-sm font-semibold text-gray-500 mt-1 mb-4">
          Exact merchant descriptions only for now. We can add smarter name matching later.
        </p>
        {Object.keys(rules).length === 0 ? (
          <div className="text-sm font-semibold text-gray-500">No merchant rules yet.</div>
        ) : (
          <div className="space-y-2">
            {Object.entries(rules).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50 p-3"
              >
                <div>
                  <div className="font-bold text-indigo-900">{key}</div>
                  <div className="text-xs font-semibold text-gray-500">
                    {value.replaceAll("_", " ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => forgetMerchant(key)}
                  className="px-3 py-2 rounded-lg bg-white text-red-600 font-bold"
                >
                  Forget
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default DailySpend;
