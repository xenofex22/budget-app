import { useEffect, useMemo, useState } from "react";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function loadCards() {
  try {
    const parsed = JSON.parse(localStorage.getItem("budgetCards") || "[]");
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : [{ id: crypto.randomUUID(), name: "Credit Card", last4: "", limit: 15000, available: 15000 }];
  } catch {
    return [{ id: crypto.randomUUID(), name: "Credit Card", last4: "", limit: 15000, available: 15000 }];
  }
}

export default function CardManager({ selectedYear, onBudgetChanged }) {
  const now = new Date();
  const defaultMonth = selectedYear === now.getFullYear() ? months[now.getMonth()] : months[0];
  const [cards, setCards] = useState(loadCards);
  const [targetMonth, setTargetMonth] = useState(defaultMonth);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTargetMonth(selectedYear === new Date().getFullYear() ? months[new Date().getMonth()] : months[0]);
  }, [selectedYear]);

  const totalUsed = useMemo(
    () => cards.reduce((sum, card) => sum + Math.max(0, Number(card.limit || 0) - Number(card.available || 0)), 0),
    [cards]
  );

  function updateCard(id, field, value) {
    setCards((prev) => prev.map((card) => {
      if (card.id !== id) return card;
      if (field === "name") return { ...card, [field]: value };
      if (field === "last4") return { ...card, last4: value.replace(/\D/g, "").slice(0, 4) };
      return { ...card, [field]: value === "" ? "" : Number(value) };
    }));
  }

  function addCard() {
    setCards((prev) => [...prev, { id: crypto.randomUUID(), name: "Credit Card", last4: "", limit: "", available: "" }]);
  }

  function removeCard(id) {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }

  function saveCardsToMonth() {
    localStorage.setItem("budgetCards", JSON.stringify(cards));

    const storageKey = `monthlyData_${selectedYear}`;
    let monthly = {};
    try {
      monthly = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      monthly = {};
    }

    const monthData = monthly[targetMonth] || { current: 0, expenses: [], income: 0, expense: 0 };
    const expenses = Array.isArray(monthData.expenses) ? [...monthData.expenses] : [];
    const existingIndex = expenses.findIndex((item) => String(item?.name || "").trim().toLowerCase() === "cards");
    const cardRow = { name: "Cards", expected: Number(totalUsed.toFixed(2)), actual: existingIndex >= 0 ? Number(expenses[existingIndex]?.actual || 0) : 0 };

    if (existingIndex >= 0) expenses[existingIndex] = { ...expenses[existingIndex], ...cardRow };
    else expenses.push(cardRow);

    monthly[targetMonth] = { ...monthData, expenses };
    localStorage.setItem(storageKey, JSON.stringify(monthly));
    setMessage(`Cards expected expense updated for ${targetMonth}: AED ${totalUsed.toFixed(2)}`);
    onBudgetChanged?.();
  }

  return (
    <div className="max-w-4xl mx-auto mb-6 p-6 bg-white rounded-3xl shadow-xl ring-2 ring-indigo-100 dark:ring-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">Credit Cards</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Used = card limit − available limit. This becomes the monthly expected “Cards” expense.</p>
          <p className="text-xs text-gray-400 mt-1">Last 4 digits let bank SMS updates identify the correct card.</p>
        </div>
        <button type="button" onClick={addCard} className="px-4 py-2 rounded-xl bg-indigo-100 text-indigo-800 font-bold hover:bg-indigo-200">+ Add Card</button>
      </div>

      <div className="space-y-4">
        {cards.map((card) => {
          const used = Math.max(0, Number(card.limit || 0) - Number(card.available || 0));
          return (
            <div key={card.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-4 rounded-2xl bg-indigo-50 dark:bg-gray-800">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold mb-1">Card</label>
                <input value={card.name} onChange={(e) => updateCard(card.id, "name", e.target.value)} className="w-full p-2 rounded-lg border" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Last 4</label>
                <input inputMode="numeric" maxLength={4} value={card.last4 || ""} onChange={(e) => updateCard(card.id, "last4", e.target.value)} className="w-full p-2 rounded-lg border" placeholder="3743" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Limit (AED)</label>
                <input type="number" min="0" value={card.limit} onChange={(e) => updateCard(card.id, "limit", e.target.value)} className="w-full p-2 rounded-lg border" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Available (AED)</label>
                <input type="number" min="0" value={card.available} onChange={(e) => updateCard(card.id, "available", e.target.value)} className="w-full p-2 rounded-lg border" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Used</label>
                <div className="p-2 rounded-lg bg-white dark:bg-gray-900 font-extrabold text-indigo-700 dark:text-indigo-300">{used.toFixed(2)}</div>
              </div>
              <div className="md:col-span-1">
                <button type="button" onClick={() => removeCard(card.id)} className="w-full p-2 rounded-lg bg-red-500 text-white font-bold">×</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Apply expected expense to</label>
          <select value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className="p-3 rounded-xl border">
            {months.map((month) => <option key={month}>{month}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-48 p-3 rounded-xl bg-indigo-50 dark:bg-gray-800">
          Total card usage: <strong>AED {totalUsed.toFixed(2)}</strong>
        </div>
        <button type="button" onClick={saveCardsToMonth} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">Update Cards Expense</button>
      </div>
      {message && <p className="mt-3 text-sm font-semibold text-green-700 dark:text-green-400">{message}</p>}
    </div>
  );
}
